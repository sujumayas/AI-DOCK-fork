# AI Dock Chat Streaming API Endpoints
# These endpoints handle streaming chat requests using Server-Sent Events (SSE)

import asyncio
import json
import uuid
import logging
from typing import AsyncGenerator, Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

# Import our authentication and database dependencies
from ..core.security import get_current_user
from ..models.user import User
from ..models.llm_config import LLMConfiguration
from ..core.database import get_async_db
from sqlalchemy import select

# Import our LLM service and schemas
from ..services.llm_service import (
    LLMServiceError, 
    LLMProviderError, 
    LLMConfigurationError, 
    LLMQuotaExceededError,
    LLMDepartmentQuotaExceededError
)
from ..services.llm_service import llm_service

# Import existing chat schemas (we'll reuse them)
from ..schemas.chat_api.requests import ChatRequest, ChatMessage
from pydantic import BaseModel, Field

# 🤖 NEW: Import assistant and conversation services for saving
from ..services.chat import (
    process_file_attachments,
    process_assistant_integration,
    create_chat_conversation_for_assistant,
    generate_conversation_title
)
from ..services.conversation_service import conversation_service

# =============================================================================
# STREAMING REQUEST/RESPONSE SCHEMAS
# =============================================================================

class StreamingChatRequest(BaseModel):
    """
    Schema for streaming chat requests.
    
    🎓 Learning: This reuses most of ChatRequest but adds streaming-specific options
    """
    
    # Core request data (same as regular chat)
    config_id: int = Field(description="ID of LLM configuration to use")
    messages: list[ChatMessage] = Field(description="List of chat messages")
    
    # 📁 NEW: File attachment support
    file_attachment_ids: Optional[List[int]] = Field(None, description="List of uploaded file IDs to include as context")
    
    # Optional parameters
    model: Optional[str] = Field(None, description="Override model (optional)")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Response randomness (0-2)")
    max_tokens: Optional[int] = Field(None, ge=1, le=32000, description="Maximum response tokens")
    
    # 🆕 Streaming-specific options
    stream_delay_ms: Optional[int] = Field(100, ge=10, le=1000, description="Delay between chunks in milliseconds")
    include_usage_in_stream: Optional[bool] = Field(True, description="Include usage info in final chunk")
    
    # 🤖 NEW: Add conversation and assistant parameters
    assistant_id: Optional[int] = Field(None, description="ID of assistant")
    conversation_id: Optional[int] = Field(None, description="ID of conversation")
    project_id: Optional[int] = Field(None, description="ID of project")
    
    class Config:
        schema_extra = {
            "example": {
                "config_id": 1,
                "messages": [
                    {"role": "user", "content": "Tell me a story about AI"}
                ],
                "temperature": 0.7,
                "max_tokens": 1000,
                "stream_delay_ms": 50,
                "include_usage_in_stream": True,
                "assistant_id": 1,
                "conversation_id": 1,
                "project_id": 1
            }
        }

class StreamingChunk(BaseModel):
    """
    Schema for individual streaming chunks.
    
    🎓 Learning: Each chunk represents a piece of the AI response
    """
    
    # Chunk identification
    chunk_id: str = Field(description="Unique chunk identifier")
    chunk_index: int = Field(description="Sequential chunk number (0, 1, 2, ...)")
    
    # Content and metadata
    content: str = Field(description="Partial content for this chunk")
    is_final: bool = Field(False, description="Whether this is the final chunk")
    
    # Model information (only in first chunk)
    model: Optional[str] = Field(None, description="Model used (first chunk only)")
    provider: Optional[str] = Field(None, description="Provider used (first chunk only)")
    
    # Usage information (only in final chunk)
    usage: Optional[Dict[str, int]] = Field(None, description="Token usage (final chunk only)")
    cost: Optional[float] = Field(None, description="Request cost (final chunk only)")
    response_time_ms: Optional[int] = Field(None, description="Total response time (final chunk only)")
    
    # Timestamps
    timestamp: str = Field(description="Chunk timestamp")
    
    class Config:
        schema_extra = {
            "example": {
                "chunk_id": "chunk_001",
                "chunk_index": 0,
                "content": "Once upon a time,",
                "is_final": False,
                "model": "gpt-4",
                "provider": "OpenAI",
                "timestamp": "2024-01-01T12:00:00Z"
            }
        }

