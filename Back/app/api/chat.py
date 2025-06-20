# AI Dock Chat API Endpoints
# These endpoints handle chat requests and LLM interactions

from fastapi import APIRouter, HTTPException, Depends, status, Request
from typing import List, Optional, Dict, Any
import logging
import uuid  # For generating request IDs
import os     # For file system operations

# Import our authentication and database dependencies
from ..core.security import get_current_user
from ..models.user import User
from ..models.llm_config import LLMConfiguration
from ..core.database import get_async_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Import our LLM service and schemas
from ..services.llm_service import (
    LLMService,  # Import the class, not an instance
    LLMServiceError, 
    LLMProviderError, 
    LLMConfigurationError, 
    LLMQuotaExceededError,
    LLMDepartmentQuotaExceededError  # NEW: Department quota exception
)

# 📁 NEW: Import file-related models and services
from ..models.file_upload import FileUpload
from ..services.file_service import get_file_service

# Create LLM service instance
llm_service = LLMService()

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
    
    # 📁 NEW: File attachment support
    file_attachment_ids: Optional[List[int]] = Field(None, description="List of uploaded file IDs to include as context")
    
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
    
    # NEW: Model validation information
    model_requested: Optional[str] = Field(None, description="Model originally requested by user")
    model_changed: Optional[bool] = Field(None, description="Whether the model was changed during validation")
    model_change_reason: Optional[str] = Field(None, description="Reason why model was changed")
    
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
                "timestamp": "2024-01-01T12:00:00Z",
                "model_requested": "gpt-4-turbo",
                "model_changed": True,
                "model_change_reason": "Model 'gpt-4-turbo' not available, using 'gpt-4' instead"
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
# 📁 FILE ATTACHMENT PROCESSING FUNCTIONS
# =============================================================================

async def process_file_attachments(
    file_ids: List[int],
    user: User,
    db: AsyncSession
) -> str:
    """
    Process uploaded file attachments and return their content as context.
    
    🎓 Learning: File Content Integration
    =====================================
    This function:
    1. Validates user access to each file
    2. Reads file content safely
    3. Formats content for LLM context
    4. Handles different file types appropriately
    5. Provides clear structure for the AI
    
    Args:
        file_ids: List of file IDs to process
        user: Current user (for access control)
        db: Database session
        
    Returns:
        Formatted string containing all file contents
        
    Raises:
        HTTPException: If file access denied or file not found
    """
    logger.info(f"🔍 DEBUG ENHANCED: process_file_attachments called with file_ids: {file_ids}, user: {user.email}")
    logger.info(f"🔍 DEBUG ENHANCED: file_ids type: {type(file_ids)}, length: {len(file_ids) if file_ids else 0}")
    
    if not file_ids:
        logger.info(f"🔍 DEBUG ENHANCED: No file IDs provided, returning empty context")
        return ""
    
    file_context_parts = []
    file_service = get_file_service()
    
    for i, file_id in enumerate(file_ids):
        try:
            logger.info(f"🔍 DEBUG ENHANCED: Processing file {i+1}/{len(file_ids)}, ID: {file_id} (type: {type(file_id)})")
            
            # Get file record from database
            file_record = await db.get(FileUpload, file_id)
            if not file_record:
                logger.warning(f"❌ DEBUG ENHANCED: File {file_id} not found in database for user {user.email}")
                continue
            
            logger.info(f"✅ DEBUG ENHANCED: Found file record - ID: {file_record.id}, Name: {file_record.original_filename}, MIME: {file_record.mime_type}, Status: {file_record.upload_status}")
            
            # Check if user can access this file
            file_path, error_message = file_service.get_file_path(file_record, user)
            if error_message:
                logger.warning(f"❌ DEBUG ENHANCED: Access denied to file {file_id} for user {user.email}: {error_message}")
                continue
            
            logger.info(f"✅ DEBUG ENHANCED: File access granted - Path: {file_path}")
            
            # Check if file exists on disk
            if not os.path.exists(file_path):
                logger.error(f"❌ DEBUG ENHANCED: File not found on disk: {file_path}")
                continue
            
            file_size = os.path.getsize(file_path)
            logger.info(f"✅ DEBUG ENHANCED: File exists on disk - Size: {file_size} bytes, MIME: {file_record.mime_type}")
            
            # Read file content with enhanced debugging
            logger.info(f"🔍 DEBUG ENHANCED: About to read content from {file_record.original_filename} (MIME: {file_record.mime_type})")
            file_content = await read_file_content(file_path, file_record)
            
            if file_content:
                content_preview = file_content[:100] + '...' if len(file_content) > 100 else file_content
                logger.info(f"✅ DEBUG ENHANCED: Successfully read file content - Length: {len(file_content)} characters")
                logger.info(f"✅ DEBUG ENHANCED: Content preview: {repr(content_preview)}")
                
                # Format the file content for LLM context
                formatted_content = format_file_for_context(file_record, file_content)
                file_context_parts.append(formatted_content)
                
                logger.info(f"✅ DEBUG ENHANCED: Successfully processed and formatted file {file_record.original_filename}")
            else:
                logger.error(f"❌ DEBUG ENHANCED: Could not read content from file {file_record.original_filename} - read_file_content returned empty/None")
                
        except Exception as e:
            logger.error(f"❌ DEBUG ENHANCED: Error processing file {file_id}: {str(e)}")
            import traceback
            logger.error(f"❌ DEBUG ENHANCED: Traceback: {traceback.format_exc()}")
            continue  # Skip this file but continue with others
    
    if not file_context_parts:
        logger.error(f"❌ DEBUG ENHANCED: No file context parts generated from {len(file_ids)} file IDs")
        logger.error(f"❌ DEBUG ENHANCED: This means either no files were found, access was denied, or content extraction failed")
        return ""
    
    # Combine all file contents with clear separation
    full_context = "\n\n=== ATTACHED FILES ===\n\n" + "\n\n".join(file_context_parts) + "\n\n=== END ATTACHED FILES ===\n"
    
    logger.info(f"✅ DEBUG ENHANCED: Generated file context - Parts: {len(file_context_parts)}, Total length: {len(full_context)}")
    
    # Log a preview of the complete context
    context_preview = full_context[:200] + '...' if len(full_context) > 200 else full_context
    logger.info(f"✅ DEBUG ENHANCED: File context preview: {repr(context_preview)}")
    
    return full_context

