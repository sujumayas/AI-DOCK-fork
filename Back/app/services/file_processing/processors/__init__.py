"""
File processors module.

This module provides access to all file format processors and the main
file processing service manager.

🎓 LEARNING: Processor Module Organization
========================================
Organizing processors in a dedicated module provides:
- Clean imports for consumers
- Easy discovery of available processors  
- Centralized processor registration
- Extensible architecture for new formats
"""

from .base_processor import BaseFileProcessor
from .pdf_processor import PDFProcessor
from .word_processor import WordProcessor
from .text_processor import TextProcessor

# Export all processors for easy importing
__all__ = [
    "BaseFileProcessor",
    "PDFProcessor", 
    "WordProcessor",
    "TextProcessor"
]

# Registry of available processors (used by the service manager)
AVAILABLE_PROCESSORS = [
    PDFProcessor,
    WordProcessor, 
    TextProcessor
]
