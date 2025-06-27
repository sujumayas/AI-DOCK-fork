"""
File Services Module - Modular File Processing Components

This module provides atomic, specialized services for file operations:
- FileValidationService: File validation and safety checks
- TextExtractionService: Multi-format text extraction
- FileStorageService: Database storage operations
- FileRetrievalService: Access control and file retrieval
- FileDeletionService: Soft and hard deletion operations
- FileAnalyticsService: Statistics and usage analytics
- FileHealthService: System health monitoring
- FileUtilityService: Configuration and utility functions

🎓 LEARNING: Clean Module Exports
================================
This __init__.py file provides:
- Clean imports for all services
- Single point of access
- Easy service instantiation
- Clear module structure
- Follows integration guide patterns
"""

# Import all atomic services
from .validation_service import FileValidationService
from .extraction_service import TextExtractionService
from .storage_service import FileStorageService
from .retrieval_service import FileRetrievalService
from .deletion_service import FileDeletionService
from .analytics_service import FileAnalyticsService
from .health_service import FileHealthService
from .utility_service import FileUtilityService

# Export all services for clean imports
__all__ = [
    'FileValidationService',
    'TextExtractionService', 
    'FileStorageService',
    'FileRetrievalService',
    'FileDeletionService',
    'FileAnalyticsService',
    'FileHealthService',
    'FileUtilityService'
]

# Service instantiation helpers
def create_validation_service() -> FileValidationService:
    """Create and return a FileValidationService instance."""
    return FileValidationService()

def create_extraction_service() -> TextExtractionService:
    """Create and return a TextExtractionService instance."""
    return TextExtractionService()

def create_storage_service() -> FileStorageService:
    """Create and return a FileStorageService instance."""
    return FileStorageService()

def create_retrieval_service() -> FileRetrievalService:
    """Create and return a FileRetrievalService instance."""
    return FileRetrievalService()

def create_deletion_service() -> FileDeletionService:
    """Create and return a FileDeletionService instance."""
    return FileDeletionService()

def create_analytics_service() -> FileAnalyticsService:
    """Create and return a FileAnalyticsService instance."""
    return FileAnalyticsService()

def create_health_service() -> FileHealthService:
    """Create and return a FileHealthService instance."""
    return FileHealthService()

def create_utility_service() -> FileUtilityService:
    """Create and return a FileUtilityService instance."""
    return FileUtilityService()

# Convenience function to create all services
def create_all_services() -> dict:
    """
    Create instances of all file services.
    
    Returns:
        Dictionary with all service instances
    """
    return {
        'validation': create_validation_service(),
        'extraction': create_extraction_service(),
        'storage': create_storage_service(),
        'retrieval': create_retrieval_service(),
        'deletion': create_deletion_service(),
        'analytics': create_analytics_service(),
        'health': create_health_service(),
        'utility': create_utility_service()
    }
