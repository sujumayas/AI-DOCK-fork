"""
File Processing Service for AI Dock Application - Refactored Version.

This service now uses a modular architecture with format-specific processors
for handling different file types. The interface remains the same, but the
implementation now delegates to specialized processors for better maintainability.

🎓 LEARNING: Refactored Architecture
==================================
Original file had all processing logic in one large class (~2500 lines).
New architecture separates concerns:

1. **This File**: Main interface and backward compatibility
2. **Processors**: Format-specific processing (PDF, Word, Text)  
3. **Service Manager**: Coordination and processor selection
4. **Shared Types**: Common data structures and enums
5. **Configuration**: Centralized settings management

Benefits:
- Single Responsibility: Each processor handles one format
- Extensibility: Easy to add new file types
- Testability: Isolated components for unit testing
- Maintainability: Smaller, focused modules
- Reusability: Processors can be used independently
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

# Import the new modular file processing system
from .file_processing import (
    file_processing_service,
    process_file,
    process_multiple_files,
    get_file_preview,
    get_supported_mime_types,
    is_supported_file_type,
    ProcessingResult,
    ProcessedFileContent,
    ContentType,
    FileProcessingError
)

# Internal imports for backward compatibility
from ..schemas.chat import (
    ProcessedFileContent as LegacyProcessedFileContent,
    ContentType as LegacyContentType,
    FileProcessingStatus
)
from ..models.file_upload import FileUpload

# Set up logging
logger = logging.getLogger(__name__)


# =============================================================================
# LEGACY EXCEPTION CLASSES (Preserved for Backward Compatibility)
# =============================================================================

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
    """Custom exception for PDF processing errors."""
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
    """Custom exception for Word document processing errors."""
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


# =============================================================================
# MAIN SERVICE CLASS (Refactored to use Modular Architecture)
# =============================================================================

class FileProcessorService:
    """
    Refactored file processing service that delegates to modular processors.
    
    🎓 LEARNING: Facade Pattern Implementation
    ========================================
    This class serves as a facade over the new modular file processing system:
    - Maintains existing public API for backward compatibility
    - Delegates actual processing to specialized processors
    - Handles legacy data structure conversions
    - Provides additional convenience methods
    
    Benefits:
    - Existing code continues to work without changes
    - New code can use either interface (legacy or new)
    - Gradual migration path from old to new system
    - Centralized error handling and logging
    """
    
    def __init__(self):
        """Initialize the service with the new modular backend."""
        self.service = file_processing_service
        
        # Legacy properties for backward compatibility
        self.max_content_size = self.service.config.limits.max_ai_content_size
        self.preview_length = self.service.config.limits.preview_length
        self.supported_mime_types = self._build_legacy_mime_types_dict()
        
        # Legacy PDF settings
        self.max_pdf_size = self.service.config.pdf.max_pdf_size
        self.max_pdf_pages = self.service.config.pdf.max_pdf_pages
        self.max_extracted_text = self.service.config.pdf.max_extracted_text
        
        # Legacy Word settings
        self.max_word_size = self.service.config.word.max_word_size
        self.max_word_pages = self.service.config.word.max_word_pages
        self.max_word_text = self.service.config.word.max_word_text
        
        # Legacy encoding settings
        self.encoding_confidence_threshold = self.service.config.limits.encoding_confidence_threshold
        self.fallback_encodings = self.service.config.limits.fallback_encodings
        
        logger.info("FileProcessorService initialized with modular backend")
    
    def _build_legacy_mime_types_dict(self) -> Dict[str, LegacyContentType]:
        """Build legacy MIME types dictionary for backward compatibility."""
        mime_mapping = {}
        
        for mime_type in get_supported_mime_types():
            if mime_type.startswith('text/') and 'json' not in mime_type and 'csv' not in mime_type:
                if any(code_type in mime_type for code_type in ['python', 'javascript']):
                    mime_mapping[mime_type] = LegacyContentType.CODE
                elif any(markup_type in mime_type for markup_type in ['html', 'xml']):
                    mime_mapping[mime_type] = LegacyContentType.MARKUP
                else:
                    mime_mapping[mime_type] = LegacyContentType.PLAIN_TEXT
            elif mime_type in ['text/csv', 'application/json', 'application/pdf'] or 'word' in mime_type:
                mime_mapping[mime_type] = LegacyContentType.STRUCTURED_DATA
            else:
                mime_mapping[mime_type] = LegacyContentType.PLAIN_TEXT
        
        return mime_mapping
    
    # =============================================================================
    # MAIN PROCESSING METHODS (Updated to use Modular Backend)
    # =============================================================================
    
    async def process_text_file(
        self, 
        file_upload: FileUpload,
        include_metadata: bool = True
    ) -> LegacyProcessedFileContent:
        """
        Main method to process a file for AI consumption.
        
        🎓 LEARNING: Delegation Pattern
        ==============================
        This method now delegates to the modular file processing service:
        1. Call new modular service
        2. Convert result to legacy format
        3. Handle errors appropriately
        4. Maintain exact same interface for existing code
        
        Args:
            file_upload: FileUpload model instance
            include_metadata: Whether to include additional metadata
            
        Returns:
            LegacyProcessedFileContent with AI-ready content (legacy format)
            
        Raises:
            FileProcessingError: If processing fails at any stage
        """
        try:
            logger.info(f"Processing file {file_upload.id}: {file_upload.filename} using modular backend")
            
            # Delegate to new modular service
            result = await process_file(file_upload, include_metadata)
            
            if not result.success:
                # Convert modular error to legacy exception
                error_type = result.error_type or "processing_error"
                
                if "pdf" in error_type:
                    if "password" in error_type:
                        raise PDFPasswordProtectedError(result.error, file_upload.id)
                    elif "corrupted" in error_type:
                        raise PDFCorruptedError(result.error, file_upload.id)
                    elif "no_text" in error_type:
                        raise PDFNoTextError(result.error, file_upload.id)
                    else:
                        raise PDFProcessingError(result.error, file_upload.id)
                
                elif "word" in error_type:
                    if "password" in error_type:
                        raise WordPasswordProtectedError(result.error, file_upload.id)
                    elif "corrupted" in error_type:
                        raise WordCorruptedError(result.error, file_upload.id)
                    elif "unsupported" in error_type:
                        raise WordUnsupportedFormatError(result.error, file_upload.id)
                    elif "macro" in error_type:
                        raise WordMacroContentError(result.error, file_upload.id)
                    else:
                        raise WordProcessingError(result.error, file_upload.id)
                
                elif "file_too_large" in error_type:
                    raise FileTooLargeError(result.error, file_upload.id)
                elif "encoding" in error_type:
                    raise EncodingDetectionError(result.error, file_upload.id)
                elif "content_validation" in error_type:
                    raise ContentValidationError(result.error, file_upload.id)
                else:
                    raise FileProcessingError(result.error, file_upload.id, error_type)
            
            # Convert successful result to legacy format
            return self._convert_to_legacy_format(result.content)
            
        except FileProcessingError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error in legacy wrapper: {str(e)}")
            raise FileProcessingError(
                f"Unexpected error processing {file_upload.filename}: {str(e)}",
                file_upload.id,
                "unexpected_error"
            )
    
    def extract_content_preview(self, content: str, filename: str) -> str:
        """
        Extract a preview of file content for UI display.
        
        This method maintains the legacy interface while using improved logic.
        """
        try:
            if not content:
                return "(Empty file)"
            
            # Use improved preview logic from config
            max_length = self.preview_length
            clean_content = content.strip()
            
            if len(clean_content) <= max_length:
                return clean_content
            
            # Smart truncation - try to end at natural break
            truncated = clean_content[:max_length]
            
            # Try to end at word boundary
            if ' ' in truncated:
                last_space = truncated.rfind(' ')
                if last_space > max_length * 0.7:  # Don't truncate too much
                    truncated = truncated[:last_space]
            
            # Try to end at line break
            if '\n' in truncated:
                last_newline = truncated.rfind('\n')
                if last_newline > max_length * 0.5:
                    truncated = truncated[:last_newline]
            
            return truncated + "..."
            
        except Exception as e:
            logger.warning(f"Preview extraction failed for {filename}: {e}")
            return content[:self.preview_length] + "..." if len(content) > self.preview_length else content
    
    def validate_content_safety(self, content: str, filename: str) -> tuple[bool, Optional[str]]:
        """
        Validate content for basic safety and appropriateness.
        
        This method provides the legacy interface for content validation.
        """
        try:
            # Use validation service if needed, or delegate to processors
            # For now, implement basic validation similar to original
            
            # Check for extremely large content
            if len(content) > self.max_content_size * 2:
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
    # NEW CONVENIENCE METHODS (Using Modular Backend)
    # =============================================================================
    
    async def process_multiple_files(
        self, 
        file_uploads: List[FileUpload], 
        include_metadata: bool = True,
        max_concurrent: int = 3
    ) -> List[LegacyProcessedFileContent]:
        """
        Process multiple files concurrently using the new modular backend.
        
        This is a new method that leverages the modular architecture's
        concurrent processing capabilities.
        """
        try:
            results = await process_multiple_files(file_uploads, include_metadata, max_concurrent)
            
            # Convert all results to legacy format
            legacy_results = []
            for result in results:
                if result.success:
                    legacy_results.append(self._convert_to_legacy_format(result.content))
                else:
                    # Create error result in legacy format
                    error_content = LegacyProcessedFileContent(
                        file_id=0,  # Will be overridden if needed
                        filename="Error",
                        content_type=LegacyContentType.PLAIN_TEXT,
                        processed_content=f"Error: {result.error}",
                        content_length=0,
                        is_truncated=False,
                        truncation_info=None,
                        metadata={"error": result.error, "error_type": result.error_type},
                        processed_at=datetime.utcnow()
                    )
                    legacy_results.append(error_content)
            
            return legacy_results
            
        except Exception as e:
            logger.error(f"Error processing multiple files: {e}")
            raise FileProcessingError(f"Batch processing failed: {str(e)}")
    
    async def get_file_content_preview(
        self, 
        file_upload: FileUpload, 
        max_length: Optional[int] = None
    ) -> str:
        """
        Get a preview of file content without full processing.
        
        This method uses the new modular backend's preview functionality.
        """
        try:
            return await get_file_preview(file_upload, max_length)
        except Exception as e:
            logger.warning(f"Preview generation failed: {e}")
            return f"[Preview unavailable: {str(e)}]"
    
    def get_supported_file_types(self) -> List[str]:
        """Get list of supported MIME types."""
        return get_supported_mime_types()
    
    def is_file_type_supported(self, mime_type: str) -> bool:
        """Check if file type is supported."""
        return is_supported_file_type(mime_type)
    
    def get_processing_statistics(self) -> Dict[str, Any]:
        """Get processing statistics from the modular backend."""
        return self.service.get_processing_stats()
    
    def get_processor_information(self) -> Dict[str, Any]:
        """Get information about available processors."""
        return self.service.get_processor_info()
    
    async def validate_file_for_processing(self, file_upload: FileUpload) -> Dict[str, Any]:
        """Validate file for processing using modular backend."""
        return await self.service.validate_file_for_processing(file_upload)
    
    # =============================================================================
    # LEGACY HELPER METHODS (Preserved for Compatibility)
    # =============================================================================
    
    def _convert_to_legacy_format(self, content: ProcessedFileContent) -> LegacyProcessedFileContent:
        """Convert new ProcessedFileContent to legacy format."""
        # Map new ContentType to legacy ContentType
        content_type_mapping = {
            ContentType.PLAIN_TEXT: LegacyContentType.PLAIN_TEXT,
            ContentType.STRUCTURED_DATA: LegacyContentType.STRUCTURED_DATA,
            ContentType.CODE: LegacyContentType.CODE,
            ContentType.MARKUP: LegacyContentType.MARKUP
        }
        
        legacy_content_type = content_type_mapping.get(content.content_type, LegacyContentType.PLAIN_TEXT)
        
        return LegacyProcessedFileContent(
            file_id=content.file_id,
            filename=content.filename,
            content_type=legacy_content_type,
            processed_content=content.processed_content,
            content_length=content.content_length,
            is_truncated=content.is_truncated,
            truncation_info=content.truncation_info,
            metadata=content.metadata,
            processed_at=content.processed_at
        )
    
    def _appears_to_be_binary(self, content: str) -> bool:
        """Check if content appears to be binary data."""
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
            return True
    
    def _contains_suspicious_patterns(self, content: str) -> bool:
        """Check for basic suspicious patterns in content."""
        try:
            lines = content.split('\n')
            
            # Check for extremely long lines (>10KB)
            for line in lines:
                if len(line) > 10000:
                    return True
            
            # Check for excessive character repetition
            if len(content) > 1000:
                for char in 'A\x00\xff':
                    if content.count(char) > len(content) * 0.5:  # >50% same character
                        return True
            
            # Check for suspicious patterns
            suspicious_patterns = ['eval(', 'exec(', '__import__', 'subprocess.']
            content_lower = content.lower()
            suspicious_count = sum(1 for pattern in suspicious_patterns if pattern in content_lower)
            
            if suspicious_count >= 3:
                return True
            
            return False
            
        except Exception:
            return True
    
    def _has_valid_text_structure(self, content: str) -> bool:
        """Check if content has valid text structure."""
        try:
            if not isinstance(content, str):
                return False
            
            if not content.strip():
                return False
            
            lines = content.split('\n')
            if len(lines) > 100000:  # Too many lines
                return False
            
            return True
            
        except Exception:
            return False


# =============================================================================
# GLOBAL SERVICE INSTANCE (For Backward Compatibility)
# =============================================================================

# Create global instance for backward compatibility with existing code
file_processor_service = FileProcessorService()


# =============================================================================
# CONVENIENCE FUNCTIONS (Legacy Interface)
# =============================================================================

async def process_text_file(
    file_upload: FileUpload,
    include_metadata: bool = True
) -> LegacyProcessedFileContent:
    """
    Convenience function for processing a single file (legacy interface).
    """
    return await file_processor_service.process_text_file(file_upload, include_metadata)


async def process_pdf_file(
    file_upload: FileUpload,
    include_metadata: bool = True
) -> LegacyProcessedFileContent:
    """
    Convenience function for processing a PDF file (legacy interface).
    """
    # PDF processing is now handled by the unified process_text_file method
    return await file_processor_service.process_text_file(file_upload, include_metadata)


async def process_word_file(
    file_upload: FileUpload,
    include_metadata: bool = True
) -> LegacyProcessedFileContent:
    """
    Convenience function for processing a Word file (legacy interface).
    """
    # Word processing is now handled by the unified process_text_file method
    return await file_processor_service.process_text_file(file_upload, include_metadata)


def extract_content_preview(content: str, filename: str) -> str:
    """Convenience function for extracting content preview."""
    return file_processor_service.extract_content_preview(content, filename)


def validate_content_safety(content: str, filename: str) -> tuple[bool, Optional[str]]:
    """Convenience function for content safety validation."""
    return file_processor_service.validate_content_safety(content, filename)


def get_supported_file_types() -> List[str]:
    """Convenience function to get supported file types."""
    return file_processor_service.get_supported_file_types()


def is_file_type_supported(mime_type: str) -> bool:
    """Convenience function to check if file type is supported."""
    return file_processor_service.is_file_type_supported(mime_type)


# =============================================================================
# REFACTORING SUMMARY
# =============================================================================

"""
🎓 REFACTORING COMPLETED: Modular File Processing Architecture

