"""
Configuration settings for file processing.

Centralizes all processing limits, settings, and format-specific configurations
to make them easy to modify and maintain.

🎓 LEARNING: Configuration Management
===================================
Centralized configuration provides:
- Single source of truth for settings
- Easy environment-based overrides
- Clear documentation of limits
- Type safety with validation
"""

from dataclasses import dataclass
from typing import Dict, List
from ..core.config import settings


@dataclass
class ProcessingLimits:
    """Core processing limits for all file types."""
    
    # Maximum content size for AI processing (50KB default)
    max_ai_content_size: int = 50 * 1024
    
    # Maximum preview length for UI (200 chars default)
    preview_length: int = 200
    
    # Encoding detection confidence threshold
    encoding_confidence_threshold: float = 0.7
    
    # Fallback encodings to try
    fallback_encodings: List[str] = None
    
    def __post_init__(self):
        if self.fallback_encodings is None:
            self.fallback_encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']


@dataclass
class PDFProcessingConfig:
    """Configuration specific to PDF processing."""
    
    # Maximum PDF file size (25MB)
    max_pdf_size: int = 25 * 1024 * 1024
    
    # Maximum pages to process 
    max_pdf_pages: int = 50
    
    # Maximum extracted text size (100KB)
    max_extracted_text: int = 100 * 1024


@dataclass
class WordProcessingConfig:
    """Configuration specific to Word document processing."""
    
    # Maximum Word document size (20MB)
    max_word_size: int = 20 * 1024 * 1024
    
    # Maximum pages to process
    max_word_pages: int = 100
    
    # Maximum extracted text size (150KB - Word is usually more text-dense)
    max_word_text: int = 150 * 1024


@dataclass
class StructuredDataConfig:
    """Configuration for structured data processing (CSV, JSON)."""
    
    # Maximum rows to analyze for CSV structure
    max_csv_sample_rows: int = 5
    
    # Maximum JSON preview size
    max_json_preview: int = 500
    
    # Maximum items to show in JSON arrays
    max_json_items: int = 3


class FileProcessingConfig:
    """
    Main configuration class for file processing.
    
    🎓 LEARNING: Configuration Class Design
    =====================================
    Configuration classes should:
    - Provide sensible defaults
    - Allow environment overrides
    - Validate settings on creation
    - Be easily testable
    """
    
    def __init__(self):
        """Initialize configuration with settings from environment."""
        
        # Core processing limits
        self.limits = ProcessingLimits(
            max_ai_content_size=getattr(settings, 'max_ai_content_size', 50 * 1024),
            preview_length=getattr(settings, 'file_content_preview_length', 200),
            encoding_confidence_threshold=getattr(settings, 'encoding_confidence_threshold', 0.7)
        )
        
        # PDF processing configuration
        self.pdf = PDFProcessingConfig(
            max_pdf_size=getattr(settings, 'max_pdf_size', 25 * 1024 * 1024),
            max_pdf_pages=getattr(settings, 'max_pdf_pages', 50),
            max_extracted_text=getattr(settings, 'max_extracted_text', 100 * 1024)
        )
        
        # Word processing configuration
        self.word = WordProcessingConfig(
            max_word_size=getattr(settings, 'max_word_size', 20 * 1024 * 1024),
            max_word_pages=getattr(settings, 'max_word_pages', 100),
            max_word_text=getattr(settings, 'max_word_text', 150 * 1024)
        )
        
        # Structured data configuration
        self.structured = StructuredDataConfig(
            max_csv_sample_rows=getattr(settings, 'max_csv_sample_rows', 5),
            max_json_preview=getattr(settings, 'max_json_preview', 500),
            max_json_items=getattr(settings, 'max_json_items', 3)
        )
        
        # Supported MIME types mapping
        self.supported_mime_types = {
            'text/plain': 'plain_text',
            'text/markdown': 'plain_text',
            'text/csv': 'structured_data',
            'application/json': 'structured_data',
            'text/x-python': 'code',
            'text/javascript': 'code',
            'text/html': 'markup',
            'application/xml': 'markup',
            'text/xml': 'markup',
            'application/pdf': 'structured_data',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'structured_data',
            'application/msword': 'structured_data'
        }
        
        # Human-readable file type names
        self.file_type_names = {
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
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (.docx)',
            'application/msword': 'Word Document (.doc)'
        }
    
    def is_supported_type(self, mime_type: str) -> bool:
        """Check if MIME type is supported for processing."""
        return mime_type in self.supported_mime_types
    
    def get_content_type(self, mime_type: str) -> str:
        """Get content type category for MIME type."""
        return self.supported_mime_types.get(mime_type, 'plain_text')
    
    def get_human_readable_type(self, mime_type: str) -> str:
        """Get human-readable name for MIME type."""
        return self.file_type_names.get(mime_type, mime_type)
    
    def get_size_limit(self, mime_type: str) -> int:
        """Get appropriate size limit for file type."""
        if mime_type == 'application/pdf':
            return self.pdf.max_pdf_size
        elif mime_type in [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ]:
            return self.word.max_word_size
        else:
            return self.limits.max_ai_content_size
    
    def validate_config(self) -> None:
        """Validate configuration settings."""
        errors = []
        
        # Validate core limits
        if self.limits.max_ai_content_size <= 0:
            errors.append("max_ai_content_size must be positive")
        
        if self.limits.preview_length <= 0:
            errors.append("preview_length must be positive")
        
        if not 0 < self.limits.encoding_confidence_threshold <= 1:
            errors.append("encoding_confidence_threshold must be between 0 and 1")
        
        # Validate PDF limits
        if self.pdf.max_pdf_size <= 0:
            errors.append("max_pdf_size must be positive")
        
        if self.pdf.max_pdf_pages <= 0:
            errors.append("max_pdf_pages must be positive")
        
        # Validate Word limits
        if self.word.max_word_size <= 0:
            errors.append("max_word_size must be positive")
        
        if self.word.max_word_pages <= 0:
            errors.append("max_word_pages must be positive")
        
        if errors:
            raise ValueError(f"Invalid configuration: {', '.join(errors)}")


# Global configuration instance
config = FileProcessingConfig()

# Validate configuration on import
config.validate_config()
