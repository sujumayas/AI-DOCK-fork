"""
File processing exception classes.

This module provides a comprehensive hierarchy of exceptions for different
file processing scenarios, enabling granular error handling and better
user experience.

🎓 LEARNING: Exception Module Organization
========================================
Organizing exceptions in a dedicated module provides:
- Clear error categorization
- Easy imports for consumers
- Consistent error handling patterns
- Better maintenance and testing
"""

# Base exceptions
from .base_exceptions import (
    FileProcessingError,
    ContentValidationError, 
    EncodingDetectionError,
    FileTooLargeError,
    UnsupportedFileTypeError,
    FileNotFoundError
)

# Format-specific exceptions
from .processing_exceptions import (
    # PDF exceptions
    PDFProcessingError,
    PDFPasswordProtectedError,
    PDFCorruptedError,
    PDFNoTextError,
    
    # Word document exceptions
    WordProcessingError,
    WordPasswordProtectedError,
    WordCorruptedError,
    WordUnsupportedFormatError,
    WordMacroContentError,
    
    # Structured data exceptions
    StructuredDataError,
    CSVParsingError,
    JSONParsingError,
    XMLParsingError,
    
    # Text processing exceptions
    TextProcessingError,
    EncodingError,
    ContentFormatError
)

# Export all exceptions for easy importing
__all__ = [
    # Base exceptions
    "FileProcessingError",
    "ContentValidationError",
    "EncodingDetectionError", 
    "FileTooLargeError",
    "UnsupportedFileTypeError",
    "FileNotFoundError",
    
    # PDF exceptions
    "PDFProcessingError",
    "PDFPasswordProtectedError",
    "PDFCorruptedError",
    "PDFNoTextError",
    
    # Word document exceptions
    "WordProcessingError",
    "WordPasswordProtectedError",
    "WordCorruptedError",
    "WordUnsupportedFormatError",
    "WordMacroContentError",
    
    # Structured data exceptions
    "StructuredDataError",
    "CSVParsingError",
    "JSONParsingError",
    "XMLParsingError",
    
    # Text processing exceptions
    "TextProcessingError",
    "EncodingError",
    "ContentFormatError"
]
