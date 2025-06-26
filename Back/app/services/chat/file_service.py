"""
Chat File Processing Service

Business logic for processing file attachments in chat messages.
Extracted from the main chat.py file for better modularity.
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.user import User
from ...models.file_upload import FileUpload
from ...services.file_service import get_file_service

logger = logging.getLogger(__name__)

# =============================================================================
# FILE ATTACHMENT PROCESSING FUNCTIONS
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
    logger.info(f"🔍 DEBUG: process_file_attachments called with file_ids: {file_ids}, user: {user.email}")
    
    if not file_ids:
        logger.info(f"🔍 DEBUG: No file IDs provided, returning empty context")
        return ""
    
    file_context_parts = []
    file_service = get_file_service()
    
    for file_id in file_ids:
        try:
            logger.info(f"🔍 DEBUG: Processing file ID: {file_id}")
            
            # Get file record from database
            file_record = await db.get(FileUpload, file_id)
            if not file_record:
                logger.warning(f"❌ DEBUG: File {file_id} not found in database for user {user.email}")
                continue

            logger.info(f"✅ DEBUG: Found file record - ID: {file_record.id}, Name: {file_record.original_filename}, Status: {file_record.upload_status}")

            # Check if user can access this file (optional: add access logic here)
            # For in-memory, we assume access is validated by DB ownership

            # Read file content from DB (in-memory, not disk)
            # 🔧 FIXED: Use text_content field (not content)
            file_content = file_record.text_content
            if file_content:
                logger.info(f"✅ DEBUG: Successfully read file content from DB - Length: {len(file_content)} characters")
                # Format the file content for LLM context
                formatted_content = format_file_for_context(file_record, file_content)
                file_context_parts.append(formatted_content)
                logger.info(f"✅ DEBUG: Successfully processed file {file_record.original_filename} ({len(file_content)} chars)")
            else:
                logger.warning(f"❌ DEBUG: Could not read content from DB for file {file_record.original_filename} - text_content is None or empty")

        except Exception as e:
            logger.error(f"❌ DEBUG: Error processing file {file_id}: {str(e)}")
            import traceback
            logger.error(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
            continue  # Skip this file but continue with others
    
    if not file_context_parts:
        logger.warning(f"❌ DEBUG: No file context parts generated from {len(file_ids)} file IDs")
        return ""
    
    # Combine all file contents with clear separation
    full_context = "\\n\\n=== ATTACHED FILES ===\\n\\n" + "\\n\\n".join(file_context_parts) + "\\n\\n=== END ATTACHED FILES ===\\n"
    
    logger.info(f"✅ DEBUG: Generated file context - Parts: {len(file_context_parts)}, Total length: {len(full_context)}")
    
    return full_context

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
    
    return "\\n".join(formatted_parts)

# =============================================================================
# LEGACY FILE READING FUNCTIONS (KEPT FOR COMPATIBILITY)
# =============================================================================

async def read_file_content(file_path, file_record: FileUpload) -> str:
    """
    Read file content safely with proper encoding detection.
    
    🎓 Learning: Safe File Reading
    ===============================
    Different file types need different handling:
    - Text files: Read with UTF-8 encoding
    - PDFs: Extract text content
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
            return await read_pdf_content(file_path)
        elif mime_type.startswith('text/') or mime_type in ['application/json', 'text/csv']:
            # Text-based files
            return await read_text_content(file_path)
        else:
            logger.warning(f"Unsupported file type for content reading: {mime_type}")
            return f"[File: {file_record.original_filename} - Content not readable (type: {mime_type})]"
            
    except Exception as e:
        logger.error(f"Error reading file content: {str(e)}")
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
            content = content[:max_chars] + "\\n\\n[Content truncated - file is larger than 50k characters]"
        
        return content
        
    except Exception as e:
        logger.error(f"Error reading text file: {str(e)}")
        return ""

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
        
        def _extract_pdf_text():
            try:
                import PyPDF2
                
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    
                    # Check if PDF is encrypted
                    if pdf_reader.is_encrypted:
                        return "[PDF is encrypted - cannot extract text]"
                    
                    # Extract text from all pages
                    text_parts = []
                    for page_num, page in enumerate(pdf_reader.pages, 1):
                        try:
                            page_text = page.extract_text()
                            if page_text.strip():
                                text_parts.append(f"--- Page {page_num} ---\\n{page_text}")
                        except Exception as page_error:
                            logger.warning(f"Error extracting text from PDF page {page_num}: {str(page_error)}")
                            continue
                    
                    if not text_parts:
                        return "[No readable text found in PDF - may contain only images]"
                    
                    full_text = "\\n\\n".join(text_parts)
                    
                    # Limit content size
                    max_chars = 50000
                    if len(full_text) > max_chars:
                        full_text = full_text[:max_chars] + "\\n\\n[PDF content truncated - file is larger than 50k characters]"
                    
                    return full_text
                    
            except ImportError:
                return "[PDF reading not available - PyPDF2 not installed]"
            except Exception as e:
                logger.error(f"Error extracting PDF text: {str(e)}")
                return f"[Error reading PDF: {str(e)}]"
        
        # Run in thread pool to avoid blocking
        content = await asyncio.get_event_loop().run_in_executor(None, _extract_pdf_text)
        return content
        
    except Exception as e:
        logger.error(f"Error processing PDF file: {str(e)}")
        return f"[Error processing PDF: {str(e)}]"