# =============================================================================
# ROUTER SETUP
# =============================================================================

router = APIRouter(
    prefix="/chat",
    tags=["Chat Streaming"]
    # ❌ Removed router-level auth dependency - we'll add it per-endpoint
    # dependencies=[Depends(get_current_user)]  # This was blocking SSE!
)

logger = logging.getLogger(__name__)

# =============================================================================
# STREAMING ENDPOINTS
# =============================================================================

# 🔐 CUSTOM AUTHENTICATION FOR SSE (EventSource cannot send headers)
from fastapi import Query

@router.get("/stream")
async def stream_chat_message_sse(
    request_id: str,
    config_id: int,
    messages: str,  # JSON-encoded messages
    token: str = Query(..., description="JWT token for authentication (EventSource cannot send headers)"),
    file_attachment_ids: Optional[str] = None,  # 📁 NEW: JSON-encoded file attachment IDs
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    stream_delay_ms: Optional[int] = 100,
    include_usage_in_stream: Optional[bool] = True,
    # 🤖 NEW: Add conversation and assistant parameters
    assistant_id: Optional[int] = None,
    conversation_id: Optional[int] = None,
    project_id: Optional[int] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_async_db)
):
    """
    🌊 GET endpoint for Server-Sent Events (SSE) streaming.
    
    🎓 Learning: EventSource can only make GET requests and cannot send custom headers.
    Therefore, we accept the JWT token as a query parameter for authentication.
    
    This provides the same functionality as the POST endpoint but
    accepts all data via URL query parameters for EventSource compatibility.
    
    Args:
        request_id: Unique request identifier from frontend
        config_id: ID of LLM configuration to use
        messages: JSON-encoded array of chat messages
        token: JWT authentication token (in query params since EventSource can't send headers)
        model: Optional model override
        temperature: Response randomness (0-2)
        max_tokens: Maximum response tokens
        stream_delay_ms: Delay between chunks in milliseconds
        include_usage_in_stream: Include usage info in final chunk
        request: FastAPI request object
        db: Database session
        
    Returns:
        StreamingResponse with Server-Sent Events format
        
    Example EventSource URL:
        GET /chat/stream?token=eyJ...&request_id=123&config_id=1&messages=[{"role":"user","content":"Hello"}]
    """
    try:
        # 🔐 Authenticate user manually (EventSource can't send headers)
        try:
            # Verify JWT token
            from ..core.security import verify_token as verify_jwt
            token_data = verify_jwt(token)
            
            if not token_data:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication token"
                )
            
            # Extract user ID from token
            user_id = token_data.get("user_id")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token format: missing user_id"
                )
            
            # Look up user in database
            current_user = await db.get(User, user_id)
            if not current_user or not current_user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive"
                )
            
            logger.info(f"🔐 SSE authentication successful for user: {current_user.email}")
            
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception as auth_error:
            logger.error(f"❌ SSE authentication failed: {str(auth_error)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )
        
        # 📝 Parse JSON messages from query parameter
        try:
            parsed_messages = json.loads(messages)
            chat_messages = [ChatMessage(**msg) for msg in parsed_messages]
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid messages format: {str(e)}"
            )
        
        # 📁 NEW: Parse file attachment IDs from query parameter
        parsed_file_ids = None
        logger.info(f"🔍 DEBUG: Raw file_attachment_ids parameter: {file_attachment_ids}")
        
        if file_attachment_ids:
            try:
                parsed_file_ids = json.loads(file_attachment_ids)
                if not isinstance(parsed_file_ids, list):
                    raise ValueError("file_attachment_ids must be a list")
                logger.info(f"🔍 DEBUG: Successfully parsed file attachment IDs: {parsed_file_ids}")
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"❌ DEBUG: Invalid file_attachment_ids format: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file_attachment_ids format: {str(e)}"
                )
        else:
            logger.info(f"🔍 DEBUG: No file_attachment_ids in query parameters")
        
        # 📝 Create StreamingChatRequest from query parameters
        stream_request = StreamingChatRequest(
            config_id=config_id,
            messages=chat_messages,
            file_attachment_ids=parsed_file_ids,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream_delay_ms=stream_delay_ms,
            include_usage_in_stream=include_usage_in_stream,
            # 🤖 NEW: Add conversation and assistant parameters
            assistant_id=assistant_id,
            conversation_id=conversation_id,
            project_id=project_id
        )
        
        logger.info(f"🌊 SSE streaming request from {current_user.email}: config_id={config_id}, request_id={request_id}")
        
        # 🔄 Use the same validation and streaming logic as POST endpoint
        return await stream_chat_message_internal(
            stream_request=stream_request,
            request=request,
            current_user=current_user,
            db=db,
            request_id=request_id  # Use provided request_id
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"❌ SSE endpoint error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process SSE streaming request"
        )