async def read_file_content(file_path, file_record: FileUpload) -> str:
    """
    Read file content safely with proper encoding detection.
    
    🎓 Learning: Safe File Reading
    ===============================
    Different file types need different handling:
    - Text files: Read with UTF-8 encoding
    - PDFs: Extract text content using PyPDF2
    - Word documents: Use the comprehensive FileProcessorService
    - CSVs: Read as text but could be structured later
    - JSON: Read as text, validate JSON structure
    
    Args:
        file_path: Path to the file
        file_record: File upload record with metadata
        
    Returns:
        File content as string, or empty string if failed
    """
    try:
        import asyncio
        from pathlib import Path
        
        # Ensure file exists
        if not Path(file_path).exists():
            logger.error(f"File not found on disk: {file_path}")
            return ""
        
        # Handle different file types
        mime_type = file_record.mime_type.lower()
        
        if mime_type == 'application/pdf':
            # PDF files need special handling
            logger.info(f"🔍 DEBUG ENHANCED: Processing PDF file: {file_record.original_filename}")
            return await read_pdf_content(file_path)
        elif mime_type in [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # .docx
            'application/msword'  # .doc
        ]:
            # 📘 NEW: Word documents - use the comprehensive FileProcessorService
            logger.info(f"🔍 DEBUG ENHANCED: Processing Word document: {file_record.original_filename} (MIME: {mime_type})")
            return await read_word_content(file_path, file_record)
        elif mime_type.startswith('text/') or mime_type in ['application/json', 'text/csv']:
            # Text-based files
            logger.info(f"🔍 DEBUG ENHANCED: Processing text file: {file_record.original_filename}")
            return await read_text_content(file_path)
        else:
            logger.warning(f"Unsupported file type for content reading: {mime_type}")
            return f"[File: {file_record.original_filename} - Content not readable (type: {mime_type})]"
            
    except Exception as e:
        logger.error(f"Error reading file content: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return ""

async def read_text_content(file_path) -> str:
    """
    Read text file content with encoding detection.
    """
    try:
        import asyncio
        
        def _read_text():
            # Try UTF-8 first, then fall back to other encodings
            encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']
            
            for encoding in encodings:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        content = f.read()
                    return content
                except UnicodeDecodeError:
                    continue
            
            # If all encodings fail, read as binary and decode with errors='replace'
            with open(file_path, 'rb') as f:
                raw_content = f.read()
            return raw_content.decode('utf-8', errors='replace')
        
        # Run in thread pool to avoid blocking
        content = await asyncio.get_event_loop().run_in_executor(None, _read_text)
        
        # Limit content size to prevent token overflow
        max_chars = 50000  # ~50k characters should be safe for most models
        if len(content) > max_chars:
            content = content[:max_chars] + "\n\n[Content truncated - file is larger than 50k characters]"
        
        return content
        
    except Exception as e:
        logger.error(f"Error reading text file: {str(e)}")
        return ""

async def read_word_content(file_path, file_record: FileUpload) -> str:
    """
    Extract text content from Word documents using the comprehensive FileProcessorService.
    
    🎓 Learning: Word Document Integration
    ====================================
    Instead of reimplementing Word processing, we use the existing
    FileProcessorService which has comprehensive support for:
    - Both .docx and .doc formats
    - Structure preservation (headings, tables, lists)
    - Metadata extraction (author, title, creation date)
    - Error handling for password-protected and corrupted files
    
    This ensures consistency with the main file processing pipeline.
    """
    try:
        from ..services.file_processor import FileProcessorService
        import asyncio
        
        logger.info(f"🔍 DEBUG WORD: Starting Word processing for: {file_record.original_filename}")
        
        def _process_word_document():
            try:
                # Create file processor service instance
                processor = FileProcessorService()
                
                logger.info(f"🔍 DEBUG WORD: FileProcessorService created")
                
                # Use the comprehensive Word processing
                # This extracts text, structure, metadata, and handles errors
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                try:
                    processed_content = loop.run_until_complete(
                        processor.process_text_file(file_record, include_metadata=True)
                    )
                    
                    logger.info(f"✅ DEBUG WORD: FileProcessorService succeeded, content length: {len(processed_content.processed_content)}")
                    
                    # Return the AI-ready processed content
                    return processed_content.processed_content
                    
                finally:
                    loop.close()
                    
            except Exception as e:
                logger.error(f"❌ DEBUG WORD: FileProcessorService failed: {str(e)}")
                import traceback
                logger.error(f"❌ DEBUG WORD: Traceback: {traceback.format_exc()}")
                return f"[Error processing Word document {file_record.original_filename}: {str(e)}]"
        
        # Run in thread pool to avoid blocking
        logger.info(f"🔍 DEBUG WORD: Running Word processing in thread pool")
        content = await asyncio.get_event_loop().run_in_executor(None, _process_word_document)
        
        if content and not content.startswith('[Error'):
            logger.info(f"✅ DEBUG WORD: Word processing completed successfully, result length: {len(content)} chars")
            # Log a preview of the content
            preview = content[:200] + '...' if len(content) > 200 else content
            logger.info(f"✅ DEBUG WORD: Content preview: {repr(preview)}")
        else:
            logger.error(f"❌ DEBUG WORD: Word processing failed or returned error: {content[:100]}...")
        
        return content or f"[No content extracted from {file_record.original_filename}]"
        
    except Exception as e:
        logger.error(f"❌ DEBUG WORD: Critical error processing Word document: {str(e)}")
        import traceback
        logger.error(f"❌ DEBUG WORD: Traceback: {traceback.format_exc()}")
        return f"[Critical error processing Word document: {str(e)}]"

async def read_pdf_content(file_path) -> str:
    """
    Extract text content from PDF files.
    
    🎓 Learning: PDF Text Extraction
    ==================================
    PDFs can contain:
    - Selectable text (easy to extract)
    - Images with text (needs OCR)
    - Complex layouts (needs structure preservation)
    
    For now, we'll extract plain text using PyPDF2.
    Future enhancements could add OCR with pytesseract.
    """
    try:
        import asyncio
        logger.info(f"🔍 DEBUG PDF: Starting PDF text extraction for: {file_path}")
        
        def _extract_pdf_text():
            try:
                import PyPDF2
                logger.info(f"🔍 DEBUG PDF: PyPDF2 imported successfully")
                
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    logger.info(f"🔍 DEBUG PDF: PDF reader created, pages: {len(pdf_reader.pages)}")
                    
                    # Check if PDF is encrypted
                    if pdf_reader.is_encrypted:
                        logger.warning(f"❌ DEBUG PDF: PDF is encrypted")
                        return "[PDF is encrypted - cannot extract text]"
                    
                    # Extract text from all pages
                    text_parts = []
                    total_pages = len(pdf_reader.pages)
                    logger.info(f"🔍 DEBUG PDF: Processing {total_pages} pages")
                    
                    for page_num, page in enumerate(pdf_reader.pages, 1):
                        try:
                            logger.info(f"🔍 DEBUG PDF: Extracting text from page {page_num}/{total_pages}")
                            page_text = page.extract_text()
                            page_text_length = len(page_text.strip()) if page_text else 0
                            
                            if page_text and page_text.strip():
                                text_parts.append(f"--- Page {page_num} ---\n{page_text}")
                                logger.info(f"✅ DEBUG PDF: Page {page_num} extracted successfully, length: {page_text_length} chars")
                            else:
                                logger.warning(f"⚠️ DEBUG PDF: Page {page_num} has no extractable text")
                                
                        except Exception as page_error:
                            logger.warning(f"❌ DEBUG PDF: Error extracting text from PDF page {page_num}: {str(page_error)}")
                            continue
                    
                    if not text_parts:
                        logger.error(f"❌ DEBUG PDF: No readable text found in any of the {total_pages} pages")
                        return "[No readable text found in PDF - may contain only images]"
                    
                    full_text = "\n\n".join(text_parts)
                    original_length = len(full_text)
                    logger.info(f"✅ DEBUG PDF: Successfully extracted text from {len(text_parts)} pages, total length: {original_length} chars")
                    
                    # Limit content size
                    max_chars = 50000
                    if len(full_text) > max_chars:
                        full_text = full_text[:max_chars] + "\n\n[PDF content truncated - file is larger than 50k characters]"
                        logger.info(f"⚠️ DEBUG PDF: Content truncated from {original_length} to {len(full_text)} chars")
                    
                    # Log a preview of the extracted content
                    preview = full_text[:150] + '...' if len(full_text) > 150 else full_text
                    logger.info(f"✅ DEBUG PDF: Content preview: {repr(preview)}")
                    
                    return full_text
                    
            except ImportError as import_error:
                logger.error(f"❌ DEBUG PDF: PyPDF2 not available: {import_error}")
                return "[PDF reading not available - PyPDF2 not installed]"
            except Exception as e:
                logger.error(f"❌ DEBUG PDF: Error extracting PDF text: {str(e)}")
                import traceback
                logger.error(f"❌ DEBUG PDF: Traceback: {traceback.format_exc()}")
                return f"[Error reading PDF: {str(e)}]"
        
        # Run in thread pool to avoid blocking
        logger.info(f"🔍 DEBUG PDF: Running PDF extraction in thread pool")
        content = await asyncio.get_event_loop().run_in_executor(None, _extract_pdf_text)
        
        logger.info(f"✅ DEBUG PDF: PDF extraction completed, result length: {len(content) if content else 0} chars")
        return content
        
    except Exception as e:
        logger.error(f"❌ DEBUG PDF: Error processing PDF file: {str(e)}")
        import traceback
        logger.error(f"❌ DEBUG PDF: Traceback: {traceback.format_exc()}")
        return f"[Error processing PDF: {str(e)}]"

def format_file_for_context(file_record: FileUpload, content: str) -> str:
    """
    Format file content for LLM context with clear structure.
    
    🎓 Learning: Context Formatting
    ================================
    LLMs work best with clearly structured context:
    - Clear file identification
    - Content boundaries
    - File metadata when relevant
    - Consistent formatting
    
    Args:
        file_record: File upload record
        content: File content
        
    Returns:
        Formatted content ready for LLM context
    """
    # Clean up content - remove excessive whitespace
    content = content.strip()
    
    # Build formatted content with clear structure
    formatted_parts = [
        f"File: {file_record.original_filename}",
        f"Type: {file_record.mime_type}",
        f"Size: {file_record.get_file_size_human()}",
        "Content:",
        "" + "-" * 40,
        content,
        "-" * 40
    ]
    
    return "\n".join(formatted_parts)

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
        
        # =============================================================================
        # VALIDATE MODEL SELECTION (NEW!)
        # =============================================================================
        
        validated_model = chat_request.model
        model_requested = chat_request.model
        model_changed = False
        model_change_reason = None
        
        # If user specified a model, validate it against dynamic models
        if chat_request.model and chat_request.model != config.default_model:
            try:
                logger.info(f"Validating user-selected model '{chat_request.model}' for config {config.name}")
                
                # Get dynamic models to validate against
                dynamic_models_data = await llm_service.get_dynamic_models(
                    config_id=chat_request.config_id,
                    use_cache=True  # Use cache for validation to be fast
                )
                
                available_models = dynamic_models_data.get("models", [])
                
                if chat_request.model not in available_models:
                    # Model not available - either use default or suggest alternatives
                    default_model = dynamic_models_data.get("default_model", config.default_model)
                    
                    logger.warning(f"Model '{chat_request.model}' not available. Using '{default_model}' instead.")
                    
                    # Track model change for response
                    validated_model = default_model
                    model_changed = True
                    model_change_reason = f"Model '{chat_request.model}' not available from provider, using '{default_model}' instead"
                    
                else:
                    logger.info(f"Model '{chat_request.model}' validated successfully")
                    
            except Exception as model_validation_error:
                # If validation fails, fall back to default model
                logger.warning(f"Model validation failed: {str(model_validation_error)}. Using default model.")
                validated_model = config.default_model
                model_changed = True
                model_change_reason = f"Model validation failed: {str(model_validation_error)}"
        
        # 📁 NEW: Process file attachments and add to context
        file_context = ""
        if chat_request.file_attachment_ids:
            logger.info(f"🔍 DEBUG ENHANCED: Processing {len(chat_request.file_attachment_ids)} file attachments: {chat_request.file_attachment_ids}")
            logger.info(f"🔍 DEBUG ENHANCED: File attachment IDs types: {[type(fid) for fid in chat_request.file_attachment_ids]}")
            
            file_context = await process_file_attachments(
                file_ids=chat_request.file_attachment_ids,
                user=current_user,
                db=db
            )
            
            logger.info(f"📄 DEBUG ENHANCED: File processing completed - Context length: {len(file_context)} characters")
            if file_context:
                context_preview = file_context[:300] + '...' if len(file_context) > 300 else file_context
                logger.info(f"📄 DEBUG ENHANCED: File context preview: {repr(context_preview)}")
                logger.info(f"✅ DEBUG ENHANCED: SUCCESS - File context generated and will be included in AI message")
            else:
                logger.error(f"❌ DEBUG ENHANCED: CRITICAL - File processing returned empty context for files: {chat_request.file_attachment_ids}")
                logger.error(f"❌ DEBUG ENHANCED: This means the AI will NOT see the file content!")
                
            logger.info(f"📊 DEBUG ENHANCED: File processing summary - {len(chat_request.file_attachment_ids)} files requested, context length: {len(file_context)} chars")
        else:
            logger.info(f"🔍 DEBUG ENHANCED: No file attachments in request (file_attachment_ids is None or empty)")
        
        # Convert request to service format
        messages = [
            {"role": msg.role, "content": msg.content, "name": msg.name}
            for msg in chat_request.messages
        ]
        
        # 📁 Add file context to the last user message if we have attachments
        if file_context and messages:
            logger.info(f"📄 DEBUG ENHANCED: Adding file context to message. Context length: {len(file_context)}")
            # Find the last user message and append file context
            for i in range(len(messages) - 1, -1, -1):
                if messages[i]["role"] == "user":
                    original_content = messages[i]["content"]
                    enhanced_content = f"{messages[i]['content']}\n\n{file_context}"
                    messages[i]["content"] = enhanced_content
                    
                    logger.info(f"📄 DEBUG ENHANCED: File context added to user message")
                    logger.info(f"📄 DEBUG ENHANCED: Original message length: {len(original_content)} chars")
                    logger.info(f"📄 DEBUG ENHANCED: Enhanced message length: {len(enhanced_content)} chars")
                    logger.info(f"📄 DEBUG ENHANCED: File context portion: {len(file_context)} chars")
                    
                    # Show a preview of the enhanced message
                    enhanced_preview = enhanced_content[:200] + '...' if len(enhanced_content) > 200 else enhanced_content
                    logger.info(f"📄 DEBUG ENHANCED: Enhanced message preview: {repr(enhanced_preview)}")
                    break
            else:
                # No user message found, add a system message with file context
                logger.info(f"📄 DEBUG ENHANCED: No user message found, adding system message with file context")
                messages.insert(0, {
                    "role": "system", 
                    "content": f"The user has provided the following files for context:\n\n{file_context}"
                })
                logger.info(f"📄 DEBUG ENHANCED: System message added with file context")
        elif file_context and not messages:
            logger.error(f"❌ DEBUG ENHANCED: CRITICAL - Have file context but no messages to attach it to!")
        elif chat_request.file_attachment_ids and not file_context:
            logger.error(f"❌ DEBUG ENHANCED: CRITICAL - User sent file attachments but no context was generated!")
            logger.error(f"❌ DEBUG ENHANCED: File IDs: {chat_request.file_attachment_ids}")
            logger.error(f"❌ DEBUG ENHANCED: This means the AI will receive an empty message for the file content!")
        
        # 🔍 DEBUG: Log final message that will be sent to LLM
        logger.info(f"📤 DEBUG ENHANCED: Sending {len(messages)} messages to LLM")
        for i, msg in enumerate(messages):
            content_length = len(msg['content'])
            content_preview = msg['content'][:150] + '...' if content_length > 150 else msg['content']
            
            logger.info(f"📤 DEBUG ENHANCED: Message {i+1} - Role: {msg['role']}, Content length: {content_length} chars")
            logger.info(f"📤 DEBUG ENHANCED: Message {i+1} preview: {repr(content_preview)}")
            
            # Check if this message contains file context
            if '=== ATTACHED FILES ===' in msg['content']:
                logger.info(f"📎 DEBUG ENHANCED: Message {i+1} contains file attachments - AI will see file content!")
            elif msg['role'] == 'user' and chat_request.file_attachment_ids:
                logger.warning(f"⚠️ DEBUG ENHANCED: Message {i+1} is from user but doesn't contain file context despite file attachments!")
        
        # =============================================================================
        # SEND REQUEST THROUGH LLM SERVICE WITH USAGE LOGGING
        # =============================================================================
        
        response = await llm_service.send_chat_request(
            config_id=chat_request.config_id,
            messages=messages,
            user_id=current_user.id,  # Added for usage logging
            model=validated_model,  # Use validated model instead of raw user input
            temperature=chat_request.temperature,
            max_tokens=chat_request.max_tokens,
            session_id=session_id,  # Added for session tracking
            request_id=request_id,  # Added for request tracing
            ip_address=client_ip,  # Added for client tracking
            user_agent=user_agent  # Added for client info
        )
        
        # Convert service response to API response with model validation info
        return ChatResponse(
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
    """Get available models for a specific configuration (legacy endpoint)."""
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

class DynamicModelsResponse(BaseModel):
    """Response schema for dynamic models endpoint."""
    models: List[str] = Field(description="List of available model names")
    default_model: str = Field(description="Recommended default model")
    provider: str = Field(description="Provider name")
    cached: bool = Field(description="Whether this data was returned from cache")
    fetched_at: str = Field(description="When this data was fetched")
    cache_expires_at: Optional[str] = Field(None, description="When cache expires")
    config_id: int = Field(description="Configuration ID")
    config_name: str = Field(description="Configuration name")
    
    # Optional fields for metadata
    total_models_available: Optional[int] = Field(None, description="Total models from provider")
    chat_models_available: Optional[int] = Field(None, description="Number of chat-capable models")
    error: Optional[str] = Field(None, description="Error message if fallback was used")
    fallback: Optional[bool] = Field(None, description="Whether fallback was used")
    note: Optional[str] = Field(None, description="Additional information")
    
    class Config:
        schema_extra = {
            "example": {
                "models": ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
                "default_model": "gpt-4-turbo",
                "provider": "OpenAI",
                "cached": False,
                "fetched_at": "2024-01-01T12:00:00Z",
                "cache_expires_at": "2024-01-01T13:00:00Z",
                "config_id": 1,
                "config_name": "OpenAI GPT-4 Production",
                "total_models_available": 12,
                "chat_models_available": 4
            }
        }

@router.get("/models/{config_id}/dynamic", response_model=DynamicModelsResponse)
async def get_dynamic_models(
    config_id: int,
    use_cache: bool = True,
    show_all_models: bool = False,  # 🆕 NEW: Admin flag to bypass filtering
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    🆕 Get available models directly from the LLM provider's API with intelligent filtering.
    
    This endpoint fetches real-time model information from providers like OpenAI
    and applies smart filtering to show only relevant, recent models.
    
    Features:
    - Real-time model fetching from OpenAI API
    - 🎯 Intelligent filtering (removes deprecated/irrelevant models)
    - 🛡️ Admin bypass option (show_all_models=true)
    - Intelligent caching (1-hour TTL) to reduce API calls
    - Graceful fallback to configuration models if API fails
    - Smart model sorting (GPT-4o > GPT-4 Turbo > GPT-4 > GPT-3.5)
    - Support for multiple providers (OpenAI, Claude, etc.)
    
    Args:
        config_id: ID of the LLM configuration
        use_cache: Whether to use cached results (default: True)
        show_all_models: If True, bypasses filtering for admin debugging (default: False)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        DynamicModelsResponse with filtered models, metadata, and caching info
        
    Example Usage:
        - Regular users: GET /models/1/dynamic (shows ~8-12 relevant models)
        - Admin debugging: GET /models/1/dynamic?show_all_models=true (shows all ~50+ models)
    """
    try:
        # Validate configuration exists and user has access
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
        
        logger.info(f"User {current_user.email} requesting dynamic models for config {config_id} (cache: {use_cache}, show_all: {show_all_models})")
        
        # Check if user is admin (only admins can use show_all_models)
        if show_all_models and not current_user.is_admin:
            logger.warning(f"Non-admin user {current_user.email} attempted to use show_all_models flag")
            show_all_models = False  # Silently ignore for non-admins (graceful degradation)
        
        # Get dynamic models through service with filtering control
        models_data = await llm_service.get_dynamic_models(
            config_id=config_id,
            use_cache=use_cache,
            show_all_models=show_all_models  # 🆕 Pass the admin flag
        )
        
        return DynamicModelsResponse(**models_data)
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except LLMServiceError as e:
        logger.error(f"LLM service error getting dynamic models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Service error: {str(e)}"
        )
    except LLMProviderError as e:
        logger.error(f"Provider error getting dynamic models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Provider error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error getting dynamic models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving dynamic models from provider"
        )

# =============================================================================
# 🆕 UNIFIED MODELS ENDPOINT - Single List Instead of Provider + Model
# =============================================================================

class UnifiedModelInfo(BaseModel):
    """A single model in the unified list with provider information."""
    id: str = Field(description="Unique model identifier")
    display_name: str = Field(description="Human-readable model name") 
    provider: str = Field(description="Provider name (OpenAI, Anthropic, etc.)")
    config_id: int = Field(description="Configuration ID this model belongs to")
    config_name: str = Field(description="Configuration name")
    is_default: bool = Field(description="Whether this is the default model for its config")
    cost_tier: str = Field(description="Cost tier: low, medium, high")
    capabilities: List[str] = Field(description="Model capabilities")
    is_recommended: bool = Field(description="Whether this model is recommended")
    relevance_score: Optional[int] = Field(None, description="Smart filtering relevance score (0-100)")
    
    class Config:
        schema_extra = {
            "example": {
                "id": "gpt-4o",
                "display_name": "GPT-4o",
                "provider": "OpenAI",
                "config_id": 1,
                "config_name": "OpenAI Production",
                "is_default": True,
                "cost_tier": "high",
                "capabilities": ["reasoning", "coding", "creative-writing"],
                "is_recommended": True,
                "relevance_score": 95
            }
        }

class UnifiedModelsResponse(BaseModel):
    """Response with all models from all providers combined."""
    models: List[UnifiedModelInfo] = Field(description="All available models from all providers")
    total_models: int = Field(description="Total number of models")
    total_configs: int = Field(description="Number of configurations")
    default_model_id: Optional[str] = Field(description="Recommended default model ID")
    default_config_id: Optional[int] = Field(description="Configuration ID for default model")
    cached: bool = Field(description="Whether any data was cached")
    providers: List[str] = Field(description="List of available providers")
    
    # Smart filtering metadata
    filtering_applied: bool = Field(description="Whether smart filtering was applied")
    original_total_models: Optional[int] = Field(None, description="Total models before filtering")
    
    class Config:
        schema_extra = {
            "example": {
                "models": [
                    {
                        "id": "gpt-4o",
                        "display_name": "GPT-4o",
                        "provider": "OpenAI",
                        "config_id": 1,
                        "config_name": "OpenAI Production",
                        "is_default": True,
                        "cost_tier": "high",
                        "capabilities": ["reasoning", "coding"],
                        "is_recommended": True,
                        "relevance_score": 95
                    }
                ],
                "total_models": 12,
                "total_configs": 3,
                "default_model_id": "gpt-4o",
                "default_config_id": 1,
                "cached": True,
                "providers": ["OpenAI", "Anthropic", "Google"],
                "filtering_applied": True,
                "original_total_models": 45
            }
        }

@router.get("/all-models", response_model=UnifiedModelsResponse)
async def get_all_models(
    use_cache: bool = True,
    show_all_models: bool = False,  # Admin flag to bypass filtering
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    🆕 Get all available models from all providers in a single unified list.
    
    This replaces the provider + model selection with a single model selection.
    Perfect for simplifying the chat interface while maintaining all functionality.
    
    Features:
    - 🎯 Aggregates models from all accessible LLM configurations
    - 🧠 Smart deduplication of similar models (handles multiple GPT-4 variants)
    - 🏆 Intelligent ranking and recommendations
    - 🔍 Enhanced filtering for better UX (no more "3 GPT Turbos, 4 GPT 4os" confusion)
    - 🛡️ Admin bypass option for debugging
    - ⚡ Caching for performance
    
    Args:
        use_cache: Whether to use cached results (default: True)
        show_all_models: If True, bypasses filtering (admin only, default: False)
        current_user: Current authenticated user  
        db: Database session
        
    Returns:
        UnifiedModelsResponse with all models from all providers
        
    Example Usage:
        - Regular users: GET /chat/all-models (shows ~15-20 best models)
        - Admin debugging: GET /chat/all-models?show_all_models=true (shows all models)
    """
    try:
        logger.info(f"User {current_user.email} requesting unified models list (cache: {use_cache}, show_all: {show_all_models})")
        
        # Check admin flag
        if show_all_models and not current_user.is_admin:
            logger.warning(f"Non-admin user {current_user.email} attempted to use show_all_models flag")
            show_all_models = False  # Graceful degradation
        
        # 🔧 ENHANCED: Get all available configurations with better error handling
        try:
            query = select(LLMConfiguration).where(
                LLMConfiguration.is_active == True
            ).order_by(LLMConfiguration.priority, LLMConfiguration.name)
            
            result = await db.execute(query)
            configs = result.scalars().all()
            
            # Filter configurations based on user permissions with error handling
            available_configs = []
            for config in configs:
                try:
                    if config.is_available_for_user(current_user):
                        available_configs.append(config)
                except Exception as config_error:
                    logger.warning(f"Error checking config {config.id} availability: {str(config_error)}")
                    continue
                    
        except Exception as db_error:
            logger.error(f"Database error getting configurations: {str(db_error)}")
            # Return empty response instead of crashing
            return UnifiedModelsResponse(
                models=[],
                total_models=0,
                total_configs=0,
                default_model_id=None,
                default_config_id=None,
                cached=False,
                providers=[],
                filtering_applied=False
            )
        
        if not available_configs:
            return UnifiedModelsResponse(
                models=[],
                total_models=0,
                total_configs=0,
                default_model_id=None,
                default_config_id=None,
                cached=False,
                providers=[],
                filtering_applied=False
            )
        
        logger.info(f"Found {len(available_configs)} accessible configurations for user")
        
        # Fetch models from all configurations
        all_models = []
        providers = set()
        any_cached = False
        original_total_count = 0
        
        for config in available_configs:
            try:
                logger.info(f"Fetching models for config {config.id}: {config.name}")
                
                # 🔧 ENHANCED: Get dynamic models with better error handling
                try:
                    models_data = await llm_service.get_dynamic_models(
                        config_id=config.id,
                        use_cache=use_cache,
                        show_all_models=show_all_models
                    )
                    
                    providers.add(models_data.get("provider", config.provider_name))
                    if models_data.get("cached", False):
                        any_cached = True
                    
                    config_models = models_data.get("models", [])
                    original_total_count += len(config_models)
                    default_model = models_data.get("default_model", config.default_model)
                    
                    logger.info(f"Config {config.name}: {len(config_models)} models, default: {default_model}")
                    
                    # Convert models to unified format with error handling
                    for model_id in config_models:
                        try:
                            # Create unified model info
                            unified_model = UnifiedModelInfo(
                                id=model_id,
                                display_name=get_model_display_name(model_id),
                                provider=models_data.get("provider", config.provider_name),
                                config_id=config.id,
                                config_name=config.name,
                                is_default=(model_id == default_model),
                                cost_tier=get_model_cost_tier(model_id),
                                capabilities=get_model_capabilities(model_id),
                                is_recommended=is_model_recommended(model_id),
                                relevance_score=get_model_relevance_score(model_id)
                            )
                            
                            all_models.append(unified_model)
                            
                        except Exception as model_error:
                            logger.warning(f"Error processing model {model_id} from config {config.name}: {str(model_error)}")
                            continue  # Skip this model but continue with others
                    
                except Exception as fetch_error:
                    logger.error(f"Failed to fetch models for config {config.name}: {str(fetch_error)}")
                    
                    # 🔧 NEW: Fallback to configuration-defined models
                    try:
                        fallback_models = [config.default_model] if config.default_model else []
                        logger.info(f"Using fallback model for config {config.name}: {fallback_models}")
                        
                        for model_id in fallback_models:
                            if model_id:  # Skip empty models
                                try:
                                    unified_model = UnifiedModelInfo(
                                        id=model_id,
                                        display_name=get_model_display_name(model_id),
                                        provider=config.provider_name,
                                        config_id=config.id,
                                        config_name=f"{config.name} (fallback)",
                                        is_default=True,
                                        cost_tier=get_model_cost_tier(model_id),
                                        capabilities=get_model_capabilities(model_id),
                                        is_recommended=is_model_recommended(model_id),
                                        relevance_score=get_model_relevance_score(model_id)
                                    )
                                    
                                    all_models.append(unified_model)
                                    providers.add(config.provider_name)
                                    
                                except Exception:
                                    continue
                        
                    except Exception as fallback_error:
                        logger.error(f"Fallback also failed for config {config.name}: {str(fallback_error)}")
                        continue  # Skip this config entirely
                    
            except Exception as config_error:
                logger.error(f"Critical error processing config {config.name}: {str(config_error)}")
                continue  # Continue with other configurations
        
        # 🧠 SMART DEDUPLICATION AND FILTERING
        # This fixes the "3 GPT Turbos, 4 GPT 4os" problem by intelligently 
        # deduplicating similar models and selecting the best variant
        
        if not show_all_models and len(all_models) > 0:
            all_models = deduplicate_and_filter_models(all_models)
            logger.info(f"Smart filtering: {original_total_count} -> {len(all_models)} models")
        
        # Sort models by relevance and provider priority
        all_models.sort(key=lambda m: (
            -m.relevance_score if m.relevance_score else 0,  # Higher relevance first
            0 if m.is_recommended else 1,                    # Recommended first
            0 if m.is_default else 1,                        # Defaults first
            m.display_name                                   # Alphabetical fallback
        ))
        
        # Find the best default model (highest priority config's default)
        default_model_id = None
        default_config_id = None
        
        if available_configs and all_models:
            # Use the highest priority configuration's default model
            primary_config = available_configs[0]  # Already sorted by priority
            default_model_id = primary_config.default_model
            default_config_id = primary_config.id
            
            # Verify the default model is in our unified list
            if not any(m.id == default_model_id for m in all_models):
                # Fall back to first recommended or first model
                for model in all_models:
                    if model.is_recommended or model.is_default:
                        default_model_id = model.id
                        default_config_id = model.config_id
                        break
                else:
                    # Last resort: first model
                    if all_models:
                        default_model_id = all_models[0].id
                        default_config_id = all_models[0].config_id
        
        logger.info(f"Unified models response: {len(all_models)} models, {len(available_configs)} configs, default: {default_model_id}")
        
        return UnifiedModelsResponse(
            models=all_models,
            total_models=len(all_models),
            total_configs=len(available_configs),
            default_model_id=default_model_id,
            default_config_id=default_config_id,
            cached=any_cached,
            providers=sorted(list(providers)),
            filtering_applied=not show_all_models,
            original_total_models=original_total_count if not show_all_models else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Critical error in get_all_models: {str(e)}")
        # 🔧 ENHANCED: Return structured error response instead of crashing
        return UnifiedModelsResponse(
            models=[],
            total_models=0,
            total_configs=0,
            default_model_id=None,
            default_config_id=None,
            cached=False,
            providers=[],
            filtering_applied=False
        )

# =============================================================================
# HELPER FUNCTIONS FOR UNIFIED MODELS
# =============================================================================

def get_model_display_name(model_id: str) -> str:
    """Convert model ID to user-friendly display name."""
    display_names = {
        # OpenAI Models
        'gpt-4o': 'GPT-4o',
        'gpt-4o-mini': 'GPT-4o mini',
        'gpt-4-turbo': 'GPT-4 Turbo',
        'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
        'gpt-4': 'GPT-4',
        'gpt-4-0613': 'GPT-4 (June 2023)',
        'gpt-4-32k': 'GPT-4 32K',
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
        'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
        'gpt-3.5-turbo-0613': 'GPT-3.5 Turbo (June 2023)',
        'chatgpt-4o-latest': 'ChatGPT-4o Latest',
        
        # Claude Models
        'claude-3-opus-20240229': 'Claude 3 Opus',
        'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
        'claude-3-haiku-20240307': 'Claude 3 Haiku',
        'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
        'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
        
        # Google Models
        'gemini-pro': 'Gemini Pro',
        'gemini-pro-vision': 'Gemini Pro Vision',
        'gemini-1.5-pro': 'Gemini 1.5 Pro',
        'gemini-1.5-flash': 'Gemini 1.5 Flash',
    }
    
    return display_names.get(model_id, model_id)

def get_model_cost_tier(model_id: str) -> str:
    """Determine cost tier for a model."""
    model_lower = model_id.lower()
    
    if any(term in model_lower for term in ['gpt-4o', 'gpt-4', 'opus', 'gemini-pro']):
        return 'high'
    elif any(term in model_lower for term in ['turbo', 'sonnet', 'flash', 'mini']):
        return 'medium'
    else:
        return 'low'

def get_model_capabilities(model_id: str) -> List[str]:
    """Get capabilities for a model."""
    model_lower = model_id.lower()
    capabilities = []
    
    # Base capabilities
    if any(term in model_lower for term in ['gpt-4', 'claude-3', 'gemini']):
        capabilities.extend(['reasoning', 'analysis'])
    
    if any(term in model_lower for term in ['gpt-4', 'claude', 'turbo']):
        capabilities.append('coding')
    
    if any(term in model_lower for term in ['gpt', 'claude', 'gemini']):
        capabilities.append('creative-writing')
    
    if 'vision' in model_lower:
        capabilities.append('vision')
    
    if any(term in model_lower for term in ['flash', 'haiku', 'mini']):
        capabilities.append('fast-response')
    
    return capabilities if capabilities else ['conversation']

def is_model_recommended(model_id: str) -> bool:
    """Determine if a model should be recommended."""
    recommended_models = [
        'gpt-4o',
        'gpt-4-turbo', 
        'gpt-3.5-turbo',
        'claude-3-5-sonnet-20240620',
        'claude-3-sonnet-20240229',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
    ]
    
    return model_id in recommended_models

def get_model_relevance_score(model_id: str) -> int:
    """Calculate relevance score for smart filtering (0-100)."""
    model_lower = model_id.lower()
    score = 50  # Base score
    
    # Latest/flagship models get highest scores
    if 'gpt-4o' in model_lower:
        score = 95
    elif 'claude-3-5' in model_lower:
        score = 90
    elif 'gpt-4-turbo' in model_lower:
        score = 85
    elif 'gpt-4' in model_lower and 'turbo' not in model_lower:
        score = 80
    elif 'claude-3' in model_lower:
        score = 75
    elif 'gemini-1.5' in model_lower:
        score = 70
    elif 'gpt-3.5-turbo' in model_lower:
        score = 65
    
    # Adjust for specific variants
    if 'mini' in model_lower:
        score += 5  # Mini models are efficient
    elif '32k' in model_lower:
        score -= 10  # Older large context models
    elif any(date in model_lower for date in ['0613', '0314']):
        score -= 15  # Older dated models
    
    return max(0, min(100, score))

def deduplicate_and_filter_models(models: List[UnifiedModelInfo]) -> List[UnifiedModelInfo]:
    """
    🧠 Smart deduplication to fix the "3 GPT Turbos, 4 GPT 4os" problem.
    
    This function intelligently groups similar models and selects the best variant
    from each group, dramatically improving the user experience.
    """
    
    # Group models by base name (e.g., all GPT-4 variants together)
    model_groups = {}
    
    for model in models:
        # Extract base model name for grouping
        base_name = extract_base_model_name(model.id)
        
        if base_name not in model_groups:
            model_groups[base_name] = []
        model_groups[base_name].append(model)
    
    # Select best model from each group
    deduplicated_models = []
    
    for base_name, group_models in model_groups.items():
        if len(group_models) == 1:
            # No duplicates, keep the model
            deduplicated_models.extend(group_models)
        else:
            # Multiple variants - select the best one
            best_model = select_best_model_variant(group_models)
            deduplicated_models.append(best_model)
            
            logger.info(f"Deduplicated {len(group_models)} variants of {base_name}, selected: {best_model.id}")
    
    return deduplicated_models

def extract_base_model_name(model_id: str) -> str:
    """Extract base model name for grouping similar models."""
    model_lower = model_id.lower()
    
    # GPT models
    if 'gpt-4o' in model_lower:
        return 'gpt-4o'
    elif 'gpt-4-turbo' in model_lower:
        return 'gpt-4-turbo'
    elif 'gpt-4' in model_lower:
        return 'gpt-4'
    elif 'gpt-3.5' in model_lower:
        return 'gpt-3.5-turbo'
    elif 'chatgpt' in model_lower:
        return 'chatgpt'
    
    # Claude models
    elif 'claude-3-5-sonnet' in model_lower:
        return 'claude-3.5-sonnet'
    elif 'claude-3-5-haiku' in model_lower:
        return 'claude-3.5-haiku'
    elif 'claude-3-opus' in model_lower:
        return 'claude-3-opus'
    elif 'claude-3-sonnet' in model_lower:
        return 'claude-3-sonnet'
    elif 'claude-3-haiku' in model_lower:
        return 'claude-3-haiku'
    
    # Gemini models
    elif 'gemini-1.5-pro' in model_lower:
        return 'gemini-1.5-pro'
    elif 'gemini-1.5-flash' in model_lower:
        return 'gemini-1.5-flash'
    elif 'gemini-pro' in model_lower:
        return 'gemini-pro'
    
    # Default: return the model ID as-is
    return model_id

def select_best_model_variant(models: List[UnifiedModelInfo]) -> UnifiedModelInfo:
    """
    Select the best variant from a group of similar models.
    
    Priority order:
    1. Highest relevance score
    2. Is recommended
    3. Is default
    4. Shortest/cleanest name (indicates canonical version)
    """
    
    return max(models, key=lambda m: (
        m.relevance_score if m.relevance_score else 0,  # Higher relevance first
        1 if m.is_recommended else 0,                   # Recommended first
        1 if m.is_default else 0,                       # Default first
        -len(m.id),                                     # Shorter names first (canonical)
        -ord(m.id[0]) if m.id else 0                    # Alphabetical tie-breaker
    ))

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
            "get_models": "/chat/models/{config_id}",
            "get_dynamic_models": "/chat/models/{config_id}/dynamic",
            "get_all_models": "/chat/all-models"  # 🆕 NEW: Unified models from all providers
        },
        "new_features": {
            "dynamic_models": "Real-time model fetching from OpenAI and other providers",
            "model_caching": "1-hour intelligent caching to reduce API calls",
            "graceful_fallback": "Falls back to configuration models if provider API fails"
        }
    }