BEFORE (Original file_processor.py):
====================================
- Single 2,500+ line file with all processing logic
- PDF, Word, and text processing mixed together
- Difficult to test individual components
- Hard to add new file types
- Complex error handling scattered throughout
- Tight coupling between different concerns

AFTER (New modular architecture):
================================
- Separated into focused, single-responsibility modules:
  
  📁 /file_processing/
  ├── __init__.py                   # Public API exports
  ├── file_processing_service.py    # Main coordinator service  
  ├── config.py                     # Centralized configuration
  ├── types.py                      # Shared data structures
  ├── /processors/
  │   ├── base_processor.py         # Abstract base class
  │   ├── pdf_processor.py          # PDF-specific logic (~400 lines)
  │   ├── word_processor.py         # Word-specific logic (~400 lines)
  │   ├── text_processor.py         # Text-specific logic (~300 lines)
  │   └── __init__.py               # Processor exports
  ├── /exceptions/
  │   ├── base_exceptions.py        # Base error classes
  │   ├── processing_exceptions.py  # Format-specific errors
  │   └── __init__.py               # Exception exports
  └── /utils/                       # Utility functions (empty for now)

- This file (file_processor.py): Backward-compatible facade (~400 lines)

BENEFITS ACHIEVED:
=================
✅ **Modularity**: Each processor handles only one file type
✅ **Testability**: Individual components can be tested in isolation  
✅ **Maintainability**: Smaller, focused files are easier to understand
✅ **Extensibility**: New file types can be added without touching existing code
✅ **Reusability**: Processors can be used independently
✅ **Error Handling**: Comprehensive, hierarchical exception system
✅ **Configuration**: Centralized, validated settings management
✅ **Backward Compatibility**: Existing code continues to work unchanged
✅ **Performance**: Concurrent processing capabilities
✅ **Documentation**: Extensive learning comments throughout

USAGE EXAMPLES:
==============

# New modular interface (recommended for new code):
from app.services.file_processing import process_file
result = await process_file(file_upload, include_metadata=True)

# Legacy interface (existing code continues to work):
from app.services.file_processor import process_text_file
result = await process_text_file(file_upload, include_metadata=True)

# Concurrent processing (new capability):
from app.services.file_processing import process_multiple_files
results = await process_multiple_files(file_uploads, max_concurrent=5)

# Direct processor access (advanced usage):
from app.services.file_processing import PDFProcessor
pdf_processor = PDFProcessor()
result = await pdf_processor.process(file_upload)

MIGRATION PATH:
==============
1. ✅ Phase 1: Create modular architecture (COMPLETED)
2. ✅ Phase 2: Update original file to use new backend (COMPLETED)  
3. 🔄 Phase 3: Update calling code to use new interface (OPTIONAL)
4. 🔄 Phase 4: Remove legacy wrapper when migration complete (FUTURE)

This refactoring maintains 100% backward compatibility while providing a
foundation for future enhancements and easier maintenance!
"""