@router.post("/stream")
async def stream_chat_message(
    stream_request: StreamingChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),  # ✅ Re-added auth for POST endpoint
    db: AsyncSession = Depends(get_async_db)
):
    """
    🚀 POST endpoint for streaming chat (original implementation).
    
    This endpoint accepts a full StreamingChatRequest in the request body.
    Used by advanced clients that can send complex request structures.
    """
    # Generate unique request ID
    request_id = str(uuid.uuid4())
    
    return await stream_chat_message_internal(
        stream_request=stream_request,
        request=request,
        current_user=current_user,
        db=db,
        request_id=request_id
    )

# =============================================================================
# INTERNAL STREAMING LOGIC (SHARED BY GET AND POST)
# =============================================================================

async def stream_chat_message_internal(
    stream_request: StreamingChatRequest,
    request: Request,
    current_user: User,
    db: AsyncSession,
    request_id: str
):
    """
    🚀 Internal streaming logic shared by both GET and POST endpoints.
    
    This function contains all the core streaming functionality:
    - Authentication and authorization
    - Quota enforcement and usage tracking  
    - Model validation and dynamic selection
    - Error handling and provider abstraction
    
    Args:
        stream_request: Streaming chat request with messages and options
        request: FastAPI request object for client info extraction
        current_user: Authenticated user from JWT token
        db: Database session for configuration validation
        request_id: Unique request identifier
        
    Returns:
        StreamingResponse with Server-Sent Events format
    """
    try:
        # 🔐 Validate configuration and user access (same as regular chat)
        config = await db.get(LLMConfiguration, stream_request.config_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"LLM configuration {stream_request.config_id} not found"
            )
        
        if not config.is_available_for_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to configuration '{config.name}'"
            )
        
        logger.info(f"User {current_user.email} starting streaming chat via {config.name}")
        
        # 📊 Extract client information for usage logging (same as regular chat)
        client_ip = None
        if hasattr(request, 'client') and request.client:
            client_ip = request.client.host
        
        # Check for forwarded IP headers
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            client_ip = forwarded_for.split(',')[0].strip()
        elif request.headers.get('X-Real-IP'):
            client_ip = request.headers.get('X-Real-IP')
        
        user_agent = request.headers.get('User-Agent')
        session_id = f"user_{current_user.id}_{int(request.state.__dict__.get('start_time', 0) * 1000) if hasattr(request.state, 'start_time') else 'unknown'}"
        
        # 🎛️ Model validation (same logic as regular chat)
        validated_model = stream_request.model
        if stream_request.model and stream_request.model != config.default_model:
            try:
                # Get dynamic models to validate against
                dynamic_models_data = await llm_service.get_dynamic_models(
                    config_id=stream_request.config_id,
                    use_cache=True
                )
                
                available_models = dynamic_models_data.get("models", [])
                if stream_request.model not in available_models:
                    default_model = dynamic_models_data.get("default_model", config.default_model)
                    logger.warning(f"Model '{stream_request.model}' not available for streaming. Using '{default_model}' instead.")
                    validated_model = default_model
                    
            except Exception as model_validation_error:
                logger.warning(f"Model validation failed for streaming: {str(model_validation_error)}. Using default model.")
                validated_model = config.default_model
        
        # 🚀 Create streaming response with proper SSE headers
        return StreamingResponse(
            stream_chat_generator(
                stream_request=stream_request,
                current_user=current_user,
                validated_model=validated_model,
                request_id=request_id,
                session_id=session_id,
                client_ip=client_ip,
                user_agent=user_agent,
                db=db  # 📁 NEW: Pass database session for file processing
            ),
            media_type="text/event-stream",  # 🔑 KEY CHANGE: Proper SSE media type
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",  # 🆕 CORS for EventSource
                "Access-Control-Allow-Headers": "Authorization, Content-Type",
                "X-Accel-Buffering": "no"  # Disable nginx buffering for real-time streaming
            }
        )
        
    except LLMConfigurationError as e:
        logger.error(f"Configuration error in streaming: {str(e)}")
        # Preserve the specific configuration error message for actionable feedback
        error_message = str(e)
        if "api key" in error_message.lower() or "invalid" in error_message.lower():
            detail = f"Configuration error: {error_message}. Please check your API key settings."
        else:
            detail = f"Configuration error: {error_message}. Please check your LLM configuration."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )
    except LLMDepartmentQuotaExceededError as e:
        logger.error(f"Department quota exceeded in streaming: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Department quota exceeded: {str(e)}"
        )
    except LLMQuotaExceededError as e:
        logger.error(f"Provider quota exceeded in streaming: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Provider quota exceeded: {str(e)}"
        )
    except LLMProviderError as e:
        logger.error(f"Provider error in streaming: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI provider error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in streaming chat: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your streaming chat request"
        )

