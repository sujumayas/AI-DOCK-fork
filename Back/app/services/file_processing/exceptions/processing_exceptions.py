"""
Format-specific exception classes for file processing.

This module contains specialized exceptions for different file formats,
providing specific error handling for PDFs, Word documents, and other formats.

🎓 LEARNING: Specialized Exception Design
======================================
Format-specific exceptions help with:
- Targeted error handling strategies
- User-friendly error messages
- Format-specific recovery options
- Better debugging and monitoring
"""

from .base_exceptions import FileProcessingError
from typing import Optional


# =============================================================================
# PDF PROCESSING EXCEPTIONS
# =============================================================================

class PDFProcessingError(FileProcessingError):
    """
    Base exception for PDF processing errors.
    
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


# =============================================================================
# WORD DOCUMENT PROCESSING EXCEPTIONS
# =============================================================================

class WordProcessingError(FileProcessingError):
    """
    Base exception for Word document processing errors.
    
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


# =============================================================================
# STRUCTURED DATA PROCESSING EXCEPTIONS
# =============================================================================

class StructuredDataError(FileProcessingError):
    """Base exception for structured data processing (CSV, JSON, etc.)."""
    
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "structured_data_error")


class CSVParsingError(StructuredDataError):
    """Raised when CSV file cannot be parsed."""
    
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "csv_parsing_error")


class JSONParsingError(StructuredDataError):
    """Raised when JSON file cannot be parsed."""
    
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "json_parsing_error")


class XMLParsingError(StructuredDataError):
    """Raised when XML/HTML file cannot be parsed."""
    
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "xml_parsing_error")


# =============================================================================
# TEXT PROCESSING EXCEPTIONS
# =============================================================================

class TextProcessingError(FileProcessingError):
    """Base exception for text file processing."""
    
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "text_processing_error")


class EncodingError(TextProcessingError):
    """Raised when text encoding issues occur."""
    
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "text_encoding_error")


class ContentFormatError(TextProcessingError):
    """Raised when content format is invalid for processing."""
    
    def __init__(self, message: str, file_id: Optional[int] = None):
        super().__init__(message, file_id, "content_format_error")
