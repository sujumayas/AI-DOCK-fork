"""
Base exception classes for file processing.

This module contains the foundational exception classes that all other
file processing exceptions inherit from.

🎓 LEARNING: Exception Hierarchy Design
====================================
Well-designed exception hierarchies provide:
- Clear error categorization
- Granular error handling options
- Consistent error attributes
- Easy debugging and logging
"""

from typing import Optional


class FileProcessingError(Exception):
    """
    Base exception for all file processing errors.
    
    🎓 LEARNING: Base Exception Design
    =================================
    Base exceptions should:
    - Provide common functionality for all derived exceptions
    - Include contextual information (file_id, error_type)
    - Support different error handling strategies
    - Enable consistent logging and monitoring
    """
    
    def __init__(
        self, 
        message: str, 
        file_id: Optional[int] = None, 
        error_type: str = "processing_error"
    ):
        self.message = message
        self.file_id = file_id
        self.error_type = error_type
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        """Convert exception to dictionary for API responses."""
        return {
            "error": self.message,
            "error_type": self.error_type,
            "file_id": self.file_id
        }


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


class UnsupportedFileTypeError(FileProcessingError):
    """Raised when file type is not supported for processing."""
    
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "unsupported_file_type")


class FileNotFoundError(FileProcessingError):
    """Raised when file cannot be found for processing."""
    
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "file_not_found")