# =============================================================================
# STREAMING GENERATOR FUNCTION
# =============================================================================

async def stream_chat_generator(
    stream_request: StreamingChatRequest,
    current_user: User,
    validated_model: Optional[str],
    request_id: str,
    session_id: str,
    client_ip: Optional[str],
    user_agent: Optional[str],
    db: AsyncSession  # 📁 NEW: Add database session for file processing
) -> AsyncGenerator[str, None]:
    """
    🎯 Async generator that yields streaming chat chunks.
    
    This is the core streaming logic that:
    1. Processes assistant integration and conversation creation
    2. Converts request to LLM service format
    3. Calls streaming LLM service method
    4. Formats each chunk as Server-Sent Events
    5. Saves messages to conversation after streaming completes
    6. Handles all the same business logic as regular chat
    
    🎓 Learning: Async generators allow us to yield data incrementally
    while maintaining all existing business logic and error handling.
    
    Args:
        stream_request: The streaming chat request
        current_user: Authenticated user
        validated_model: Model to use (after validation)
        request_id: Unique request identifier
        session_id: Session identifier
        client_ip: Client IP address
        user_agent: Client user agent
        db: Database session for conversation operations
        
    Yields:
        str: Server-Sent Events formatted chunks
    """
    
    chunk_index = 0
    start_time = asyncio.get_event_loop().time()
    
    # 🤖 STEP 1: PROCESS ASSISTANT INTEGRATION AND CONVERSATION SETUP
    chat_conversation = None
    assistant = None
    accumulated_response_content = ""
    
    try:
        # Process assistant integration if assistant_id provided
        if stream_request.assistant_id or stream_request.conversation_id:
            assistant_integration = await process_assistant_integration(
                assistant_id=stream_request.assistant_id,
                conversation_id=stream_request.conversation_id,
                user=current_user,
                db=db
            )
            
            # Extract assistant data
            assistant = assistant_integration.get("assistant")
            assistant_system_prompt = assistant_integration.get("system_prompt")
            chat_conversation = assistant_integration.get("chat_conversation")
            should_create_conversation = assistant_integration.get("should_create_conversation", False)
            
            # Log assistant integration results
            if assistant:
                logger.info(f"🤖 Streaming with assistant '{assistant.name}' (ID: {assistant.id})")
            else:
                logger.info(f"🌊 Streaming general chat (no assistant)")
                
            # Auto-create conversation if needed
            if should_create_conversation:
                try:
                    # Find the first user message for conversation title generation
                    first_user_message = ""
                    for msg in stream_request.messages:
                        if msg.role == "user":
                            first_user_message = msg.content
                            break
                    
                    if assistant and first_user_message:
                        # Create assistant conversation
                        new_chat_conversation = await create_chat_conversation_for_assistant(
                            db=db,
                            assistant=assistant,
                            user=current_user,
                            first_message_content=first_user_message
                        )
                        
                        if new_chat_conversation:
                            chat_conversation = new_chat_conversation
                            logger.info(f"🎉 Auto-created assistant conversation {chat_conversation.id}")
                    
                    elif first_user_message:
                        # Create general conversation
                        conversation_title = generate_conversation_title(
                            assistant_name="AI Assistant",
                            first_message=first_user_message
                        )
                        
                        # Create the conversation
                        general_conversation = await conversation_service.create_conversation(
                            db=db,
                            user_id=current_user.id,
                            title=conversation_title,
                            llm_config_id=stream_request.config_id,
                            project_id=stream_request.project_id
                        )
                        
                        chat_conversation = general_conversation
                        logger.info(f"🎉 Auto-created general conversation {chat_conversation.id}")
                        
                except Exception as conv_error:
                    logger.error(f"Failed to auto-create conversation (non-critical): {str(conv_error)}")
        
        logger.info(f"🌊 Starting streaming generation for user {current_user.email}, conversation {chat_conversation.id if chat_conversation else 'None'}")
        
    except Exception as e:
        logger.error(f"❌ Error in assistant/conversation setup: {str(e)}")
        # Continue without conversation saving
    
    try:
        # 📁 NEW: Process file attachments for streaming chat
        file_context = ""
        logger.info(f"🔍 DEBUG: Checking for file attachments in stream_request: {stream_request.file_attachment_ids}")
        
        if stream_request.file_attachment_ids:
            logger.info(f"🔍 DEBUG: Starting file processing for {len(stream_request.file_attachment_ids)} files")
            
            try:
                from ..models.file_upload import FileUpload
                from ..services.file_service import get_file_service
                
                # Import the file processing function from chat services
                from ..services.chat import process_file_attachments
                
                logger.info(f"🔍 DEBUG: About to call process_file_attachments with IDs: {stream_request.file_attachment_ids}")
                
                # Use the passed database session for file processing
                file_context = await process_file_attachments(
                    file_ids=stream_request.file_attachment_ids,
                    user=current_user,
                    db=db
                )
                
                logger.info(f"🔍 DEBUG: process_file_attachments returned context length: {len(file_context)}")
                if file_context:
                    logger.info(f"🔍 DEBUG: File context preview: {file_context[:100]}...")
                else:
                    logger.warning(f"⚠️ DEBUG: process_file_attachments returned empty context!")
                    
                logger.info(f"Processed {len(stream_request.file_attachment_ids)} file attachments for streaming, total context length: {len(file_context)} characters")
                
            except Exception as file_error:
                logger.error(f"❌ DEBUG: Error processing file attachments: {str(file_error)}")
                import traceback
                logger.error(f"❌ DEBUG: File processing traceback: {traceback.format_exc()}")
                # Continue without file context instead of failing the entire request
                file_context = ""
        else:
            logger.info(f"🔍 DEBUG: No file attachments to process")
        
        # 📝 Convert to service format (same as regular chat)
        messages = [
            {"role": msg.role, "content": msg.content, "name": msg.name}
            for msg in stream_request.messages
        ]
        
        # 📁 Add file context to the last user message if we have attachments
        logger.info(f"🔍 DEBUG: About to add file context to messages. file_context length: {len(file_context)}, messages count: {len(messages)}")
        
        if file_context and messages:
            logger.info(f"🔍 DEBUG: Adding file context to last user message")
            # Find the last user message and append file context
            for i in range(len(messages) - 1, -1, -1):
                if messages[i]["role"] == "user":
                    original_content = messages[i]["content"]
                    messages[i]["content"] = f"{messages[i]['content']}\n\n{file_context}"
                    logger.info(f"🔍 DEBUG: Updated user message. Original length: {len(original_content)}, New length: {len(messages[i]['content'])}")
                    break
            else:
                # No user message found, add a system message with file context
                logger.info(f"🔍 DEBUG: No user message found, adding system message with file context")
                messages.insert(0, {
                    "role": "system", 
                    "content": f"The user has provided the following files for context:\n\n{file_context}"
                })
        elif file_context and not messages:
            logger.warning(f"⚠️ DEBUG: Have file context but no messages!")
        elif not file_context and stream_request.file_attachment_ids:
            logger.warning(f"⚠️ DEBUG: Have file attachment IDs but no file context was generated!")
        else:
            logger.info(f"🔍 DEBUG: No file context to add to messages")
        
        # 🔍 DEBUG: Log final messages being sent to LLM
        logger.info(f"🙎 DEBUG: Sending {len(messages)} messages to LLM service:")
        for i, msg in enumerate(messages):
            content_preview = msg['content'][:100] + '...' if len(msg['content']) > 100 else msg['content']
            logger.info(f"🙎 DEBUG: Message {i+1} - Role: {msg['role']}, Content length: {len(msg['content'])}, Preview: '{content_preview}'")
        
        # 🚀 Call the NEW streaming method in LLM service
        async for chunk_data in llm_service.stream_chat_request(
            config_id=stream_request.config_id,
            messages=messages,
            user_id=current_user.id,
            model=validated_model,
            temperature=stream_request.temperature,
            max_tokens=stream_request.max_tokens,
            session_id=session_id,
            request_id=request_id,
            ip_address=client_ip,
            user_agent=user_agent
        ):
            # 📦 Format each chunk as Server-Sent Events
            chunk = StreamingChunk(
                chunk_id=f"chunk_{chunk_index:03d}",
                chunk_index=chunk_index,
                content=chunk_data.get("content", ""),
                is_final=chunk_data.get("is_final", False),
                model=chunk_data.get("model") if chunk_index == 0 else None,
                provider=chunk_data.get("provider") if chunk_index == 0 else None,
                usage=chunk_data.get("usage") if chunk_data.get("is_final") else None,
                cost=chunk_data.get("cost") if chunk_data.get("is_final") else None,
                response_time_ms=chunk_data.get("response_time_ms") if chunk_data.get("is_final") else None,
                timestamp=chunk_data.get("timestamp", "")
            )
            
            # 📡 Send chunk in SSE format
            sse_data = f"data: {chunk.json()}\n\n"
            yield sse_data
            
            # 🧮 Accumulate response content for conversation saving
            accumulated_response_content += chunk_data.get("content", "")
            
            # 🕐 Add small delay for better streaming visualization
            if stream_request.stream_delay_ms and stream_request.stream_delay_ms > 0:
                await asyncio.sleep(stream_request.stream_delay_ms / 1000.0)
            
            chunk_index += 1
            
            # 🏁 Break if this was the final chunk
            if chunk_data.get("is_final"):
                break
        
        # 💾 STEP 3: SAVE MESSAGES TO CONVERSATION AFTER STREAMING COMPLETES
        if chat_conversation and accumulated_response_content:
            try:
                # Save the user message
                last_user_message = None
                for msg in reversed(stream_request.messages):
                    if msg.role == "user":
                        last_user_message = msg.content
                        break
                
                if last_user_message:
                    await conversation_service.save_message_to_conversation(
                        db=db,
                        conversation_id=chat_conversation.id,
                        role="user",
                        content=last_user_message,
                        metadata={"file_attachments": stream_request.file_attachment_ids or []}
                    )
                    logger.info(f"💾 Saved user message to conversation {chat_conversation.id}")
                
                # Save the assistant response
                await conversation_service.save_message_to_conversation(
                    db=db,
                    conversation_id=chat_conversation.id,
                    role="assistant",
                    content=accumulated_response_content,
                    tokens_used=chunk_data.get("usage", {}).get("total_tokens"),
                    cost=str(chunk_data.get("cost")) if chunk_data.get("cost") else None,
                    response_time_ms=chunk_data.get("response_time_ms"),
                    metadata={
                        "provider": chunk_data.get("provider"),
                        "assistant_id": assistant.id if assistant else None,
                        "streaming": True
                    }
                )
                logger.info(f"💾 Saved assistant response to conversation {chat_conversation.id}")
                
            except Exception as save_error:
                logger.error(f"Failed to save messages to conversation (non-critical): {str(save_error)}")
        elif chat_conversation:
            logger.warning(f"📝 No accumulated content to save for conversation {chat_conversation.id}")
        else:
            logger.info(f"📝 No conversation to save messages to (messages sent but not persisted)")
        
        # 🎯 Send completion marker
        yield "data: [DONE]\n\n"
        
        logger.info(f"Streaming completed for user {current_user.email}: {chunk_index} chunks sent")
        
    except LLMDepartmentQuotaExceededError as e:
        # 🚫 Quota exceeded during streaming
        error_chunk = {
            "error": True,
            "error_type": "quota_exceeded",
            "error_message": str(e),
            "chunk_index": chunk_index
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"
        yield "data: [ERROR]\n\n"
        
    except LLMConfigurationError as e:
        # 🔧 Configuration error during streaming (API keys, etc.)
        error_chunk = {
            "error": True,
            "error_type": "configuration_error", 
            "error_message": str(e),
            "chunk_index": chunk_index
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"
        yield "data: [ERROR]\n\n"
        
    except LLMProviderError as e:
        # 🔌 Provider error during streaming
        error_chunk = {
            "error": True,
            "error_type": "provider_error", 
            "error_message": str(e),
            "chunk_index": chunk_index
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"
        yield "data: [ERROR]\n\n"
        
    except Exception as e:
        # 💥 Unexpected error during streaming
        logger.error(f"Error in streaming generator: {str(e)}")
        error_chunk = {
            "error": True,
            "error_type": "unexpected_error",
            "error_message": "An unexpected error occurred during streaming",
            "chunk_index": chunk_index
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"
        yield "data: [ERROR]\n\n"

# =============================================================================
# HEALTH CHECK FOR STREAMING
# =============================================================================

@router.get("/stream/health")
async def streaming_health_check(
    current_user: User = Depends(get_current_user)  # ✅ Re-added auth for health endpoint
):
    """Health check for streaming chat services."""
    return {
        "status": "healthy",
        "message": "Chat streaming service is running",
        "streaming_endpoints": {
            "stream_chat": "/chat/stream"
        },
        "streaming_features": {
            "server_sent_events": "Real-time streaming using SSE",
            "quota_enforcement": "Full quota checking and usage tracking",
            "model_validation": "Dynamic model validation with fallback",
            "error_handling": "Graceful error handling during streaming",
            "usage_logging": "Complete usage logging for streaming requests"
        },
        "supported_formats": {
            "request": "StreamingChatRequest with optional stream_delay_ms",
            "response": "Server-Sent Events with StreamingChunk format",
            "completion": "[DONE] marker",
            "errors": "[ERROR] marker with error details"
        }
    }

# =============================================================================
# 🎓 EDUCATIONAL NOTES
# =============================================================================

"""
🎯 Key Learning Points from this Streaming Implementation:

1. **Server-Sent Events (SSE)**:
   - Simple text-based protocol: "data: JSON\n\n"
   - One-way communication (server → client)
   - Automatically reconnects on connection loss
   - Works through firewalls (uses regular HTTP)

2. **Async Generators**:
   - `async def function() -> AsyncGenerator[str, None]:`
   - Use `yield` to send data incrementally
   - Perfect for streaming/real-time data

3. **Backward Compatibility**:
   - Reuses existing authentication, quota, validation logic
   - Same error handling patterns
   - Preserves all existing business rules

4. **Streaming Benefits**:
   - Better user experience (see response immediately)
   - Lower perceived latency
   - Can handle long responses gracefully
   - Maintains user engagement

5. **Production Considerations**:
   - Proper error handling during streaming
   - Client disconnection handling
   - Usage tracking for partial responses
   - Quota enforcement before and during streaming

Next Steps:
- Add streaming support to LLM service
- Create frontend SSE client
- Implement streaming UI components
"""
