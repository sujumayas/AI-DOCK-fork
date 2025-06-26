"""
Configuration Endpoints

LLM configuration management endpoints extracted from the main chat.py file.
Handles testing configurations, getting available configurations, and cost estimation.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Authentication and database dependencies
from ...core.security import get_current_user
from ...models.user import User
from ...models.llm_config import LLMConfiguration
from ...core.database import get_async_db

# LLM service
from ...services.llm_service import llm_service

# Schemas
from ...schemas.chat_api import (
    ConfigTestRequest,
    ConfigTestResponse,
    CostEstimateRequest,
    CostEstimateResponse
)
from ...schemas.llm_config import LLMConfigurationSummary

router = APIRouter()
logger = logging.getLogger(__name__)

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
