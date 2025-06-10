# AI Dock Chat API Endpoints
# These endpoints handle chat requests and LLM interactions

from fastapi import APIRouter, HTTPException, Depends, status, Request
from typing import List, Optional, Dict, Any
import logging
import uuid  # For generating request IDs

# Import our authentication and database dependencies
from ..core.security import get_current_user
from ..models.user import User
from ..models.llm_config import LLMConfiguration
from ..core.database import get_async_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Import our LLM service and schemas
from ..services.llm_service import (
    llm_service, 
    LLMServiceError, 
    LLMProviderError, 
    LLMConfigurationError, 
    LLMQuotaExceededError,
    LLMDepartmentQuotaExceededError  # NEW: Department quota exception
)
from ..schemas.llm_config import LLMConfigurationSummary

# Pydantic schemas for API requests/responses
from pydantic import BaseModel, Field

# =============================================================================
# REQUEST/RESPONSE SCHEMAS
# =============================================================================

class ChatMessage(BaseModel):
    """Schema for a single chat message."""
    role: str = Field(description="Message role: 'user', 'assistant', or 'system'")
    content: str = Field(description="Message content")
    name: Optional[str] = Field(None, description="Optional sender name")

class ChatRequest(BaseModel):
    """Schema for chat requests from frontend."""
    
    # Required fields
    config_id: int = Field(description="ID of LLM configuration to use")
    messages: List[ChatMessage] = Field(description="List of chat messages")
    
    # Optional parameters
    model: Optional[str] = Field(None, description="Override model (optional)")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Response randomness (0-2)")
    max_tokens: Optional[int] = Field(None, ge=1, le=32000, description="Maximum response tokens")
    
    class Config:
        schema_extra = {
            "example": {
                "config_id": 1,
                "messages": [
                    {"role": "user", "content": "Hello! How are you?"}
                ],
                "temperature": 0.7,
                "max_tokens": 1000
            }
        }

class ChatResponse(BaseModel):
    """Schema for chat responses to frontend."""
    
    content: str = Field(description="AI response content")
    model: str = Field(description="Model that generated the response")
    provider: str = Field(description="AI provider used")
    
    # Usage and cost information
    usage: Dict[str, int] = Field(description="Token usage information")
    cost: Optional[float] = Field(description="Estimated cost in USD")
    response_time_ms: Optional[int] = Field(description="Response time in milliseconds")
    
    # Metadata
    timestamp: str = Field(description="Response timestamp")
    
    class Config:
        schema_extra = {
            "example": {
                "content": "Hello! I'm doing well, thank you for asking. How can I help you today?",
                "model": "gpt-4",
                "provider": "OpenAI",
                "usage": {
                    "input_tokens": 12,
                    "output_tokens": 23,
                    "total_tokens": 35
                },
                "cost": 0.0012,
                "response_time_ms": 1500,
                "timestamp": "2024-01-01T12:00:00Z"
            }
        }

class ConfigTestRequest(BaseModel):
    """Schema for testing LLM configurations."""
    config_id: int = Field(description="ID of configuration to test")

class ConfigTestResponse(BaseModel):
    """Schema for configuration test results."""
    success: bool = Field(description="Whether test was successful")
    message: str = Field(description="Test result message")
    response_time_ms: Optional[int] = Field(description="Response time in milliseconds")
    model: Optional[str] = Field(description="Model used in test")
    cost: Optional[float] = Field(description="Test cost")
    error_type: Optional[str] = Field(description="Error type if failed")

class CostEstimateRequest(BaseModel):
    """Schema for cost estimation requests."""
    config_id: int = Field(description="ID of LLM configuration")
    messages: List[ChatMessage] = Field(description="Messages to estimate cost for")
    model: Optional[str] = Field(None, description="Model to use")
    max_tokens: Optional[int] = Field(None, description="Maximum response tokens")

class CostEstimateResponse(BaseModel):
    """Schema for cost estimation responses."""
    estimated_cost: Optional[float] = Field(description="Estimated cost in USD")
    has_cost_tracking: bool = Field(description="Whether cost tracking is available")
    message: str = Field(description="Explanation of estimate")

# =============================================================================
# ROUTER SETUP
# =============================================================================

router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
    dependencies=[Depends(get_current_user)]  # All endpoints require authentication
)

logger = logging.getLogger(__name__)

# =============================================================================
# CHAT ENDPOINTS
# =============================================================================

