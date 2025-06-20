"""
File Processing Service for AI Dock Application.

This service processes uploaded text files and prepares their content for AI consumption
in chat conversations. It handles content extraction, validation, and formatting to
create meaningful context for LLM interactions.

🎓 LEARNING: AI-First File Processing
===================================
Traditional file processing focuses on human consumption.
AI file processing optimizes for machine understanding:

1. **Content Structure**: Extract meaning, not just text
2. **Context Building**: Add metadata for AI comprehension  
3. **Safety First**: Validate encoding, size, content safety
4. **Format Consistency**: Standardize diverse file types
5. **Error Recovery**: Handle corruption gracefully

Real-World Example:
- User uploads "sales_data.csv" with 1000 rows
- Service extracts: "CSV file with sales data, 1000 rows, columns: date, product, revenue"
- AI gets meaningful context instead of raw CSV text
- User can ask: "What are the trends?" and AI understands the data structure
"""

import os
import csv
import json
import chardet
import logging
import pdfplumber
import magic
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
from datetime import datetime
from io import StringIO, BytesIO

# 📘 Word Document Processing Libraries
from docx import Document
import docx2txt
import mammoth
import olefile

# Internal imports
from ..schemas.chat import (
    ProcessedFileContent, 
    ContentType, 
    FileProcessingStatus
)
from ..models.file_upload import FileUpload
from ..core.config import settings

# Set up logging
logger = logging.getLogger(__name__)


class FileProcessingError(Exception):
    """
    Custom exception for file processing errors.
    
    🎓 LEARNING: Custom Exception Classes
    ===================================
    Create specific exceptions for different error types:
    - Better error handling in calling code
    - More informative error messages
    - Easier debugging and logging
    - Allows different retry strategies
    """
    def __init__(self, message: str, file_id: Optional[int] = None, error_type: str = "processing_error"):
        self.message = message
        self.file_id = file_id
        self.error_type = error_type
        super().__init__(self.message)


class ContentValidationError(FileProcessingError):
    """Raised when file content fails validation."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "content_validation_error")


class EncodingDetectionError(FileProcessingError):
    """Raised when file encoding cannot be detected or decoded."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "encoding_error")


class FileTooLargeError(FileProcessingError):
    """Raised when file content is too large for AI processing."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "file_too_large")


class PDFProcessingError(FileProcessingError):
    """
    Custom exception for PDF processing errors.
    
    🎓 LEARNING: PDF-Specific Error Handling
    =======================================
    PDFs have unique challenges:
    - Password protection
    - Corrupted files
    - No extractable text (image-only PDFs)
    - Complex layouts that confuse text extraction
    
    Specific error types help provide better user feedback.
    """
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "pdf_processing_error")


class PDFPasswordProtectedError(PDFProcessingError):
    """Raised when PDF is password-protected."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "pdf_password_protected")


class PDFCorruptedError(PDFProcessingError):
    """Raised when PDF file is corrupted or invalid."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "pdf_corrupted")


class PDFNoTextError(PDFProcessingError):
    """Raised when PDF contains no extractable text (image-only)."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "pdf_no_text")


class WordProcessingError(FileProcessingError):
    """
    Custom exception for Word document processing errors.
    
    🎓 LEARNING: Word-Specific Error Handling
    ========================================
    Word documents have unique challenges similar to PDFs:
    - Password protection
    - Corrupted files
    - Unsupported Word formats (.doc vs .docx)
    - Complex embedded content (macros, objects)
    - Very large documents with complex formatting
    
    Specific error types help provide better user feedback.
    """
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "word_processing_error")


class WordPasswordProtectedError(WordProcessingError):
    """Raised when Word document is password-protected."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "word_password_protected")


class WordCorruptedError(WordProcessingError):
    """Raised when Word document is corrupted or invalid."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "word_corrupted")


