# Assistant-Integrated Chat Endpoint
# This is the new send_chat_message function with full assistant integration

@router.post("/send", response_model=ChatResponse)
async def send_chat_message(
    chat_request: ChatRequest,  # Renamed to avoid conflict with Request
    request: Request,  # Added for accessing client info
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Send a chat message to an LLM provider with full assistant integration.
    
    🎯 STEP 6: Chat Integration API (COMPLETE IMPLEMENTATION)
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
        # 🤖 STEP 1: PROCESS ASSISTANT INTEGRATION (NEW!)
        # =============================================================================
        
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
        # In production, you might want to use actual session management
        session_id = f"user_{current_user.id}_{int(request.state.__dict__.get('start_time', 0) * 1000) if hasattr(request.state, 'start_time') else 'unknown'}"
        
        # =============================================================================
        # 🤖 STEP 3: APPLY ASSISTANT MODEL PREFERENCES (NEW!)
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
        model_requested = chat_request.model  # Keep track of original user request
        model_changed = False
        model_change_reason = None
        
        # If user or assistant specified a model, validate it against dynamic models
        if validated_model and validated_model != config.default_model:
            try:
                logger.info(f"Validating model '{validated_model}' for config {config.name}")
                
                # Get dynamic models to validate against
                dynamic_models_data = await llm_service.get_dynamic_models(
                    config_id=chat_request.config_id,
                    use_cache=True  # Use cache for validation to be fast
                )
                
                available_models = dynamic_models_data.get("models", [])
                
                if validated_model not in available_models:
                    # Model not available - either use default or suggest alternatives
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
        
        # 📁 NEW: Process file attachments and add to context
        file_context = ""
        if chat_request.file_attachment_ids:
            logger.info(f"🔍 DEBUG: Processing {len(chat_request.file_attachment_ids)} file attachments: {chat_request.file_attachment_ids}")
            
            file_context = await process_file_attachments(
                file_ids=chat_request.file_attachment_ids,
                user=current_user,
                db=db
            )
            
            logger.info(f"📄 DEBUG: File context result - Length: {len(file_context)} characters")
            if file_context:
                logger.info(f"📄 DEBUG: File context preview: {file_context[:200]}...")
            else:
                logger.warning(f"⚠️ DEBUG: File processing returned empty context for files: {chat_request.file_attachment_ids}")
                
            logger.info(f"Processed {len(chat_request.file_attachment_ids)} file attachments, total context length: {len(file_context)} characters")
        else:
            logger.info(f"🔍 DEBUG: No file attachments in request")
        
        # =============================================================================
        # 🤖 STEP 5: INJECT ASSISTANT SYSTEM PROMPT (NEW!)
        # =============================================================================
        
        # Convert request messages to service format
        messages = [
            {"role": msg.role, "content": msg.content, "name": msg.name}
            for msg in chat_request.messages
        ]
        
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
        
        # 📁 Add file context to the last user message if we have attachments
        if file_context and messages:
            logger.info(f"📄 DEBUG: Adding file context to message. Context length: {len(file_context)}")
            # Find the last user message and append file context
            for i in range(len(messages) - 1, -1, -1):
                if messages[i]["role"] == "user":
                    original_content = messages[i]["content"]
                    messages[i]["content"] = f"{messages[i]['content']}\\n\\n{file_context}"
                    logger.info(f"📄 DEBUG: Added file context to user message. Original length: {len(original_content)}, New length: {len(messages[i]['content'])}")
                    break
            else:
                # No user message found, add a system message with file context
                logger.info(f"📄 DEBUG: No user message found, adding system message with file context")
                messages.insert(0, {
                    "role": "system", 
                    "content": f"The user has provided the following files for context:\\n\\n{file_context}"
                })
        elif file_context and not messages:
            logger.warning(f"⚠️ DEBUG: Have file context but no messages to attach it to!")
        elif chat_request.file_attachment_ids and not file_context:
            logger.warning(f"⚠️ DEBUG: User sent file attachments but no context was generated!")
        
        # =============================================================================
        # 🤖 STEP 6: PREPARE CONVERSATION CONTEXT (NEW!)
        # =============================================================================
        
        # If this is a new assistant chat, prepare for auto-conversation creation
        first_user_message = ""
        if should_create_conversation:
            # Find the first user message for conversation title generation
            for msg in reversed(chat_request.messages):  # Start from the most recent
                if msg.role == "user":
                    first_user_message = msg.content
                    break
        
        # 🔍 DEBUG: Log final message that will be sent to LLM
        logger.info(f"📤 DEBUG: Sending {len(messages)} messages to LLM")
        for i, msg in enumerate(messages):
            content_preview = msg['content'][:100] + '...' if len(msg['content']) > 100 else msg['content']
            logger.info(f"📤 DEBUG: Message {i+1} - Role: {msg['role']}, Content length: {len(msg['content'])}, Preview: {content_preview}")
        
        # =============================================================================
        # STEP 7: SEND REQUEST THROUGH LLM SERVICE WITH ASSISTANT INFO
        # =============================================================================
        
        # Send the actual request with assistant preferences
        response = await llm_service.send_chat_request(
            config_id=chat_request.config_id,
            messages=messages,
            user_id=current_user.id,  # Added for usage logging
            model=validated_model,  # Use validated model instead of raw user input
            temperature=effective_temperature,  # Use assistant's preferred temperature if available
            max_tokens=effective_max_tokens,  # Use assistant's preferred max_tokens if available
            session_id=session_id,  # Added for session tracking
            request_id=request_id,  # Added for request tracing
            ip_address=client_ip,  # Added for client tracking
            user_agent=user_agent,  # Added for client info
            assistant_id=chat_request.assistant_id  # 🤖 NEW: Pass assistant ID for logging
        )
        
        # =============================================================================
        # 🤖 STEP 8: UPDATE CONVERSATION TRACKING (NEW!)
        # =============================================================================
        
        # Auto-create conversation if needed
        if should_create_conversation and assistant and first_user_message:
            try:
                new_chat_conversation = await create_chat_conversation_for_assistant(
                    db=db,
                    assistant=assistant,
                    user=current_user,
                    first_message_content=first_user_message
                )
                
                if new_chat_conversation:
                    chat_conversation = new_chat_conversation
                    logger.info(f"🎉 Auto-created conversation {chat_conversation.id} for assistant chat")
                
            except Exception as conv_error:
                logger.error(f"Failed to auto-create conversation (non-critical): {str(conv_error)}")
        
        # Update existing conversation activity
        if chat_conversation:
            try:
                chat_conversation.message_count += 2  # User message + assistant response
                chat_conversation.last_message_at = datetime.utcnow()
                chat_conversation.update_activity()
                await db.commit()
                logger.info(f"📊 Updated conversation {chat_conversation.id} activity")
                
            except Exception as update_error:
                logger.error(f"Failed to update conversation activity (non-critical): {str(update_error)}")
        
        # =============================================================================
        # STEP 9: BUILD ENHANCED RESPONSE WITH ASSISTANT INFO
        # =============================================================================
        
        # Convert service response to API response with assistant and model validation info
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
        
        # Add assistant context to response if available
        if assistant:
            # Note: We could extend ChatResponse schema to include assistant info
            # For now, the assistant context is handled through conversation tracking
            logger.info(f"🤖 Chat completed with assistant '{assistant.name}' - {len(response.content)} chars generated")
        
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
