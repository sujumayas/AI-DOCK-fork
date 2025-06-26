"""
Shared type definitions for file processing.

This module contains common type definitions, enums, and data structures
used throughout the file processing system.

🎓 LEARNING: Type Definition Organization
======================================
Centralized type definitions provide:
- Consistent types across all modules
- Easy refactoring and updates
- Better IDE support and autocomplete
- Clear contracts between components
"""

from enum import Enum
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from dataclasses import dataclass


class ContentType(Enum):
    """
    Enumeration of content types for processed files.
    
    🎓 LEARNING: Content Type Classification
    ======================================
    Categorizing content helps AI understand context:
    - PLAIN_TEXT: Simple text files
    - STRUCTURED_DATA: CSV, JSON, PDF with structure
    - CODE: Programming language files
    - MARKUP: HTML, XML with tags
    """
    PLAIN_TEXT = "plain_text"
    STRUCTURED_DATA = "structured_data"
    CODE = "code"
    MARKUP = "markup"


class FileProcessingStatus(Enum):
    """Status indicators for file processing operations."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ProcessedFileContent:
    """
    Result container for processed file content.
    
    🎓 LEARNING: Result Object Pattern
    =================================
    Result objects encapsulate:
    - Primary data (processed content)
    - Metadata about the operation
    - Status and error information
    - Performance metrics
    """
    file_id: int
    filename: str
    content_type: ContentType
    processed_content: str
    content_length: int
    is_truncated: bool = False
    truncation_info: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    processed_at: Optional[datetime] = None
    processing_time_ms: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "file_id": self.file_id,
            "filename": self.filename,
            "content_type": self.content_type.value,
            "processed_content": self.processed_content,
            "content_length": self.content_length,
            "is_truncated": self.is_truncated,
            "truncation_info": self.truncation_info,
            "metadata": self.metadata,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "processing_time_ms": self.processing_time_ms
        }


@dataclass
class ContentMetadata:
    """Metadata about processed content."""
    original_size_bytes: int
    content_length: int
    line_count: int
    word_count: int
    file_extension: str
    mime_type: str
    encoding: str
    character_distribution: Optional[Dict[str, int]] = None
    content_type_hints: Optional[List[str]] = None
    processing_timestamp: Optional[str] = None


@dataclass
class PDFMetadata:
    """Metadata specific to PDF documents."""
    page_count: int
    extracted_text_length: int
    pages_with_text: int
    document_metadata: Dict[str, Any]
    extraction_method: str = "pdfplumber"


@dataclass
class WordMetadata:
    """Metadata specific to Word documents."""
    word_count: int
    page_count: int
    extracted_text_length: int
    structure_elements: int
    document_metadata: Dict[str, Any]
    format_type: str  # .doc or .docx


@dataclass
class StructuredDataMetadata:
    """Metadata for structured data files (CSV, JSON)."""
    data_type: str  # csv, json, xml
    structure_info: Dict[str, Any]
    sample_data: Optional[Dict[str, Any]] = None


@dataclass
class ProcessingResult:
    """Result of a file processing operation."""
    success: bool
    content: Optional[ProcessedFileContent] = None
    error: Optional[str] = None
    error_type: Optional[str] = None
    processing_time_ms: Optional[int] = None
    
    @classmethod
    def success_result(
        cls, 
        content: ProcessedFileContent, 
        processing_time_ms: Optional[int] = None
    ) -> 'ProcessingResult':
        """Create a successful processing result."""
        return cls(
            success=True,
            content=content,
            processing_time_ms=processing_time_ms
        )
    
    @classmethod
    def error_result(
        cls, 
        error: str, 
        error_type: str = "processing_error",
        processing_time_ms: Optional[int] = None
    ) -> 'ProcessingResult':
        """Create an error processing result."""
        return cls(
            success=False,
            error=error,
            error_type=error_type,
            processing_time_ms=processing_time_ms
        )


# Type aliases for common use cases
FileContent = Union[str, bytes]
MetadataDict = Dict[str, Any]
ProcessorResult = ProcessingResult