class WordUnsupportedFormatError(WordProcessingError):
    """Raised when Word document format is not supported."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "word_unsupported_format")


class WordMacroContentError(WordProcessingError):
    """Raised when Word document contains macros or embedded content that cannot be processed."""
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "word_macro_content")


class FileProcessorService:
    """
    Service for processing text files for AI consumption.
    
    🎓 LEARNING: Service Architecture
    ================================
    This service follows the Single Responsibility Principle:
    - Only handles file content processing
    - Doesn't manage file uploads (that's file_service.py)
    - Doesn't handle chat logic (that's chat.py)
    - Clear input/output interfaces
    
    This makes it:
    - Easy to test in isolation
    - Reusable across different features
    - Simple to modify without breaking other parts
    """
    
    def __init__(self):
        """Initialize the file processor with configuration."""
        
        # Maximum content size for AI processing (50KB default)
        self.max_content_size = getattr(settings, 'max_ai_content_size', 50 * 1024)
        
        # Maximum preview length for UI (200 chars default)
        self.preview_length = getattr(settings, 'file_content_preview_length', 200)
        
        # Supported MIME types for text processing
        self.supported_mime_types = {
            'text/plain': ContentType.PLAIN_TEXT,
            'text/markdown': ContentType.PLAIN_TEXT,
            'text/csv': ContentType.STRUCTURED_DATA,
            'application/json': ContentType.STRUCTURED_DATA,
            'text/x-python': ContentType.CODE,
            'text/javascript': ContentType.CODE,
            'text/html': ContentType.MARKUP,
            'application/xml': ContentType.MARKUP,
            'text/xml': ContentType.MARKUP,
            'application/pdf': ContentType.STRUCTURED_DATA,  # PDF support
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ContentType.STRUCTURED_DATA,  # 📘 NEW: .docx support!
            'application/msword': ContentType.STRUCTURED_DATA  # 📘 NEW: .doc support!
        }
        
        # PDF-specific processing settings
        self.max_pdf_size = getattr(settings, 'max_pdf_size', 25 * 1024 * 1024)  # 25MB
        self.max_pdf_pages = getattr(settings, 'max_pdf_pages', 50)  # Max pages to process
        self.max_extracted_text = getattr(settings, 'max_extracted_text', 100 * 1024)  # 100KB text limit
        
        # 📘 Word document processing settings
        self.max_word_size = getattr(settings, 'max_word_size', 20 * 1024 * 1024)  # 20MB for Word docs
        self.max_word_pages = getattr(settings, 'max_word_pages', 100)  # Max pages to process
        self.max_word_text = getattr(settings, 'max_word_text', 150 * 1024)  # 150KB text limit (Word is usually more text-dense)
        
        # Encoding detection settings
        self.encoding_confidence_threshold = 0.7
        self.fallback_encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        
        logger.info(f"FileProcessorService initialized - max content: {self.max_content_size} bytes, Word: {self.max_word_size} bytes")
    
    # =============================================================================
    # MAIN PROCESSING METHODS
    # =============================================================================
    
    async def process_text_file(
        self, 
        file_upload: FileUpload,
        include_metadata: bool = True
    ) -> ProcessedFileContent:
        """
        Main method to process a file for AI consumption.
        
        🎓 LEARNING: Unified File Processing
        ==================================
        This method now handles both text files AND PDFs:
        
        **Text Files Pipeline:**
        1. Read as text with encoding detection
        2. Extract content based on file type
        3. Validate and format for AI
        
        **PDF Files Pipeline:**
        1. Process as binary file
        2. Extract text using specialized PDF tools
        3. Include document metadata and structure
        
        The method automatically routes to the right processor!
        
        Args:
            file_upload: FileUpload model instance
            include_metadata: Whether to include additional metadata
            
        Returns:
            ProcessedFileContent with AI-ready content
            
        Raises:
            FileProcessingError: If processing fails at any stage
        """
        try:
            logger.info(f"Processing file {file_upload.id}: {file_upload.filename}")
            
            # Route to specialized processors based on file type
            if file_upload.mime_type == 'application/pdf':
                logger.info(f"Routing PDF {file_upload.filename} to PDF processor")
                return await self.process_pdf_file(file_upload, include_metadata)
            
            # 📘 NEW: Route Word documents to specialized processor
            elif file_upload.mime_type in [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword'
            ]:
                logger.info(f"Routing Word document {file_upload.filename} to Word processor")
                return await self.process_word_file(file_upload, include_metadata)
            
            # Original text file processing pipeline
            # Step 1: Validate file can be processed
            self._validate_file_for_processing(file_upload)
            
            # Step 2: Read and decode file content
            raw_content = await self._read_file_content(file_upload)
            
            # Step 3: Extract structured content based on file type
            extracted_content = self._extract_content_by_type(
                raw_content, 
                file_upload.mime_type, 
                file_upload.filename
            )
            
            # Step 4: Validate content safety and size
            validated_content = self._validate_content(extracted_content, file_upload)
            
            # Step 5: Format content for AI consumption
            ai_formatted_content = self._format_for_ai(
                validated_content,
                file_upload.filename,
                file_upload.mime_type,
                include_metadata
            )
            
            # Step 6: Check if truncation is needed
            final_content, is_truncated, truncation_info = self._handle_content_size(
                ai_formatted_content,
                file_upload.filename
            )
            
            # Step 7: Create metadata
            metadata = self._create_content_metadata(
                raw_content,
                file_upload,
                include_metadata
            ) if include_metadata else None
            
            # Step 8: Build final processed content
            processed_content = ProcessedFileContent(
                file_id=file_upload.id,
                filename=file_upload.filename,
                content_type=self.supported_mime_types.get(
                    file_upload.mime_type, 
                    ContentType.PLAIN_TEXT
                ),
                processed_content=final_content,
                content_length=len(final_content),
                is_truncated=is_truncated,
                truncation_info=truncation_info,
                metadata=metadata,
                processed_at=datetime.utcnow()
            )
            
            logger.info(f"Successfully processed file {file_upload.id} - {len(final_content)} chars")
            return processed_content
            
        except FileProcessingError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error processing file {file_upload.id}: {str(e)}")
            raise FileProcessingError(
                f"Unexpected error processing {file_upload.filename}: {str(e)}",
                file_upload.id,
                "unexpected_error"
            )
    
    def extract_content_preview(self, content: str, filename: str) -> str:
        """
        Extract a preview of file content for UI display.
        
        🎓 LEARNING: Preview Generation
        =============================
        Previews help users understand file content without full processing:
        - Show first N characters intelligently
        - Preserve line breaks for readability
        - Add truncation indicator if needed
        - Handle different content types appropriately
        
        Args:
            content: Full content string
            filename: Original filename for context
            
        Returns:
            Preview string (max 200 chars by default)
        """
        if not content:
            return "(Empty file)"
        
        # Clean content for preview
        clean_content = content.strip()
        
        if len(clean_content) <= self.preview_length:
            return clean_content
        
        # Truncate but try to end at a natural break
        truncated = clean_content[:self.preview_length]
        
        # Try to end at word boundary
        if ' ' in truncated:
            last_space = truncated.rfind(' ')
            if last_space > self.preview_length * 0.7:  # Don't truncate too much
                truncated = truncated[:last_space]
        
        # Try to end at line break
        if '\n' in truncated:
            last_newline = truncated.rfind('\n')
            if last_newline > self.preview_length * 0.5:
                truncated = truncated[:last_newline]
        
        return truncated + "..."
    
    def validate_content_safety(self, content: str, filename: str) -> Tuple[bool, Optional[str]]:
        """
        Validate content for basic safety and appropriateness.
        
        🎓 LEARNING: Content Safety Validation
        =====================================
        Basic safety checks for file content:
        1. Size limits (prevent memory issues)
        2. Character validation (detect binary content)
        3. Suspicious patterns (potential malware indicators)
        4. Content structure validation
        
        This is NOT comprehensive security scanning - just basic validation
        to prevent common issues and provide better error messages.
        
        Args:
            content: Content to validate
            filename: Original filename for context
            
        Returns:
            Tuple of (is_safe, error_message)
        """
        try:
            # Check for extremely large content
            if len(content) > self.max_content_size * 2:  # 2x limit for safety check
                return False, f"Content too large: {len(content)} chars (max {self.max_content_size * 2})"
            
            # Check for binary content indicators
            if self._appears_to_be_binary(content):
                return False, "Content appears to be binary data, not text"
            
            # Check for suspicious patterns (basic)
            if self._contains_suspicious_patterns(content):
                return False, "Content contains patterns that may be unsafe"
            
            # Check for valid text structure
            if not self._has_valid_text_structure(content):
                return False, "Content structure appears invalid for text processing"
            
            return True, None
            
        except Exception as e:
            logger.warning(f"Error during content safety validation: {str(e)}")
            return False, f"Safety validation failed: {str(e)}"
    
    # =============================================================================
    # CONTENT EXTRACTION BY FILE TYPE
    # =============================================================================
    
    def _extract_content_by_type(
        self, 
        raw_content: str, 
        mime_type: str, 
        filename: str
    ) -> str:
        """
        Extract and structure content based on file type.
        
        🎓 LEARNING: Type-Specific Processing
        ===================================
        Different file types need different processing:
        - Plain text: Just clean and validate
        - CSV: Parse structure, show sample data
        - JSON: Parse, validate, show structure
        - Markdown: Preserve formatting hints
        - Code: Add language context
        
        This gives AI much better context than raw file content.
        """
        mime_type_lower = mime_type.lower()
        
        try:
            if mime_type_lower == 'text/csv':
                return self._extract_csv_content(raw_content, filename)
            elif mime_type_lower == 'application/json':
                return self._extract_json_content(raw_content, filename)
            elif mime_type_lower == 'text/markdown':
                return self._extract_markdown_content(raw_content, filename)
            elif mime_type_lower in ['text/x-python', 'text/javascript']:
                return self._extract_code_content(raw_content, filename, mime_type)
            elif mime_type_lower in ['text/html', 'application/xml', 'text/xml']:
                return self._extract_markup_content(raw_content, filename, mime_type)
            else:
                # Default: plain text processing
                return self._extract_plain_text_content(raw_content, filename)
                
        except Exception as e:
            logger.warning(f"Type-specific extraction failed for {filename}: {str(e)}")
            # Fallback to plain text
            return self._extract_plain_text_content(raw_content, filename)
    
    def _extract_csv_content(self, content: str, filename: str) -> str:
        """
        Extract structured information from CSV content.
        
        🎓 LEARNING: CSV Processing for AI
        =================================
        Instead of giving AI raw CSV data, we provide:
        - Column names and count
        - Row count
        - Sample data (first few rows)
        - Data type hints
        - Structure overview
        
        This helps AI understand the data structure and provide better analysis.
        """
        try:
            # Parse CSV to understand structure
            csv_reader = csv.reader(StringIO(content))
            rows = list(csv_reader)
            
            if not rows:
                return f"CSV File: {filename}\n(Empty CSV file)"
            
            # Get header and data rows
            headers = rows[0] if rows else []
            data_rows = rows[1:] if len(rows) > 1 else []
            
            # Build structured description
            description_parts = [
                f"CSV File: {filename}",
                f"Columns ({len(headers)}): {', '.join(headers)}" if headers else "No headers detected",
                f"Data rows: {len(data_rows)}"
            ]
            
            # Add sample data (first 3-5 rows)
            if data_rows:
                description_parts.append("\nSample data:")
                sample_rows = data_rows[:min(5, len(data_rows))]
                
                for i, row in enumerate(sample_rows):
                    # Format row nicely
                    if len(headers) == len(row):
                        # Show as key: value pairs
                        row_data = ", ".join(f"{headers[j]}: {row[j]}" for j in range(len(row)))
                    else:
                        # Just show values
                        row_data = ", ".join(row)
                    
                    description_parts.append(f"Row {i+1}: {row_data}")
                
                if len(data_rows) > 5:
                    description_parts.append(f"... ({len(data_rows) - 5} more rows)")
            
            # Add data type hints if possible
            if data_rows and headers:
                description_parts.append("\nColumn types (inferred):")
                for j, header in enumerate(headers):
                    if j < len(data_rows[0]):
                        sample_value = data_rows[0][j]
                        inferred_type = self._infer_csv_column_type(sample_value)
                        description_parts.append(f"  {header}: {inferred_type}")
            
            return "\n".join(description_parts)
            
        except Exception as e:
            logger.warning(f"CSV parsing failed for {filename}: {str(e)}")
            # Fallback: show first few lines as plain text
            lines = content.split('\n')[:10]
            return f"CSV File: {filename}\n(Could not parse as CSV, showing first lines)\n\n" + '\n'.join(lines)
    
    def _extract_json_content(self, content: str, filename: str) -> str:
        """
        Extract structured information from JSON content.
        """
        try:
            # Parse JSON to understand structure
            data = json.loads(content)
            
            # Build description
            description_parts = [
                f"JSON File: {filename}",
                f"Type: {type(data).__name__}"
            ]
            
            # Describe structure based on type
            if isinstance(data, dict):
                description_parts.append(f"Keys ({len(data)}): {', '.join(list(data.keys())[:10])}")
                if len(data) > 10:
                    description_parts.append(f"... ({len(data) - 10} more keys)")
                
                # Show sample key-value pairs
                if data:
                    description_parts.append("\nSample data:")
                    for i, (key, value) in enumerate(list(data.items())[:5]):
                        value_preview = str(value)[:100]
                        if len(str(value)) > 100:
                            value_preview += "..."
                        description_parts.append(f"  {key}: {value_preview}")
                        
            elif isinstance(data, list):
                description_parts.append(f"Array length: {len(data)}")
                if data:
                    first_item = data[0]
                    description_parts.append(f"Item type: {type(first_item).__name__}")
                    
                    # If array of objects, show structure
                    if isinstance(first_item, dict):
                        description_parts.append(f"Object keys: {', '.join(first_item.keys())}")
                    
                    # Show sample items
                    description_parts.append("\nSample items:")
                    for i, item in enumerate(data[:3]):
                        item_preview = str(item)[:100]
                        if len(str(item)) > 100:
                            item_preview += "..."
                        description_parts.append(f"  [{i}]: {item_preview}")
            else:
                # Simple value
                value_preview = str(data)[:500]
                if len(str(data)) > 500:
                    value_preview += "..."
                description_parts.append(f"Value: {value_preview}")
            
            return "\n".join(description_parts)
            
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parsing failed for {filename}: {str(e)}")
            return f"JSON File: {filename}\n(Invalid JSON format: {str(e)})\n\nContent preview:\n{content[:500]}"
        except Exception as e:
            logger.warning(f"JSON processing failed for {filename}: {str(e)}")
            return f"JSON File: {filename}\n(Processing error: {str(e)})\n\nContent preview:\n{content[:500]}"
    
    def _extract_markdown_content(self, content: str, filename: str) -> str:
        """
        Extract content from Markdown files with structure hints.
        """
        try:
            description_parts = [f"Markdown File: {filename}"]
            
            lines = content.split('\n')
            
            # Extract headings for structure overview
            headings = []
            for line in lines:
                stripped = line.strip()
                if stripped.startswith('#'):
                    level = len(stripped) - len(stripped.lstrip('#'))
                    heading_text = stripped.lstrip('#').strip()
                    headings.append(f"{'  ' * (level-1)}• {heading_text}")
            
            if headings:
                description_parts.append("Document structure:")
                description_parts.extend(headings[:10])
                if len(headings) > 10:
                    description_parts.append(f"... ({len(headings) - 10} more headings)")
            
            # Add content preview (preserve some markdown formatting)
            description_parts.append("\nContent:")
            description_parts.append(content)
            
            return "\n".join(description_parts)
            
        except Exception as e:
            logger.warning(f"Markdown processing failed for {filename}: {str(e)}")
            return f"Markdown File: {filename}\n\n{content}"
    
    def _extract_code_content(self, content: str, filename: str, mime_type: str) -> str:
        """
        Extract content from code files with language context.
        """
        try:
            # Determine language
            language_map = {
                'text/x-python': 'Python',
                'text/javascript': 'JavaScript'
            }
            language = language_map.get(mime_type, 'Unknown')
            
            description_parts = [
                f"Code File: {filename}",
                f"Language: {language}",
                f"Lines: {len(content.split('\n'))}"
            ]
            
            # Add basic code analysis
            lines = content.split('\n')
            
            # Count non-empty lines
            non_empty_lines = [line for line in lines if line.strip()]
            comment_lines = [line for line in lines if line.strip().startswith('#') or line.strip().startswith('//')]
            
            description_parts.append(f"Code lines: {len(non_empty_lines)}")
            description_parts.append(f"Comment lines: {len(comment_lines)}")
            
            # Add full content
            description_parts.append("\nCode content:")
            description_parts.append(content)
            
            return "\n".join(description_parts)
            
        except Exception as e:
            logger.warning(f"Code processing failed for {filename}: {str(e)}")
            return f"Code File: {filename}\n\n{content}"
    
    def _extract_markup_content(self, content: str, filename: str, mime_type: str) -> str:
        """
        Extract content from HTML/XML files with structure hints.
        """
        try:
            file_type = "HTML" if "html" in mime_type else "XML"
            
            description_parts = [
                f"{file_type} File: {filename}",
                f"Content length: {len(content)} characters"
            ]
            
            # Basic structure analysis (simplified)
            if "html" in mime_type.lower():
                # Count common HTML elements
                common_tags = ['div', 'p', 'h1', 'h2', 'h3', 'table', 'ul', 'ol']
                for tag in common_tags:
                    count = content.lower().count(f'<{tag}')
                    if count > 0:
                        description_parts.append(f"  <{tag}> elements: {count}")
            
            # Add content preview
            description_parts.append(f"\n{file_type} content:")
            description_parts.append(content)
            
            return "\n".join(description_parts)
            
        except Exception as e:
            logger.warning(f"Markup processing failed for {filename}: {str(e)}")
            return f"Markup File: {filename}\n\n{content}"
    
    def _extract_plain_text_content(self, content: str, filename: str) -> str:
        """
        Extract content from plain text files.
        """
        try:
            lines = content.split('\n')
            
            description_parts = [
                f"Text File: {filename}",
                f"Lines: {len(lines)}",
                f"Characters: {len(content)}"
            ]
            
            # Add word count
            words = content.split()
            description_parts.append(f"Words: {len(words)}")
            
            # Add content
            description_parts.append("\nContent:")
            description_parts.append(content)
            
            return "\n".join(description_parts)
            
        except Exception as e:
            logger.warning(f"Plain text processing failed for {filename}: {str(e)}")
            return content
    
    # =============================================================================
    # PDF PROCESSING METHODS  🎯 NEW SECTION!
    # =============================================================================
    
    async def _extract_pdf_content(self, file_upload: FileUpload) -> str:
        """
        Extract structured information from PDF content.
        
        🎓 LEARNING: PDF Processing for AI
        =================================
        PDFs are complex documents that need special handling:
        1. **Binary Processing**: PDFs are binary files, not text
        2. **Text Extraction**: Use specialized libraries (pdfplumber)
        3. **Page-by-Page**: Process each page separately
        4. **Metadata Extraction**: Get document info (author, title, etc.)
        5. **Error Handling**: Handle password-protected, corrupted files
        
        This gives AI much richer context than just raw text.
        """
        try:
            logger.info(f"Starting PDF processing for {file_upload.filename}")
            
            # Extract text and metadata from PDF
            pdf_data = await self.extract_pdf_text(file_upload.file_path)
            
            # Build structured description for AI
            description_parts = [
                f"PDF Document: {file_upload.filename}",
                f"Pages: {pdf_data['page_count']}",
                f"Extracted text length: {len(pdf_data['text'])} characters"
            ]
            
            # Add metadata if available
            if pdf_data['metadata']:
                metadata = pdf_data['metadata']
                description_parts.append("\nDocument Information:")
                
                if metadata.get('title'):
                    description_parts.append(f"  Title: {metadata['title']}")
                if metadata.get('author'):
                    description_parts.append(f"  Author: {metadata['author']}")
                if metadata.get('creation_date'):
                    description_parts.append(f"  Created: {metadata['creation_date']}")
                if metadata.get('subject'):
                    description_parts.append(f"  Subject: {metadata['subject']}")
            
            # Add page information for multi-page documents
            if pdf_data['page_count'] > 1 and len(pdf_data['pages']) > 1:
                description_parts.append("\nPage Structure:")
                for i, page_info in enumerate(pdf_data['pages'][:5]):  # Show first 5 pages
                    page_text_length = len(page_info['text'])
                    description_parts.append(f"  Page {page_info['page_num']}: {page_text_length} characters")
                
                if len(pdf_data['pages']) > 5:
                    description_parts.append(f"  ... and {len(pdf_data['pages']) - 5} more pages")
            
            # Add the extracted text content
            description_parts.append("\nExtracted Content:")
            description_parts.append("-" * 50)
            
            # Handle large text content - truncate if necessary
            extracted_text = pdf_data['text']
            if len(extracted_text) > self.max_extracted_text:
                # Smart truncation for large PDFs
                keep_start = int(self.max_extracted_text * 0.7)  # 70% from beginning
                keep_end = int(self.max_extracted_text * 0.2)    # 20% from end
                
                truncation_msg = f"\n\n[... PDF content truncated - {len(extracted_text) - keep_start - keep_end} characters hidden from middle ...]\n"
                
                extracted_text = extracted_text[:keep_start] + truncation_msg + extracted_text[-keep_end:] if keep_end > 0 else extracted_text[:keep_start] + truncation_msg
                
                description_parts.append(f"(Showing {len(extracted_text)} of {len(pdf_data['text'])} total characters)")
            
            description_parts.append(extracted_text)
            description_parts.append("-" * 50)
            
            logger.info(f"Successfully processed PDF {file_upload.filename} - {len(extracted_text)} chars extracted")
            return "\n".join(description_parts)
            
        except PDFProcessingError:
            # Re-raise PDF-specific errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error processing PDF {file_upload.filename}: {str(e)}")
            raise PDFProcessingError(
                f"Failed to process PDF {file_upload.filename}: {str(e)}",
                file_upload.id
            )
    
    async def extract_pdf_text(self, file_path: str) -> Dict[str, Any]:
        """
        Extract text from PDF file using pdfplumber.
        
        🎓 LEARNING: PDF Text Extraction
        ==================================
        PDF text extraction is complex because:
        1. **Layout Preservation**: Text might be in columns, tables
        2. **Font Encoding**: Different fonts encode text differently  
        3. **Image Text**: Some PDFs have text as images (not extractable)
        4. **Password Protection**: Need to handle encrypted PDFs
        5. **Corruption**: PDFs can be partially damaged
        
        pdfplumber is excellent because it:
        - Handles complex layouts well
        - Preserves table structure
        - Provides detailed character/word positioning
        - Has good error handling
        
        Returns:
            Dict with extracted text, metadata, and page-by-page content
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise PDFProcessingError(f"PDF file not found: {file_path}")
        
        # Verify it's actually a PDF using python-magic
        try:
            file_mime = magic.from_file(str(file_path), mime=True)
            if file_mime != 'application/pdf':
                raise PDFCorruptedError(f"File is not a valid PDF (detected: {file_mime})")
        except Exception as e:
            logger.warning(f"Could not verify PDF MIME type: {str(e)}")
            # Continue anyway - might still be a valid PDF
        
        extracted_data = {
            'text': '',
            'page_count': 0,
            'metadata': {},
            'pages': []
        }
        
        try:
            with pdfplumber.open(file_path) as pdf:
                # Extract metadata first
                extracted_data['metadata'] = self.get_pdf_metadata(pdf)
                extracted_data['page_count'] = len(pdf.pages)
                
                logger.info(f"Processing PDF with {len(pdf.pages)} pages")
                
                # Check page limit
                pages_to_process = min(len(pdf.pages), self.max_pdf_pages)
                if pages_to_process < len(pdf.pages):
                    logger.warning(f"PDF has {len(pdf.pages)} pages, processing only first {pages_to_process}")
                
                all_text_parts = []
                
                # Extract text from each page
                for page_num in range(pages_to_process):
                    try:
                        page = pdf.pages[page_num]
                        page_text = page.extract_text()
                        
                        if page_text:
                            # Clean and normalize the text
                            cleaned_text = self._clean_pdf_text(page_text)
                            
                            if cleaned_text.strip():  # Only add if there's actual content
                                all_text_parts.append(cleaned_text)
                                
                                # Store page-specific info
                                extracted_data['pages'].append({
                                    'page_num': page_num + 1,
                                    'text': cleaned_text,
                                    'char_count': len(cleaned_text)
                                })
                            else:
                                # Page has no extractable text
                                extracted_data['pages'].append({
                                    'page_num': page_num + 1,
                                    'text': '',
                                    'char_count': 0,
                                    'note': 'No extractable text (may contain only images)'
                                })
                        else:
                            # Page extraction returned None/empty
                            extracted_data['pages'].append({
                                'page_num': page_num + 1,
                                'text': '',
                                'char_count': 0,
                                'note': 'Page extraction failed'
                            })
                            
                    except Exception as e:
                        logger.warning(f"Failed to extract text from page {page_num + 1}: {str(e)}")
                        extracted_data['pages'].append({
                            'page_num': page_num + 1,
                            'text': '',
                            'char_count': 0,
                            'error': str(e)
                        })
                        continue
                
                # Combine all page texts
                if all_text_parts:
                    extracted_data['text'] = '\n\n'.join(all_text_parts)
                else:
                    # No text was extracted from any page
                    raise PDFNoTextError(
                        f"No extractable text found in PDF {file_path.name}. "
                        "This may be an image-only PDF or contain non-standard text encoding."
                    )
                
                logger.info(f"Successfully extracted {len(extracted_data['text'])} characters from {len(extracted_data['pages'])} pages")
                return extracted_data
                
        except PDFProcessingError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            error_msg = str(e).lower()
            
            # Handle common PDF errors with specific exceptions
            if 'password' in error_msg or 'encrypted' in error_msg:
                raise PDFPasswordProtectedError(
                    f"PDF {file_path.name} is password-protected. Please provide an unlocked version."
                )
            elif 'damaged' in error_msg or 'corrupt' in error_msg or 'invalid' in error_msg:
                raise PDFCorruptedError(
                    f"PDF {file_path.name} appears to be corrupted. Please try uploading again."
                )
            else:
                raise PDFProcessingError(
                    f"Failed to process PDF {file_path.name}: {str(e)}"
                )
    
    def get_pdf_metadata(self, pdf) -> Dict[str, Any]:
        """
        Extract metadata from PDF document.
        
        🎓 LEARNING: PDF Metadata
        ===========================
        PDF metadata provides valuable context:
        - **Title**: Document title (if set)
        - **Author**: Who created it
        - **Subject**: Document topic/summary
        - **Creator**: Software used to create PDF
        - **Creation Date**: When it was made
        - **Modification Date**: Last updated
        
        This helps AI understand document context and purpose.
        """
        metadata = {}
        
        try:
            # Access PDF metadata
            pdf_metadata = pdf.metadata or {}
            
            # Extract common metadata fields
            if pdf_metadata.get('/Title'):
                metadata['title'] = str(pdf_metadata['/Title']).strip()
            
            if pdf_metadata.get('/Author'):
                metadata['author'] = str(pdf_metadata['/Author']).strip()
            
            if pdf_metadata.get('/Subject'):
                metadata['subject'] = str(pdf_metadata['/Subject']).strip()
            
            if pdf_metadata.get('/Creator'):
                metadata['creator'] = str(pdf_metadata['/Creator']).strip()
            
            if pdf_metadata.get('/Producer'):
                metadata['producer'] = str(pdf_metadata['/Producer']).strip()
            
            # Handle creation date
            if pdf_metadata.get('/CreationDate'):
                try:
                    # PDF dates are in a special format, try to parse
                    creation_date = pdf_metadata['/CreationDate']
                    if hasattr(creation_date, 'strftime'):
                        metadata['creation_date'] = creation_date.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        metadata['creation_date'] = str(creation_date)
                except Exception:
                    metadata['creation_date'] = str(pdf_metadata['/CreationDate'])
            
            # Handle modification date
            if pdf_metadata.get('/ModDate'):
                try:
                    mod_date = pdf_metadata['/ModDate']
                    if hasattr(mod_date, 'strftime'):
                        metadata['modification_date'] = mod_date.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        metadata['modification_date'] = str(mod_date)
                except Exception:
                    metadata['modification_date'] = str(pdf_metadata['/ModDate'])
            
            logger.info(f"Extracted PDF metadata: {list(metadata.keys())}")
            return metadata
            
        except Exception as e:
            logger.warning(f"Failed to extract PDF metadata: {str(e)}")
            return {}
    
    def _clean_pdf_text(self, raw_text: str) -> str:
        """
        Clean and normalize text extracted from PDF.
        
        🎓 LEARNING: PDF Text Cleaning
        =================================
        PDF text extraction often produces messy results:
        1. **Extra whitespace**: Multiple spaces, tabs
        2. **Line breaks**: Inconsistent \n, \r\n
        3. **Special characters**: Non-printable chars
        4. **Encoding issues**: Weird Unicode characters
        
        Cleaning makes text more readable for both AI and humans.
        """
        if not raw_text:
            return ""
        
        try:
            # Normalize line endings
            cleaned = raw_text.replace('\r\n', '\n').replace('\r', '\n')
            
            # Remove excessive whitespace but preserve paragraph structure
            lines = cleaned.split('\n')
            cleaned_lines = []
            
            for line in lines:
                # Clean each line
                line = line.strip()
                
                # Replace multiple spaces with single spaces
                line = ' '.join(line.split())
                
                cleaned_lines.append(line)
            
            # Rejoin lines, preserving paragraph breaks
            cleaned = '\n'.join(cleaned_lines)
            
            # Remove excessive consecutive newlines (but keep paragraph breaks)
            while '\n\n\n' in cleaned:
                cleaned = cleaned.replace('\n\n\n', '\n\n')
            
            # Remove leading/trailing whitespace
            cleaned = cleaned.strip()
            
            return cleaned
            
        except Exception as e:
            logger.warning(f"Text cleaning failed: {str(e)}")
            return raw_text  # Return original if cleaning fails
    
    async def process_pdf_file(
        self, 
        file_upload: FileUpload,
        include_metadata: bool = True
    ) -> ProcessedFileContent:
        """
        Main method to process a PDF file for AI consumption.
        
        🎓 LEARNING: PDF Processing Pipeline
        =====================================
        PDF processing follows a specialized pipeline:
        1. Validate PDF file structure
        2. Extract text from all pages
        3. Extract document metadata
        4. Clean and format text content
        5. Handle large documents (truncation)
        6. Format for AI consumption
        
        This is similar to text processing but adapted for PDF complexities.
        
        Args:
            file_upload: FileUpload model instance
            include_metadata: Whether to include additional metadata
            
        Returns:
            ProcessedFileContent with AI-ready content
            
        Raises:
            PDFProcessingError: If PDF processing fails
        """
        try:
            logger.info(f"Processing PDF file {file_upload.id}: {file_upload.filename}")
            
            # Step 1: Validate PDF can be processed
            self._validate_pdf_for_processing(file_upload)
            
            # Step 2: Extract content from PDF
            extracted_content = await self._extract_pdf_content(file_upload)
            
            # Step 3: Validate content safety and size
            validated_content = self._validate_content(extracted_content, file_upload)
            
            # Step 4: Format content for AI consumption
            ai_formatted_content = self._format_for_ai(
                validated_content,
                file_upload.filename,
                file_upload.mime_type,
                include_metadata
            )
            
            # Step 5: Check if additional truncation is needed
            final_content, is_truncated, truncation_info = self._handle_content_size(
                ai_formatted_content,
                file_upload.filename
            )
            
            # Step 6: Create PDF-specific metadata
            metadata = await self._create_pdf_metadata(
                file_upload,
                include_metadata
            ) if include_metadata else None
            
            # Step 7: Build final processed content
            processed_content = ProcessedFileContent(
                file_id=file_upload.id,
                filename=file_upload.filename,
                content_type=ContentType.STRUCTURED_DATA,  # PDFs are structured documents
                processed_content=final_content,
                content_length=len(final_content),
                is_truncated=is_truncated,
                truncation_info=truncation_info,
                metadata=metadata,
                processed_at=datetime.utcnow()
            )
            
            logger.info(f"Successfully processed PDF {file_upload.id} - {len(final_content)} chars")
            return processed_content
            
        except PDFProcessingError:
            # Re-raise PDF-specific errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error processing PDF {file_upload.id}: {str(e)}")
            raise PDFProcessingError(
                f"Unexpected error processing PDF {file_upload.filename}: {str(e)}",
                file_upload.id
            )
    
    def _validate_pdf_for_processing(self, file_upload: FileUpload) -> None:
        """
        Validate that PDF file can be processed.
        
        🎓 LEARNING: PDF-Specific Validation
        ====================================
        PDFs have different requirements than text files:
        - Larger file size limits (25MB vs 10MB)
        - Binary file validation
        - PDF structure validation
        - Security considerations
        """
        # Check file exists
        if not file_upload.file_path or not Path(file_upload.file_path).exists():
            raise PDFProcessingError(
                f"PDF file {file_upload.filename} not found on disk",
                file_upload.id
            )
        
        # Check MIME type
        if file_upload.mime_type != 'application/pdf':
            raise PDFProcessingError(
                f"File {file_upload.filename} is not a PDF (MIME type: {file_upload.mime_type})",
                file_upload.id
            )
        
        # Check file size (PDFs can be larger than text files)
        if file_upload.file_size > self.max_pdf_size:
            raise FileTooLargeError(
                f"PDF file {file_upload.filename} too large: {file_upload.file_size} bytes (max {self.max_pdf_size})",
                file_upload.id
            )
        
        # Check minimum file size (PDFs have a minimum valid size)
        if file_upload.file_size < 100:  # PDFs must be at least ~100 bytes
            raise PDFCorruptedError(
                f"PDF file {file_upload.filename} too small to be valid: {file_upload.file_size} bytes",
                file_upload.id
            )
    
    async def _create_pdf_metadata(
        self, 
        file_upload: FileUpload, 
        include_detailed: bool
    ) -> Dict[str, Any]:
        """
        Create metadata specifically for PDF files.
        """
        metadata = {
            "file_type": "PDF Document",
            "original_size_bytes": file_upload.file_size,
            "file_extension": file_upload.file_extension,
            "mime_type": file_upload.mime_type,
            "processing_timestamp": datetime.utcnow().isoformat()
        }
        
        if include_detailed:
            try:
                # Extract detailed PDF info
                pdf_data = await self.extract_pdf_text(file_upload.file_path)
                
                metadata.update({
                    "page_count": pdf_data['page_count'],
                    "extracted_text_length": len(pdf_data['text']),
                    "pages_with_text": len([p for p in pdf_data['pages'] if p.get('char_count', 0) > 0]),
                    "document_metadata": pdf_data['metadata']
                })
                
            except Exception as e:
                logger.warning(f"Failed to create detailed PDF metadata: {str(e)}")
                metadata["metadata_extraction_error"] = str(e)
        
        return metadata
    
    # =============================================================================
    # WORD DOCUMENT PROCESSING METHODS  📘 NEW SECTION!
    # =============================================================================
    
    async def process_word_file(
        self, 
        file_upload: FileUpload,
        include_metadata: bool = True
    ) -> ProcessedFileContent:
        """
        Main method to process a Word document for AI consumption.
        
        🎓 LEARNING: Word Document Processing Pipeline
        ============================================
        Word processing follows a specialized pipeline similar to PDFs:
        1. Validate Word file structure and format
        2. Extract text content with structure preservation
        3. Extract document metadata (author, title, etc.)
        4. Process tables, lists, and formatting
        5. Handle large documents (smart truncation)
        6. Format for AI consumption with structure context
        
        Word documents are more complex than plain text because they contain:
        - Rich formatting (bold, italic, styles)
        - Document structure (headings, sections)
        - Embedded objects (tables, images, charts)
        - Metadata (author, creation date, word count)
        
        Args:
            file_upload: FileUpload model instance
            include_metadata: Whether to include additional metadata
            
        Returns:
            ProcessedFileContent with AI-ready content
            
        Raises:
            WordProcessingError: If Word processing fails
        """
        try:
            logger.info(f"Processing Word document {file_upload.id}: {file_upload.filename}")
            
            # Step 1: Validate Word document can be processed
            self._validate_word_for_processing(file_upload)
            
            # Step 2: Extract content from Word document
            extracted_content = await self._extract_word_content(file_upload)
            
            # Step 3: Validate content safety and size
            validated_content = self._validate_content(extracted_content, file_upload)
            
            # Step 4: Format content for AI consumption
            ai_formatted_content = self._format_for_ai(
                validated_content,
                file_upload.filename,
                file_upload.mime_type,
                include_metadata
            )
            
            # Step 5: Check if additional truncation is needed
            final_content, is_truncated, truncation_info = self._handle_content_size(
                ai_formatted_content,
                file_upload.filename
            )
            
            # Step 6: Create Word-specific metadata
            metadata = await self._create_word_metadata(
                file_upload,
                include_metadata
            ) if include_metadata else None
            
            # Step 7: Build final processed content
            processed_content = ProcessedFileContent(
                file_id=file_upload.id,
                filename=file_upload.filename,
                content_type=ContentType.STRUCTURED_DATA,  # Word docs are structured documents
                processed_content=final_content,
                content_length=len(final_content),
                is_truncated=is_truncated,
                truncation_info=truncation_info,
                metadata=metadata,
                processed_at=datetime.utcnow()
            )
            
            logger.info(f"Successfully processed Word document {file_upload.id} - {len(final_content)} chars")
            return processed_content
            
        except WordProcessingError:
            # Re-raise Word-specific errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error processing Word document {file_upload.id}: {str(e)}")
            raise WordProcessingError(
                f"Unexpected error processing Word document {file_upload.filename}: {str(e)}",
                file_upload.id
            )
    
    async def _extract_word_content(self, file_upload: FileUpload) -> str:
        """
        Extract structured information from Word document content.
        
        🎓 LEARNING: Word Document Processing for AI
        ==========================================
        Word documents need special handling for AI consumption:
        1. **Structure Preservation**: Extract headings, sections, lists
        2. **Table Processing**: Convert tables to readable format
        3. **Metadata Extraction**: Get document info (author, title, etc.)
        4. **Formatting Context**: Preserve important formatting clues
        5. **Error Handling**: Handle password-protected, corrupted files
        
        This gives AI much richer context than just raw text extraction.
        """
        try:
            logger.info(f"Starting Word processing for {file_upload.filename}")
            
            # Extract text and structure from Word document
            word_data = await self.extract_docx_text(file_upload.file_path)
            
            # Build structured description for AI
            description_parts = [
                f"Word Document: {file_upload.filename}",
                f"Pages: {word_data['page_count']}",
                f"Words: {word_data['word_count']}",
                f"Extracted text length: {len(word_data['text'])} characters"
            ]
            
            # Add metadata if available
            if word_data['metadata']:
                metadata = word_data['metadata']
                description_parts.append("\nDocument Information:")
                
                if metadata.get('title'):
                    description_parts.append(f"  Title: {metadata['title']}")
                if metadata.get('author'):
                    description_parts.append(f"  Author: {metadata['author']}")
                if metadata.get('creation_date'):
                    description_parts.append(f"  Created: {metadata['creation_date']}")
                if metadata.get('last_modified'):
                    description_parts.append(f"  Last Modified: {metadata['last_modified']}")
                if metadata.get('subject'):
                    description_parts.append(f"  Subject: {metadata['subject']}")
            
            # Add document structure overview
            if word_data['structured_content']:
                structure_info = self._analyze_word_structure(word_data['structured_content'])
                if structure_info:
                    description_parts.append("\nDocument Structure:")
                    description_parts.extend(structure_info)
            
            # Add the extracted content with structure
            description_parts.append("\nExtracted Content:")
            description_parts.append("-" * 50)
            
            # Format structured content for AI consumption
            formatted_text = self._format_structured_word_content(word_data['structured_content'])
            
            # Handle large text content - truncate if necessary
            if len(formatted_text) > self.max_word_text:
                # Smart truncation for large Word documents
                keep_start = int(self.max_word_text * 0.7)  # 70% from beginning
                keep_end = int(self.max_word_text * 0.2)    # 20% from end
                
                truncation_msg = f"\n\n[... Word document content truncated - {len(formatted_text) - keep_start - keep_end} characters hidden from middle ...]\n"
                
                formatted_text = formatted_text[:keep_start] + truncation_msg + formatted_text[-keep_end:] if keep_end > 0 else formatted_text[:keep_start] + truncation_msg
                
                description_parts.append(f"(Showing {len(formatted_text)} of {len(word_data['text'])} total characters)")
            
            description_parts.append(formatted_text)
            description_parts.append("-" * 50)
            
            logger.info(f"Successfully processed Word document {file_upload.filename} - {len(formatted_text)} chars extracted")
            return "\n".join(description_parts)
            
        except WordProcessingError:
            # Re-raise Word-specific errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error processing Word document {file_upload.filename}: {str(e)}")
            raise WordProcessingError(
                f"Failed to process Word document {file_upload.filename}: {str(e)}",
                file_upload.id
            )
    
    async def extract_docx_text(self, file_path: str) -> Dict[str, Any]:
        """
        Extract text and structure from Word document using python-docx.
        
        🎓 LEARNING: Word Document Text Extraction
        ======================================
        Word extraction is complex because Word documents contain:
        1. **Rich Structure**: Headings, paragraphs, lists, tables
        2. **Formatting Information**: Bold, italic, styles
        3. **Document Properties**: Author, title, creation date
        4. **Embedded Content**: Images, charts, objects
        5. **Page Layout**: Headers, footers, sections
        
        python-docx is excellent because it:
        - Preserves document structure hierarchy
        - Handles tables and lists properly
        - Provides access to document properties
        - Works with modern .docx format
        
        Returns:
            Dict with extracted text, metadata, and structured content
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise WordProcessingError(f"Word document not found: {file_path}")
        
        # Verify it's actually a Word document
        try:
            file_mime = magic.from_file(str(file_path), mime=True)
            if file_mime not in [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword'
            ]:
                raise WordCorruptedError(f"File is not a valid Word document (detected: {file_mime})")
        except Exception as e:
            logger.warning(f"Could not verify Word document MIME type: {str(e)}")
            # Continue anyway - might still be a valid Word document
        
        extracted_data = {
            'text': '',
            'word_count': 0,
            'page_count': 0,
            'metadata': {},
            'structured_content': []
        }
        
        try:
            # Handle .docx files with python-docx
            if file_path.suffix.lower() == '.docx':
                extracted_data = await self._extract_from_docx(file_path)
            else:
                # Handle .doc files with docx2txt (fallback)
                extracted_data = await self._extract_from_doc(file_path)
            
            logger.info(f"Successfully extracted {len(extracted_data['text'])} characters from Word document")
            return extracted_data
            
        except WordProcessingError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            error_msg = str(e).lower()
            
            # Handle common Word document errors with specific exceptions
            if 'password' in error_msg or 'encrypted' in error_msg:
                raise WordPasswordProtectedError(
                    f"Word document {file_path.name} is password-protected. Please provide an unlocked version."
                )
            elif 'damaged' in error_msg or 'corrupt' in error_msg or 'invalid' in error_msg:
                raise WordCorruptedError(
                    f"Word document {file_path.name} appears to be corrupted. Please try uploading again."
                )
            elif 'macro' in error_msg or 'vba' in error_msg:
                raise WordMacroContentError(
                    f"Word document {file_path.name} contains macros or VBA code that cannot be processed."
                )
            else:
                raise WordProcessingError(
                    f"Failed to process Word document {file_path.name}: {str(e)}"
                )
    
    async def _extract_from_docx(self, file_path: Path) -> Dict[str, Any]:
        """
        Extract content from modern .docx files using python-docx.
        
        🎓 LEARNING: .docx Processing with python-docx
        =======================================
        .docx files are actually ZIP archives containing XML files:
        - document.xml: Main document content
        - app.xml: Application properties
        - core.xml: Document metadata
        - Various relationship and content files
        
        python-docx parses these XML files to provide:
        - Structured access to paragraphs and runs
        - Table data with row/column structure
        - Document properties and metadata
        - Style information and formatting
        """
        extracted_data = {
            'text': '',
            'word_count': 0,
            'page_count': 1,  # Word doesn't provide easy page count access
            'metadata': {},
            'structured_content': []
        }
        
        try:
            # Open Word document
            doc = Document(file_path)
            
            # Extract metadata first
            extracted_data['metadata'] = self.get_docx_metadata(doc)
            
            # Extract structured content
            all_text_parts = []
            
            for element in doc.element.body:
                # Process paragraphs
                if element.tag.endswith('p'):  # Paragraph
                    para = element
                    paragraph_data = self._process_docx_paragraph(para, doc)
                    if paragraph_data:
                        extracted_data['structured_content'].append(paragraph_data)
                        all_text_parts.append(paragraph_data.get('text', ''))
                
                # Process tables
                elif element.tag.endswith('tbl'):  # Table
                    table_data = self._process_docx_table(element)
                    if table_data:
                        extracted_data['structured_content'].append(table_data)
                        all_text_parts.append(table_data.get('text', ''))
            
            # Combine all text
            full_text = '\n'.join(all_text_parts)
            extracted_data['text'] = full_text
            
            # Calculate word count
            extracted_data['word_count'] = len(full_text.split())
            
            # Try to estimate page count (rough estimate: 250 words per page)
            if extracted_data['word_count'] > 0:
                extracted_data['page_count'] = max(1, extracted_data['word_count'] // 250)
            
            return extracted_data
            
        except Exception as e:
            logger.error(f"Failed to extract from .docx file: {str(e)}")
            # Fallback to simple text extraction
            try:
                simple_text = docx2txt.process(str(file_path))
                extracted_data['text'] = simple_text
                extracted_data['word_count'] = len(simple_text.split())
                extracted_data['structured_content'] = [
                    {'type': 'paragraph', 'text': simple_text}
                ]
                logger.info("Used fallback text extraction for .docx file")
                return extracted_data
            except Exception as fallback_error:
                raise WordProcessingError(f"Both structured and fallback extraction failed: {str(fallback_error)}")
    
    async def _extract_from_doc(self, file_path: Path) -> Dict[str, Any]:
        """
        Extract content from legacy .doc files.
        
        🎓 LEARNING: Legacy .doc File Processing
        ======================================
        .doc files use the older OLE (Object Linking and Embedding) format:
        - Binary format (not XML like .docx)
        - More complex to parse
        - Limited metadata access
        - Often requires fallback to simple text extraction
        
        We use docx2txt as the primary method since it's more reliable
        for .doc files than trying to parse the binary format directly.
        """
        extracted_data = {
            'text': '',
            'word_count': 0,
            'page_count': 1,
            'metadata': {},
            'structured_content': []
        }
        
        try:
            # Use docx2txt for simple text extraction from .doc files
            simple_text = docx2txt.process(str(file_path))
            
            if not simple_text or not simple_text.strip():
                raise WordProcessingError("No text could be extracted from .doc file")
            
            extracted_data['text'] = simple_text.strip()
            extracted_data['word_count'] = len(simple_text.split())
            
            # For .doc files, we just treat it as one big paragraph
            # since we can't easily extract structure
            extracted_data['structured_content'] = [
                {
                    'type': 'document',
                    'text': extracted_data['text'],
                    'note': 'Legacy .doc format - structure information limited'
                }
            ]
            
            # Try to estimate page count
            if extracted_data['word_count'] > 0:
                extracted_data['page_count'] = max(1, extracted_data['word_count'] // 250)
            
            # Limited metadata for .doc files
            extracted_data['metadata'] = {
                'format': '.doc (legacy)',
                'extraction_method': 'docx2txt',
                'note': 'Limited metadata available for .doc format'
            }
            
            logger.info(f"Extracted {len(extracted_data['text'])} characters from .doc file")
            return extracted_data
            
        except Exception as e:
            logger.error(f"Failed to extract from .doc file: {str(e)}")
            raise WordProcessingError(f"Cannot extract text from .doc file {file_path.name}: {str(e)}")
    
    def get_docx_metadata(self, doc: Document) -> Dict[str, Any]:
        """
        Extract metadata from Word document.
        
        🎓 LEARNING: Word Document Metadata
        ===============================
        Word documents contain rich metadata similar to PDFs:
        - **Core Properties**: Title, author, subject, creation date
        - **Application Properties**: Word count, page count, company
        - **Custom Properties**: User-defined document properties
        
        This metadata provides valuable context for AI understanding.
        """
        metadata = {}
        
        try:
            # Access document core properties
            core_props = doc.core_properties
            
            if core_props.title:
                metadata['title'] = str(core_props.title).strip()
            
            if core_props.author:
                metadata['author'] = str(core_props.author).strip()
            
            if core_props.subject:
                metadata['subject'] = str(core_props.subject).strip()
            
            if core_props.category:
                metadata['category'] = str(core_props.category).strip()
            
            if core_props.comments:
                metadata['comments'] = str(core_props.comments).strip()
            
            if core_props.keywords:
                metadata['keywords'] = str(core_props.keywords).strip()
            
            if core_props.language:
                metadata['language'] = str(core_props.language).strip()
            
            # Handle creation date
            if core_props.created:
                try:
                    metadata['creation_date'] = core_props.created.strftime('%Y-%m-%d %H:%M:%S')
                except Exception:
                    metadata['creation_date'] = str(core_props.created)
            
            # Handle modification date
            if core_props.modified:
                try:
                    metadata['last_modified'] = core_props.modified.strftime('%Y-%m-%d %H:%M:%S')
                except Exception:
                    metadata['last_modified'] = str(core_props.modified)
            
            # Handle last modified by
            if core_props.last_modified_by:
                metadata['last_modified_by'] = str(core_props.last_modified_by).strip()
            
            logger.info(f"Extracted Word metadata: {list(metadata.keys())}")
            return metadata
            
        except Exception as e:
            logger.warning(f"Failed to extract Word metadata: {str(e)}")
            return {}
    
    def _process_docx_paragraph(self, para_element, doc: Document) -> Optional[Dict[str, Any]]:
        """
        Process a paragraph element from Word document.
        """
        try:
            # Find the corresponding paragraph object
            para_text = ""
            para_style = "normal"
            
            # Extract text from paragraph runs
            for run_element in para_element.iter():
                if run_element.text:
                    para_text += run_element.text
            
            para_text = para_text.strip()
            if not para_text:
                return None
            
            # Determine paragraph type based on style or content
            para_type = "paragraph"
            level = 0
            
            # Check if it's a heading based on content
            if para_text and (para_text.isupper() or len(para_text) < 100):
                # Might be a heading - check for heading patterns
                if any(para_text.lower().startswith(prefix) for prefix in ['chapter', 'section', 'part']):
                    para_type = "heading"
                    level = 1
            
            return {
                'type': para_type,
                'text': para_text,
                'level': level,
                'style': para_style
            }
            
        except Exception as e:
            logger.warning(f"Failed to process paragraph: {str(e)}")
            return None
    
    def _process_docx_table(self, table_element) -> Optional[Dict[str, Any]]:
        """
        Process a table element from Word document.
        """
        try:
            table_data = []
            table_text_parts = []
            
            # Extract table structure would be complex
            # For now, just indicate a table exists
            table_text_parts.append("[Table content present but not fully parsed]")
            
            return {
                'type': 'table',
                'text': '\n'.join(table_text_parts),
                'data': table_data,
                'note': 'Table structure parsing simplified'
            }
            
        except Exception as e:
            logger.warning(f"Failed to process table: {str(e)}")
            return None
    
    def _analyze_word_structure(self, structured_content: List[Dict]) -> List[str]:
        """
        Analyze Word document structure and return summary.
        """
        structure_info = []
        
        try:
            # Count different element types
            element_counts = {}
            headings = []
            
            for item in structured_content:
                item_type = item.get('type', 'unknown')
                element_counts[item_type] = element_counts.get(item_type, 0) + 1
                
                if item_type == 'heading':
                    level = item.get('level', 1)
                    text = item.get('text', '')[:50]  # First 50 chars
                    headings.append(f"  {'  ' * (level-1)}H{level}: {text}")
            
            # Add element counts
            if element_counts:
                for elem_type, count in element_counts.items():
                    structure_info.append(f"  {elem_type.title()}s: {count}")
            
            # Add heading structure
            if headings:
                structure_info.append("Document Outline:")
                structure_info.extend(headings[:10])  # Show first 10 headings
                if len(headings) > 10:
                    structure_info.append(f"  ... and {len(headings) - 10} more headings")
            
            return structure_info
            
        except Exception as e:
            logger.warning(f"Failed to analyze Word structure: {str(e)}")
            return []
    
    def _format_structured_word_content(self, structured_content: List[Dict]) -> str:
        """
        Format structured Word content for AI consumption.
        
        🎓 LEARNING: Structured Content Formatting
        ========================================
        Convert Word document structure to AI-friendly format:
        - Preserve heading hierarchy with markdown-style formatting
        - Convert tables to readable text format
        - Maintain list structure
        - Add context markers for different content types
        
        This helps AI understand document organization and respond better.
        """
        try:
            formatted_parts = []
            
            for item in structured_content:
                item_type = item.get('type', 'paragraph')
                text = item.get('text', '')
                
                if not text.strip():
                    continue
                
                if item_type == 'heading':
                    level = item.get('level', 1)
                    heading_prefix = '#' * level
                    formatted_parts.append(f"\n{heading_prefix} {text}\n")
                
                elif item_type == 'table':
                    formatted_parts.append(f"\n**Table:**\n{text}\n")
                
                elif item_type == 'list':
                    items = item.get('items', [text])
                    formatted_parts.append("\n**List:**")
                    for list_item in items:
                        formatted_parts.append(f"- {list_item}")
                    formatted_parts.append("")
                
                else:
                    # Regular paragraph
                    formatted_parts.append(text)
                    formatted_parts.append("")  # Add spacing
            
            return "\n".join(formatted_parts)
            
        except Exception as e:
            logger.warning(f"Failed to format structured Word content: {str(e)}")
            # Fallback: just concatenate all text
            return "\n".join(item.get('text', '') for item in structured_content if item.get('text'))
    
    def _validate_word_for_processing(self, file_upload: FileUpload) -> None:
        """
        Validate that Word document can be processed.
        
        🎓 LEARNING: Word-Specific Validation
        ====================================
        Word documents have different requirements than text files:
        - Larger file size limits (20MB vs 10MB for text)
        - Binary file validation for .docx
        - Legacy format support for .doc
        - Security considerations (macros, embedded objects)
        """
        # Check file exists
        if not file_upload.file_path or not Path(file_upload.file_path).exists():
            raise WordProcessingError(
                f"Word document {file_upload.filename} not found on disk",
                file_upload.id
            )
        
        # Check MIME type
        if file_upload.mime_type not in [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ]:
            raise WordProcessingError(
                f"File {file_upload.filename} is not a Word document (MIME type: {file_upload.mime_type})",
                file_upload.id
            )
        
        # Check file size
        if file_upload.file_size > self.max_word_size:
            raise FileTooLargeError(
                f"Word document {file_upload.filename} too large: {file_upload.file_size} bytes (max {self.max_word_size})",
                file_upload.id
            )
        
        # Check minimum file size
        if file_upload.file_size < 100:  # Word docs must be at least ~100 bytes
            raise WordCorruptedError(
                f"Word document {file_upload.filename} too small to be valid: {file_upload.file_size} bytes",
                file_upload.id
            )
    
    async def _create_word_metadata(
        self, 
        file_upload: FileUpload, 
        include_detailed: bool
    ) -> Dict[str, Any]:
        """
        Create metadata specifically for Word documents.
        """
        metadata = {
            "file_type": "Word Document",
            "original_size_bytes": file_upload.file_size,
            "file_extension": file_upload.file_extension,
            "mime_type": file_upload.mime_type,
            "processing_timestamp": datetime.utcnow().isoformat()
        }
        
        if include_detailed:
            try:
                # Extract detailed Word info
                word_data = await self.extract_docx_text(file_upload.file_path)
                
                metadata.update({
                    "word_count": word_data['word_count'],
                    "page_count": word_data['page_count'],
                    "extracted_text_length": len(word_data['text']),
                    "structure_elements": len(word_data['structured_content']),
                    "document_metadata": word_data['metadata']
                })
                
            except Exception as e:
                logger.warning(f"Failed to create detailed Word metadata: {str(e)}")
                metadata["metadata_extraction_error"] = str(e)
        
        return metadata
    
    # =============================================================================
    # CONTENT VALIDATION AND SAFETY
    # =============================================================================
    
    def _validate_content(self, content: str, file_upload: FileUpload) -> str:
        """
        Validate content for safety and appropriateness.
        """
        # Check content safety
        is_safe, error_message = self.validate_content_safety(content, file_upload.filename)
        if not is_safe:
            raise ContentValidationError(
                f"Content validation failed for {file_upload.filename}: {error_message}",
                file_upload.id
            )
        
        return content
    
    def _appears_to_be_binary(self, content: str) -> bool:
        """
        Check if content appears to be binary data.
        
        🎓 LEARNING: Binary Detection
        ============================
        Text files should not contain binary data:
        - Control characters (except common ones like \n, \t)
        - Non-printable ASCII
        - Invalid Unicode sequences
        
        This helps catch incorrectly uploaded binary files.
        """
        try:
            # Check for null bytes (strong binary indicator)
            if '\x00' in content:
                return True
            
            # Check for excessive control characters
            control_chars = sum(1 for c in content if ord(c) < 32 and c not in '\n\r\t')
            if len(content) > 0 and control_chars / len(content) > 0.05:  # >5% control chars
                return True
            
            # Check for non-UTF8 sequences
            try:
                content.encode('utf-8')
            except UnicodeEncodeError:
                return True
            
            return False
            
        except Exception:
            # If we can't analyze it, assume it might be binary
            return True
    
    def _contains_suspicious_patterns(self, content: str) -> bool:
        """
        Check for basic suspicious patterns in content.
        
        🎓 LEARNING: Basic Content Filtering
        ===================================
        This is NOT comprehensive security scanning, just basic patterns:
        - Extremely long lines (possible obfuscation)
        - Excessive repeated characters (possible DoS attempt)
        - Common malware file patterns
        
        For production, you'd use specialized security scanning tools.
        """
        try:
            lines = content.split('\n')
            
            # Check for extremely long lines (>10KB)
            for line in lines:
                if len(line) > 10000:
                    return True
            
            # Check for excessive character repetition
            if len(content) > 1000:  # Only check larger files
                for char in 'A\x00\xff':
                    if content.count(char) > len(content) * 0.5:  # >50% same character
                        return True
            
            # Check for suspicious file patterns (basic)
            suspicious_patterns = [
                'eval(',  # Code execution
                'exec(',  # Code execution
                '__import__',  # Dynamic imports
                'subprocess.',  # System commands
            ]
            
            content_lower = content.lower()
            suspicious_count = sum(1 for pattern in suspicious_patterns if pattern in content_lower)
            
            # If multiple suspicious patterns, flag as suspicious
            if suspicious_count >= 3:
                return True
            
            return False
            
        except Exception:
            # If analysis fails, err on side of caution
            return True
    
    def _has_valid_text_structure(self, content: str) -> bool:
        """
        Check if content has valid text structure.
        """
        try:
            # Must be valid string
            if not isinstance(content, str):
                return False
            
            # Should not be entirely whitespace
            if not content.strip():
                return False
            
            # Should have reasonable line structure
            lines = content.split('\n')
            if len(lines) > 100000:  # Too many lines
                return False
            
            return True
            
        except Exception:
            return False
    
    # =============================================================================
    # CONTENT FORMATTING AND SIZE HANDLING
    # =============================================================================
    
    def _format_for_ai(
        self, 
        content: str, 
        filename: str, 
        mime_type: str, 
        include_metadata: bool
    ) -> str:
        """
        Format content for optimal AI consumption.
        
        🎓 LEARNING: AI Context Formatting
        =================================
        AI works best with clearly formatted context:
        1. Clear file identification
        2. Content type explanation
        3. Structured content with separators
        4. Instructions for AI on how to process
        
        This formatting dramatically improves AI understanding.
        """
        formatted_parts = []
        
        # Header with file information
        formatted_parts.append(f"File: {filename}")
        
        if include_metadata:
            file_type = self._get_human_readable_file_type(mime_type)
            formatted_parts.append(f"Type: {file_type}")
        
        # Content separator
        formatted_parts.append("---")
        
        # The processed content
        formatted_parts.append(content)
        
        # End separator
        formatted_parts.append("---")
        
        return "\n".join(formatted_parts)
    
    def _handle_content_size(
        self, 
        content: str, 
        filename: str
    ) -> Tuple[str, bool, Optional[str]]:
        """
        Handle content size limits for AI processing.
        
        🎓 LEARNING: Content Truncation Strategy
        =======================================
        AI models have context limits, so we need smart truncation:
        1. Try to keep content under limit
        2. If too large, truncate intelligently
        3. Preserve important parts (beginning + end)
        4. Add clear truncation notice
        5. Provide metadata about what was truncated
        """
        if len(content) <= self.max_content_size:
            return content, False, None
        
        # Content is too large - need to truncate
        logger.warning(f"Content too large for {filename}: {len(content)} chars (max {self.max_content_size})")
        
        # Calculate truncation strategy
        # Keep beginning and end, with clear truncation marker
        
        keep_start = int(self.max_content_size * 0.6)  # 60% for beginning
        keep_end = int(self.max_content_size * 0.3)    # 30% for end
        # 10% reserved for truncation message
        
        truncation_message = f"\n\n[... Content truncated - {len(content) - keep_start - keep_end} characters hidden ...]\n\n"
        
        start_content = content[:keep_start]
        end_content = content[-keep_end:] if keep_end > 0 else ""
        
        truncated_content = start_content + truncation_message + end_content
        
        truncation_info = f"Truncated from {len(content)} to {len(truncated_content)} characters ({len(content) - len(truncated_content)} characters hidden)"
        
        return truncated_content, True, truncation_info
    
    # =============================================================================
    # FILE READING AND ENCODING
    # =============================================================================
    
    async def _read_file_content(self, file_upload: FileUpload) -> str:
        """
        Read and decode file content with smart encoding detection.
        
        🎓 LEARNING: Encoding Detection and Handling
        ===========================================
        File encoding is a common source of errors:
        1. Try to detect encoding automatically
        2. Fall back to common encodings
        3. Handle partial decode errors gracefully
        4. Provide clear error messages
        
        This robust approach handles files from different systems/languages.
        """
        file_path = Path(file_upload.file_path)
        
        if not file_path.exists():
            raise FileProcessingError(
                f"File not found on disk: {file_upload.filename}",
                file_upload.id,
                "file_not_found"
            )
        
        try:
            # Read raw bytes first
            with open(file_path, 'rb') as f:
                raw_bytes = f.read()
            
            if not raw_bytes:
                return ""  # Empty file
            
            # Detect encoding
            encoding = self._detect_encoding(raw_bytes, file_upload.filename)
            
            # Decode with detected encoding
            try:
                content = raw_bytes.decode(encoding)
                logger.info(f"Successfully decoded {file_upload.filename} with encoding: {encoding}")
                return content
                
            except UnicodeDecodeError as e:
                logger.warning(f"Encoding {encoding} failed for {file_upload.filename}: {str(e)}")
                
                # Try fallback encodings
                for fallback_encoding in self.fallback_encodings:
                    if fallback_encoding == encoding:
                        continue  # Skip already tried encoding
                    
                    try:
                        content = raw_bytes.decode(fallback_encoding, errors='replace')
                        logger.info(f"Fallback encoding {fallback_encoding} worked for {file_upload.filename}")
                        return content
                    except Exception:
                        continue
                
                # Last resort: decode with error replacement
                content = raw_bytes.decode('utf-8', errors='replace')
                logger.warning(f"Using UTF-8 with error replacement for {file_upload.filename}")
                return content
                
        except Exception as e:
            logger.error(f"Failed to read file {file_upload.filename}: {str(e)}")
            raise EncodingDetectionError(
                f"Cannot read file {file_upload.filename}: {str(e)}",
                file_upload.id
            )
    
    def _detect_encoding(self, raw_bytes: bytes, filename: str) -> str:
        """
        Detect file encoding using multiple strategies.
        
        🎓 LEARNING: Encoding Detection Strategies
        =========================================
        1. Use chardet library for automatic detection
        2. Check BOM (Byte Order Mark) for UTF encodings
        3. Fall back to UTF-8 (most common)
        4. Consider file extension hints
        """
        try:
            # Check for BOM (Byte Order Mark)
            if raw_bytes.startswith(b'\xef\xbb\xbf'):
                return 'utf-8-sig'
            elif raw_bytes.startswith(b'\xff\xfe'):
                return 'utf-16-le'
            elif raw_bytes.startswith(b'\xfe\xff'):
                return 'utf-16-be'
            
            # Use chardet for detection
            detection = chardet.detect(raw_bytes)
            
            if detection and detection['confidence'] >= self.encoding_confidence_threshold:
                detected_encoding = detection['encoding']
                logger.info(f"Detected encoding for {filename}: {detected_encoding} (confidence: {detection['confidence']:.2f})")
                return detected_encoding
            
            # Default to UTF-8
            logger.info(f"Using default UTF-8 encoding for {filename}")
            return 'utf-8'
            
        except Exception as e:
            logger.warning(f"Encoding detection failed for {filename}: {str(e)}")
            return 'utf-8'
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def _validate_file_for_processing(self, file_upload: FileUpload) -> None:
        """
        Validate that file can be processed.
        """
        # Check file exists
        if not file_upload.file_path or not Path(file_upload.file_path).exists():
            raise FileProcessingError(
                f"File {file_upload.filename} not found on disk",
                file_upload.id,
                "file_not_found"
            )
        
        # Check MIME type is supported
        if file_upload.mime_type not in self.supported_mime_types:
            raise FileProcessingError(
                f"File type {file_upload.mime_type} not supported for processing",
                file_upload.id,
                "unsupported_file_type"
            )
        
        # Check file size
        if file_upload.file_size > self.max_content_size * 10:  # 10x limit for raw file
            raise FileTooLargeError(
                f"File {file_upload.filename} too large for processing: {file_upload.file_size} bytes",
                file_upload.id
            )
    
    def _create_content_metadata(
        self, 
        raw_content: str, 
        file_upload: FileUpload, 
        include_detailed: bool
    ) -> Dict[str, Any]:
        """
        Create metadata about the processed content.
        """
        metadata = {
            "original_size_bytes": file_upload.file_size,
            "content_length": len(raw_content),
            "line_count": len(raw_content.split('\n')),
            "word_count": len(raw_content.split()),
            "file_extension": file_upload.file_extension,
            "mime_type": file_upload.mime_type,
            "encoding": "utf-8"  # We normalize to UTF-8
        }
        
        if include_detailed:
            # Add more detailed analysis
            metadata.update({
                "character_distribution": self._analyze_character_distribution(raw_content),
                "content_type_hints": self._get_content_type_hints(raw_content, file_upload.mime_type),
                "processing_timestamp": datetime.utcnow().isoformat()
            })
        
        return metadata
    
    def _get_human_readable_file_type(self, mime_type: str) -> str:
        """
        Convert MIME type to human-readable description.
        """
        type_map = {
            'text/plain': 'Plain Text',
            'text/markdown': 'Markdown Document',
            'text/csv': 'CSV Data File',
            'application/json': 'JSON Data File',
            'text/x-python': 'Python Code',
            'text/javascript': 'JavaScript Code',
            'text/html': 'HTML Document',
            'application/xml': 'XML Document',
            'text/xml': 'XML Document',
            'application/pdf': 'PDF Document',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (.docx)',  # 📘 NEW: .docx support!
            'application/msword': 'Word Document (.doc)'  # 📘 NEW: .doc support!
        }
        
        return type_map.get(mime_type, mime_type)
    
    def _infer_csv_column_type(self, value: str) -> str:
        """
        Infer data type from CSV column value.
        """
        value = value.strip()
        
        if not value:
            return "empty"
        
        # Try to parse as number
        try:
            if '.' in value:
                float(value)
                return "decimal"
            else:
                int(value)
                return "integer"
        except ValueError:
            pass
        
        # Check for date patterns (basic)
        if any(char in value for char in '/-'):
            if len(value.split('/')) == 3 or len(value.split('-')) == 3:
                return "date"
        
        # Check for boolean
        if value.lower() in ['true', 'false', 'yes', 'no', '1', '0']:
            return "boolean"
        
        return "text"
    
    def _analyze_character_distribution(self, content: str) -> Dict[str, int]:
        """
        Analyze character distribution for metadata.
        """
        return {
            "letters": sum(1 for c in content if c.isalpha()),
            "digits": sum(1 for c in content if c.isdigit()),
            "whitespace": sum(1 for c in content if c.isspace()),
            "punctuation": sum(1 for c in content if not c.isalnum() and not c.isspace())
        }
    
    def _get_content_type_hints(self, content: str, mime_type: str) -> List[str]:
        """
        Get hints about content type based on analysis.
        """
        hints = []
        
        if 'json' in mime_type:
            hints.append("structured_data")
            if '"' in content and '{' in content:
                hints.append("json_object")
        elif 'csv' in mime_type:
            hints.append("tabular_data")
            if ',' in content:
                hints.append("comma_separated")
        elif 'markdown' in mime_type:
            hints.append("formatted_text")
            if '#' in content:
                hints.append("has_headings")
        
        return hints


# =============================================================================
# GLOBAL SERVICE INSTANCE
# =============================================================================

# Create global service instance
file_processor_service = FileProcessorService()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_file_processor_service() -> FileProcessorService:
    """
    Get the file processor service instance.
    
    🎓 LEARNING: Dependency Injection
    ================================
    This function enables dependency injection in FastAPI:
    
    @app.post("/process-file")
    async def process_file(
        processor: FileProcessorService = Depends(get_file_processor_service)
    ):
        # Use processor...
    """
    return file_processor_service


async def process_multiple_files(
    file_uploads: List[FileUpload],
    include_metadata: bool = True
) -> List[ProcessedFileContent]:
    """
    Process multiple files efficiently.
    
    🎓 LEARNING: Batch Processing
    ============================
    When processing multiple files:
    - Process each file independently
    - Collect successes and failures separately
    - Don't let one failure stop others
    - Provide detailed error information
    
    Args:
        file_uploads: List of FileUpload objects to process
        include_metadata: Whether to include detailed metadata
        
    Returns:
        List of ProcessedFileContent objects (successful ones only)
    """
    processed_files = []
    
    for file_upload in file_uploads:
        try:
            processed_content = await file_processor_service.process_text_file(
                file_upload,
                include_metadata
            )
            processed_files.append(processed_content)
            
        except FileProcessingError as e:
            logger.error(f"Failed to process file {file_upload.id}: {e.message}")
            # Continue with other files
            continue
        except Exception as e:
            logger.error(f"Unexpected error processing file {file_upload.id}: {str(e)}")
            continue
    
    logger.info(f"Processed {len(processed_files)} out of {len(file_uploads)} files successfully")
    return processed_files


def format_files_for_llm_context(
    processed_files: List[ProcessedFileContent],
    user_message: str
) -> str:
    """
    Format processed files into LLM context with user message.
    
    🎓 LEARNING: LLM Context Building
    ================================
    This is the final step before sending to AI:
    1. Combine user message with file contents
    2. Add clear instructions for AI
    3. Structure content for optimal AI understanding
    4. Provide context about what user is asking
    
    This dramatically improves AI response quality.
    
    Args:
        processed_files: List of processed file contents
        user_message: User's question/message
        
    Returns:
        Formatted context string for LLM
    """
    if not processed_files:
        return user_message
    
    context_parts = []
    
    # Start with user message
    context_parts.append(f"User message: {user_message}")
    context_parts.append("")
    
    # Add file information
    if len(processed_files) == 1:
        context_parts.append("The user has attached 1 file:")
    else:
        context_parts.append(f"The user has attached {len(processed_files)} files:")
    
    context_parts.append("")
    
    # Add each file's content
    for i, file_content in enumerate(processed_files):
        context_parts.append(f"File {i+1}: {file_content.filename}")
        context_parts.append("=" * 50)
        context_parts.append(file_content.processed_content)
        context_parts.append("=" * 50)
        context_parts.append("")
    
    # Add instructions for AI
    context_parts.append("Instructions:")
    context_parts.append("- Please analyze the file(s) in relation to the user's message")
    context_parts.append("- Provide insights, answer questions, or complete tasks as requested")
    context_parts.append("- Reference specific parts of the files when relevant")
    context_parts.append("- If files contain data, provide analysis and insights")
    
    return "\n".join(context_parts)
