"""
Main Chat Endpoints

Core chat functionality endpoints extracted from the main chat.py file.
Handles sending chat messages with assistant integration and file attachments.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from typing import List, Optional, Dict, Any
import logging
import uuid
from datetime import datetime

# Authentication and database dependencies
from ...core.security import get_current_user
from ...models.user import User
from ...models.llm_config import LLMConfiguration
from ...core.database import get_async_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# LLM service and exceptions
from ...services.llm_service import (
    LLMService,
    LLMServiceError, 
    LLMProviderError, 
    LLMConfigurationError, 
    LLMQuotaExceededError,
    LLMDepartmentQuotaExceededError
)

# Import LLM service instance
from ...services.llm_service import llm_service
from ...services.usage_service import usage_service
from ...services.conversation_service import conversation_service

# Chat-specific schemas
from ...schemas.chat_api import (
    ChatRequest,
    ChatResponse,
    ChatMessage
)

# Chat-specific services
from ...services.chat import (
    process_file_attachments,
    process_assistant_integration,
    create_chat_conversation_for_assistant,
    generate_conversation_title
)

router = APIRouter()
logger = logging.getLogger(__name__)

# =============================================================================
# MAIN CHAT ENDPOINT
# =============================================================================

@router.post("/send", response_model=ChatResponse)
async def send_chat_message(
    chat_request: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Send a chat message to an LLM provider with full assistant integration.
    
    🎯 COMPLETE IMPLEMENTATION
    ========================================================
    This endpoint now fully supports custom assistants by:
    
    1. **Assistant Validation**: Verify user owns the assistant
    2. **System Prompt Injection**: Add assistant's system prompt to LLM request
    3. **Model Preferences**: Apply assistant's preferred LLM settings
    4. **Conversation Management**: Auto-create and track assistant conversations
    5. **Usage Logging**: Track assistant usage for analytics
    
    This is the main endpoint that users call to chat with AI models.
    It handles authentication, configuration validation, assistant integration, and usage tracking.
    """
    try:
        # =============================================================================
        # STEP 1: PROCESS PROJECT AND ASSISTANT INTEGRATION
        # =============================================================================
        
        # Get project context if provided
        project = None
        project_system_prompt = None
        if chat_request.project_id:
            project = await conversation_service.get_project(
                db=db,
                project_id=chat_request.project_id,
                user_id=current_user.id
            )
            if project:
                project_system_prompt = project.system_prompt
                logger.info(f"🗂️ Using project '{project.name}' (ID: {project.id}) context")
            else:
                logger.warning(f"⚠️ Project {chat_request.project_id} not found or not accessible")
        
        # Process assistant integration first (if assistant_id provided)
        assistant_integration = await process_assistant_integration(
            assistant_id=chat_request.assistant_id,
            conversation_id=chat_request.conversation_id,
            user=current_user,
            db=db
        )
        
        # Extract assistant data
        assistant = assistant_integration.get("assistant")
        assistant_system_prompt = assistant_integration.get("system_prompt")
        assistant_model_prefs = assistant_integration.get("model_preferences", {})
        chat_conversation = assistant_integration.get("chat_conversation")
        should_create_conversation = assistant_integration.get("should_create_conversation", False)
        
        # Log assistant integration results
        if assistant:
            logger.info(f"User {current_user.email} chatting with assistant '{assistant.name}' (ID: {assistant.id})")
        else:
            logger.info(f"User {current_user.email} using general chat (no assistant)")
        
        # =============================================================================
        # STEP 2: VALIDATE LLM CONFIGURATION
        # =============================================================================
        
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
        
        config_description = f"{config.name} + {assistant.name}" if assistant else config.name
        logger.info(f"User {current_user.email} sending chat message via {config_description}")
        
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
        session_id = f"user_{current_user.id}_{int(datetime.now().timestamp() * 1000)}"
        
        # =============================================================================
        # STEP 3: APPLY ASSISTANT MODEL PREFERENCES
        # =============================================================================
        
        # Merge assistant preferences with user request (user request takes priority)
        effective_model = chat_request.model
        effective_temperature = chat_request.temperature
        effective_max_tokens = chat_request.max_tokens
        
        # Apply assistant model preferences if no user override
        if assistant and assistant_model_prefs:
            if not effective_model and "model" in assistant_model_prefs:
                effective_model = assistant_model_prefs["model"]
                logger.info(f"🤖 Using assistant's preferred model: {effective_model}")
            
            if effective_temperature is None and "temperature" in assistant_model_prefs:
                effective_temperature = assistant_model_prefs["temperature"]
                logger.info(f"🤖 Using assistant's preferred temperature: {effective_temperature}")
            
            if not effective_max_tokens and "max_tokens" in assistant_model_prefs:
                effective_max_tokens = assistant_model_prefs["max_tokens"]
                logger.info(f"🤖 Using assistant's preferred max_tokens: {effective_max_tokens}")
        
        # =============================================================================
        # STEP 4: VALIDATE MODEL SELECTION
        # =============================================================================
        
        validated_model = effective_model
        model_requested = chat_request.model
        model_changed = False
        model_change_reason = None
        
        # If user or assistant specified a model, validate it against dynamic models
        if validated_model and validated_model != config.default_model:
            try:
                logger.info(f"Validating model '{validated_model}' for config {config.name}")
                
                # Get dynamic models to validate against
                dynamic_models_data = await llm_service.get_dynamic_models(
                    config_id=chat_request.config_id,
                    use_cache=True
                )
                
                available_models = dynamic_models_data.get("models", [])
                
                if validated_model not in available_models:
                    # Model not available - use default
                    default_model = dynamic_models_data.get("default_model", config.default_model)
                    
                    logger.warning(f"Model '{validated_model}' not available. Using '{default_model}' instead.")
                    
                    # Track model change for response
                    validated_model = default_model
                    model_changed = True
                    model_change_reason = f"Model '{effective_model}' not available from provider, using '{default_model}' instead"
                    
                else:
                    logger.info(f"Model '{validated_model}' validated successfully")
                    
            except Exception as model_validation_error:
                # If validation fails, fall back to default model
                logger.warning(f"Model validation failed: {str(model_validation_error)}. Using default model.")
                validated_model = config.default_model
                model_changed = True
                model_change_reason = f"Model validation failed: {str(model_validation_error)}"
        
        # =============================================================================
        # STEP 5: PROCESS FILE ATTACHMENTS
        # =============================================================================
        
        file_context = ""
        if chat_request.file_attachment_ids:
            logger.info(f"🔍 Processing {len(chat_request.file_attachment_ids)} file attachments: {chat_request.file_attachment_ids}")
            
            file_context = await process_file_attachments(
                file_ids=chat_request.file_attachment_ids,
                user=current_user,
                db=db
            )
            
            logger.info(f"📄 File context result - Length: {len(file_context)} characters")
            if file_context:
                logger.info(f"📄 File context preview: {file_context[:200]}...")
            else:
                logger.warning(f"⚠️ File processing returned empty context for files: {chat_request.file_attachment_ids}")
                
            logger.info(f"Processed {len(chat_request.file_attachment_ids)} file attachments, total context length: {len(file_context)} characters")
        else:
            logger.info(f"🔍 No file attachments in request")
        
        # =============================================================================
        # STEP 6: INJECT ASSISTANT SYSTEM PROMPT
        # =============================================================================
        
        # Convert request messages to service format
        messages = [
            {"role": msg.role, "content": msg.content, "name": msg.name}
            for msg in chat_request.messages
        ]
        
        # Inject project system prompt first, if available
        if project_system_prompt:
            has_system_message = any(msg["role"] == "system" for msg in messages)
            
            if has_system_message:
                # Update existing system message to include project prompt
                for msg in messages:
                    if msg["role"] == "system":
                        msg["content"] = f"{project_system_prompt}\n\n{msg['content']}"
                        logger.info(f"🗂️ Enhanced existing system message with project prompt")
                        break
            else:
                # Add project system prompt as the first message
                messages.insert(0, {
                    "role": "system",
                    "content": project_system_prompt,
                    "name": f"project_{project.id}"
                })
                logger.info(f"🗂️ Injected project system prompt: '{project.name}' ({len(project_system_prompt)} chars)")
        
        # Inject assistant system prompt if available
        if assistant_system_prompt:
            # Check if there's already a system message
            has_system_message = any(msg["role"] == "system" for msg in messages)
            
            if has_system_message:
                # Update existing system message to include assistant prompt
                for msg in messages:
                    if msg["role"] == "system":
                        # Prepend assistant prompt to existing system message
                        msg["content"] = f"{assistant_system_prompt}\\n\\n{msg['content']}"
                        logger.info(f"🤖 Enhanced existing system message with assistant prompt")
                        break
            else:
                # Add assistant system prompt as the first message
                messages.insert(0, {
                    "role": "system",
                    "content": assistant_system_prompt,
                    "name": f"assistant_{assistant.id}"
                })
                logger.info(f"🤖 Injected assistant system prompt: '{assistant.name}' ({len(assistant_system_prompt)} chars)")
        
        # Add file context to the last user message if we have attachments
        if file_context and messages:
            logger.info(f"📄 Adding file context to message. Context length: {len(file_context)}")
            # Find the last user message and append file context
            for i in range(len(messages) - 1, -1, -1):
                if messages[i]["role"] == "user":
                    original_content = messages[i]["content"]
                    messages[i]["content"] = f"{messages[i]['content']}\\n\\n{file_context}"
                    logger.info(f"📄 Added file context to user message. Original length: {len(original_content)}, New length: {len(messages[i]['content'])}")
                    break
            else:
                # No user message found, add a system message with file context
                logger.info(f"📄 No user message found, adding system message with file context")
                messages.insert(0, {
                    "role": "system", 
                    "content": f"The user has provided the following files for context:\\n\\n{file_context}"
                })
        elif file_context and not messages:
            logger.warning(f"⚠️ Have file context but no messages to attach it to!")
        elif chat_request.file_attachment_ids and not file_context:
            logger.warning(f"⚠️ User sent file attachments but no context was generated!")
        
        # =============================================================================
        # STEP 7: PREPARE CONVERSATION CONTEXT
        # =============================================================================
        
        # If this is a new assistant chat, prepare for auto-conversation creation
        first_user_message = ""
        if should_create_conversation:
            # Find the first user message for conversation title generation
            for msg in reversed(chat_request.messages):
                if msg.role == "user":
                    first_user_message = msg.content
                    break
        
        # Debug: Log final message that will be sent to LLM
        logger.info(f"📤 Sending {len(messages)} messages to LLM")
        for i, msg in enumerate(messages):
            content_preview = msg['content'][:100] + '...' if len(msg['content']) > 100 else msg['content']
            logger.info(f"📤 Message {i+1} - Role: {msg['role']}, Content length: {len(msg['content'])}, Preview: {content_preview}")
        
        # =============================================================================
        # STEP 8: SEND REQUEST THROUGH LLM SERVICE
        # =============================================================================
        
        logger.info(f"🔍 About to call llm_service.send_chat_request for user {current_user.id}, request_id {request_id}")
        logger.info(f"🔍 Config: {chat_request.config_id}, Model: {validated_model}, Messages: {len(messages)}")
        
        # Send the actual request with assistant preferences
        response = await llm_service.send_chat_request(
            config_id=chat_request.config_id,
            messages=messages,
            user_id=current_user.id,
            model=validated_model,
            temperature=effective_temperature,
            max_tokens=effective_max_tokens,
            session_id=session_id,
            request_id=request_id,
            ip_address=client_ip,
            user_agent=user_agent,
            assistant_id=chat_request.assistant_id
        )
        
        logger.info(f"✅ LLM service call completed for user {current_user.id}, request_id {request_id}")
        logger.info(f"✅ Response: {len(response.content)} chars, {response.usage.get('total_tokens', 0)} tokens, ${response.cost:.4f if response.cost else 0:.4f}")
        
        # =============================================================================
        # STEP 9: SAVE MESSAGES TO CONVERSATION
        # =============================================================================
        
        # Auto-create conversation if needed
        if should_create_conversation:
            try:
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
                
                elif len(chat_request.messages) >= 2:
                    # Create general conversation
                    first_user_msg = ""
                    for msg in chat_request.messages:
                        if msg.role == "user":
                            first_user_msg = msg.content
                            break
                    
                    if first_user_msg:
                        from ...services.conversation_service import conversation_service
                        
                        conversation_title = generate_conversation_title(
                            assistant_name="AI Assistant",
                            first_message=first_user_msg
                        )
                        
                        # Create the conversation
                        general_conversation = await conversation_service.create_conversation(
                            db=db,
                            user_id=current_user.id,
                            title=conversation_title,
                            llm_config_id=chat_request.config_id,
                            project_id=chat_request.project_id
                        )
                        
                        chat_conversation = general_conversation
                        logger.info(f"🎉 Auto-created general conversation {chat_conversation.id}")
                
            except Exception as conv_error:
                logger.error(f"Failed to auto-create conversation (non-critical): {str(conv_error)}")
        
        # Save messages to conversation (if we have one)
        if chat_conversation:
            try:
                from ...services.conversation_service import conversation_service
                
                # Save the user message
                last_user_message = None
                for msg in reversed(chat_request.messages):
                    if msg.role == "user":
                        last_user_message = msg.content
                        break
                
                if last_user_message:
                    await conversation_service.save_message_to_conversation(
                        db=db,
                        conversation_id=chat_conversation.id,
                        role="user",
                        content=last_user_message,
                        metadata={"file_attachments": chat_request.file_attachment_ids or []}
                    )
                    logger.info(f"💾 Saved user message to conversation {chat_conversation.id}")
                
                # Save the assistant response
                await conversation_service.save_message_to_conversation(
                    db=db,
                    conversation_id=chat_conversation.id,
                    role="assistant",
                    content=response.content,
                    tokens_used=response.usage.get("total_tokens"),
                    cost=str(response.cost) if response.cost else None,
                    response_time_ms=response.response_time_ms,
                    metadata={
                        "provider": response.provider,
                        "assistant_id": assistant.id if assistant else None
                    }
                )
                logger.info(f"💾 Saved assistant response to conversation {chat_conversation.id}")
                
            except Exception as save_error:
                logger.error(f"Failed to save messages to conversation (non-critical): {str(save_error)}")
        else:
            logger.info(f"📝 No conversation to save messages to (messages sent but not persisted)")
        
        # =============================================================================
        # STEP 10: BUILD ENHANCED RESPONSE
        # =============================================================================
        
        # Convert service response to API response with model validation info
        chat_response = ChatResponse(
            content=response.content,
            model=response.model,
            provider=response.provider,
            usage=response.usage,
            cost=response.cost,
            response_time_ms=response.response_time_ms,
            timestamp=response.timestamp.isoformat(),
            # Include model validation information
            model_requested=model_requested,
            model_changed=model_changed,
            model_change_reason=model_change_reason
        )
        
        # Add conversation ID to response for reactive frontend updates
        if chat_conversation:
            logger.info(f"🔄 Chat completed for conversation {chat_conversation.id} with {getattr(chat_conversation, 'message_count', '?')} total messages")
        
        # Add assistant context to response if available
        if assistant:
            logger.info(f"🤖 Chat completed with assistant '{assistant.name}' - {len(response.content)} chars generated")
        else:
            logger.info(f"💬 General chat completed - {len(response.content)} chars generated")
        
        return chat_response
        
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
