"""
File processing module for AI Dock.

This module provides comprehensive file processing capabilities for multiple formats
including PDF, Word documents, and plain text files. It offers a clean, modular
architecture with format-specific processors and a unified service interface.

🎓 LEARNING: Module Organization Best Practices
=============================================
Well-organized modules provide:
- Clear public API through __init__.py
- Easy imports for consumers
- Logical component separation
- Extensible architecture
- Comprehensive error handling

Key Components:
- file_processing_service: Main service interface
- processors: Format-specific processors
- types: Shared type definitions  
- exceptions: Comprehensive error handling
- config: Centralized configuration
"""

# Import main service interface
from .file_processing_service import (
    FileProcessingService,
    file_processing_service,
    process_file,
    process_multiple_files,
    get_file_preview,
    get_supported_mime_types,
    is_supported_file_type
)

# Import key types for external use
from .types import (
    ProcessingResult,
    ProcessedFileContent,
    ContentType,
    FileProcessingStatus
)

# Import configuration
from .config import config

# Import base exception for error handling
from .exceptions import FileProcessingError

# Import processors for advanced use cases
from .processors import (
    BaseFileProcessor,
    PDFProcessor,
    WordProcessor,
    TextProcessor
)

# Export public API
__all__ = [
    # Main service interface
    "FileProcessingService",
    "file_processing_service",
    "process_file", 
    "process_multiple_files",
    "get_file_preview",
    "get_supported_mime_types",
    "is_supported_file_type",
    
    # Types
    "ProcessingResult",
    "ProcessedFileContent", 
    "ContentType",
    "FileProcessingStatus",
    
    # Configuration
    "config",
    
    # Exceptions
    "FileProcessingError",
    
    # Processors (for advanced usage)
    "BaseFileProcessor",
    "PDFProcessor", 
    "WordProcessor",
    "TextProcessor"
]

# Module metadata
__version__ = "1.0.0"
__author__ = "AI Dock Team"
__description__ = "Comprehensive file processing for AI applications"

# Supported MIME types (for quick reference)
SUPPORTED_MIME_TYPES = [
    # Text files
    'text/plain',
    'text/markdown', 
    'text/x-python',
    'text/javascript',
    'text/css',
    'text/html',
    'text/xml',
    'application/xml',
    'text/csv',
    
    # PDF files
    'application/pdf',
    
    # Word documents  
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # .docx
    'application/msword'  # .doc (limited support)
]

# File extension mapping
FILE_EXTENSION_MAPPING = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown', 
    '.py': 'text/x-python',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.xml': 'text/xml',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword'
}


def get_mime_type_from_extension(file_extension: str) -> str:
    """
    Get MIME type from file extension.
    
    Args:
        file_extension: File extension (with or without leading dot)
        
    Returns:
        MIME type string or 'application/octet-stream' if unknown
    """
    if not file_extension.startswith('.'):
        file_extension = '.' + file_extension
    
    return FILE_EXTENSION_MAPPING.get(file_extension.lower(), 'application/octet-stream')


def get_processor_for_extension(file_extension: str) -> str:
    """
    Get recommended processor name for file extension.
    
    Args:
        file_extension: File extension (with or without leading dot)
        
    Returns:
        Processor class name or empty string if not supported
    """
    mime_type = get_mime_type_from_extension(file_extension)
    
    if mime_type == 'application/pdf':
        return 'PDFProcessor'
    elif mime_type.startswith('application/vnd.openxmlformats') or mime_type == 'application/msword':
        return 'WordProcessor' 
    elif mime_type.startswith('text/'):
        return 'TextProcessor'
    else:
        return ''


# Initialize the service on module import
try:
    # Ensure service is properly initialized
    supported_types = get_supported_mime_types()
    print(f"File processing service initialized with {len(supported_types)} supported formats")
except Exception as e:
    print(f"Warning: File processing service initialization error: {e}")