@router.post("/send", response_model=ChatResponse)
async def send_chat_message(
    chat_request: ChatRequest,  # Renamed to avoid conflict with Request
    request: Request,  # Added for accessing client info
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Send a chat message to an LLM provider.
    
    This is the main endpoint that users call to chat with AI models.
    It handles authentication, configuration validation, and usage tracking.
    """
    try:
        # Validate that the user can access this configuration
        config = await db.get(LLMConfiguration, chat_request.config_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"LLM configuration {chat_request.config_id} not found"
            )
        
        # Check if configuration is available for this user
        if not config.is_available_for_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to configuration '{config.name}'"
            )
        
        logger.info(f"User {current_user.email} sending chat message via {config.name}")
        
        # =============================================================================
        # EXTRACT CLIENT INFORMATION FOR USAGE LOGGING
        # =============================================================================
        
        # Generate unique request ID for tracing
        request_id = str(uuid.uuid4())
        
        # Extract client IP address
        client_ip = None
        if hasattr(request, 'client') and request.client:
            client_ip = request.client.host
        
        # Try to get real IP from headers (in case of proxy/load balancer)
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            client_ip = forwarded_for.split(',')[0].strip()
        elif request.headers.get('X-Real-IP'):
            client_ip = request.headers.get('X-Real-IP')
        
        # Extract user agent
        user_agent = request.headers.get('User-Agent')
        
        # Create session ID based on user and timestamp (simple approach)
        # In production, you might want to use actual session management
        session_id = f"user_{current_user.id}_{int(request.state.__dict__.get('start_time', 0) * 1000) if hasattr(request.state, 'start_time') else 'unknown'}"
        
        # Convert request to service format
        messages = [
            {"role": msg.role, "content": msg.content, "name": msg.name}
            for msg in chat_request.messages
        ]
        
        # =============================================================================
        # SEND REQUEST THROUGH LLM SERVICE WITH USAGE LOGGING
        # =============================================================================
        
        response = await llm_service.send_chat_request(
            config_id=chat_request.config_id,
            messages=messages,
            user_id=current_user.id,  # Added for usage logging
            model=chat_request.model,
            temperature=chat_request.temperature,
            max_tokens=chat_request.max_tokens,
            session_id=session_id,  # Added for session tracking
            request_id=request_id,  # Added for request tracing
            ip_address=client_ip,  # Added for client tracking
            user_agent=user_agent  # Added for client info
        )
        
        # Convert service response to API response
        return ChatResponse(
            content=response.content,
            model=response.model,
            provider=response.provider,
            usage=response.usage,
            cost=response.cost,
            response_time_ms=response.response_time_ms,
            timestamp=response.timestamp.isoformat()
        )
        
    except LLMConfigurationError as e:
        logger.error(f"Configuration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Configuration error: {str(e)}"
        )
    except LLMDepartmentQuotaExceededError as e:
        logger.error(f"Department quota exceeded: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Department quota exceeded: {str(e)}"
        )
    except LLMQuotaExceededError as e:
        logger.error(f"Provider quota exceeded: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Provider quota exceeded: {str(e)}"
        )
    except LLMProviderError as e:
        logger.error(f"Provider error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI provider error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in chat: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your chat message"
        )

# =============================================================================
# CONFIGURATION ENDPOINTS
# =============================================================================

@router.get("/configurations", response_model=List[LLMConfigurationSummary])
async def get_available_configurations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Get list of LLM configurations available to current user."""
    try:
        # Query for active configurations
        query = select(LLMConfiguration).where(
            LLMConfiguration.is_active == True
        ).order_by(LLMConfiguration.priority, LLMConfiguration.name)
        
        result = await db.execute(query)
        configs = result.scalars().all()
        
        # Filter configurations based on user permissions
        available_configs = [
            config for config in configs 
            if config.is_available_for_user(current_user)
        ]
        
        # Convert to summary format
        summaries = []
        for config in available_configs:
            summaries.append(LLMConfigurationSummary(
                id=config.id,
                name=config.name,
                provider=config.provider,
                provider_name=config.provider_name,
                default_model=config.default_model,
                is_active=config.is_active,
                is_public=config.is_public,
                priority=config.priority,
                estimated_cost_per_request=config.estimated_cost_per_request
            ))
        
        return summaries
        
    except Exception as e:
        logger.error(f"Error getting configurations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving available configurations"
        )

@router.post("/test-configuration", response_model=ConfigTestResponse)
async def test_configuration(
    request: ConfigTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Test connectivity to an LLM configuration."""
    try:
        # Validate configuration exists and user has access
        config = await db.get(LLMConfiguration, request.config_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration {request.config_id} not found"
            )
        
        if not config.is_available_for_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this configuration"
            )
        
        logger.info(f"User {current_user.email} testing configuration {config.name}")
        
        # Test configuration through service
        result = await llm_service.test_configuration(request.config_id)
        
        return ConfigTestResponse(
            success=result["success"],
            message=result["message"],
            response_time_ms=result.get("response_time_ms"),
            model=result.get("model"),
            cost=result.get("cost"),
            error_type=result.get("error_type")
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Error testing configuration: {str(e)}")
        return ConfigTestResponse(
            success=False,
            message=f"Test failed: {str(e)}",
            error_type=type(e).__name__
        )

@router.post("/estimate-cost", response_model=CostEstimateResponse)
async def estimate_cost(
    request: CostEstimateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Estimate the cost of a chat request before sending it."""
    try:
        # Validate configuration
        config = await db.get(LLMConfiguration, request.config_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration {request.config_id} not found"
            )
        
        if not config.is_available_for_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this configuration"
            )
        
        # Convert messages for estimation
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        # Get cost estimate
        estimated_cost = await llm_service.estimate_request_cost(
            config_id=request.config_id,
            messages=messages,
            model=request.model,
            max_tokens=request.max_tokens
        )
        
        if estimated_cost is not None:
            message = f"Estimated cost: ${estimated_cost:.6f} USD"
        else:
            message = "Cost tracking not available for this configuration"
        
        return CostEstimateResponse(
            estimated_cost=estimated_cost,
            has_cost_tracking=config.has_cost_tracking,
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error estimating cost: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error estimating request cost"
        )

@router.get("/models/{config_id}", response_model=List[str])
async def get_available_models(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Get available models for a specific configuration."""
    try:
        # Validate configuration
        config = await db.get(LLMConfiguration, config_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration {config_id} not found"
            )
        
        if not config.is_available_for_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this configuration"
            )
        
        # Get models through service
        models = await llm_service.get_available_models(config_id)
        return models
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving available models"
        )

# =============================================================================
# HEALTH CHECK
# =============================================================================

@router.get("/health")
async def chat_health_check():
    """Health check for chat services."""
    return {
        "status": "healthy",
        "message": "Chat service is running",
        "available_endpoints": {
            "send_message": "/chat/send",
            "get_configurations": "/chat/configurations",
            "test_configuration": "/chat/test-configuration",
            "estimate_cost": "/chat/estimate-cost",
            "get_models": "/chat/models/{config_id}"
        }
    }
