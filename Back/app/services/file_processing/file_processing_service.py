"""
Main file processing service manager.

This module provides the primary interface for file processing operations,
coordinating multiple format-specific processors and providing a unified API.

🎓 LEARNING: Service Manager Pattern
===================================
The service manager pattern provides:
- Single entry point for file processing
- Automatic processor selection based on file type
- Centralized error handling and logging
- Performance monitoring and caching
- Extensible architecture for new processors
"""

import logging
import asyncio
from typing import Dict, List, Optional, Type, Any
from datetime import datetime

from .processors import BaseFileProcessor, AVAILABLE_PROCESSORS
from .types import ProcessingResult, ProcessedFileContent, ContentType
from .config import config
from .exceptions import (
    FileProcessingError,
    UnsupportedFileTypeError,
    FileTooLargeError
)
from ..models.file_upload import FileUpload

logger = logging.getLogger(__name__)


class FileProcessingService:
    """
    Main file processing service that coordinates all format-specific processors.
    
    🎓 LEARNING: Service Manager Design
    =================================
    The service manager encapsulates:
    - Processor discovery and registration
    - File type detection and routing
    - Error handling and recovery
    - Performance monitoring
    - Caching and optimization
    """
    
    def __init__(self):
        """Initialize the service with available processors."""
        self.processors: Dict[str, BaseFileProcessor] = {}
        self.mime_type_mapping: Dict[str, str] = {}
        self._initialize_processors()
        self.processing_stats = {
            'files_processed': 0,
            'total_processing_time_ms': 0,
            'errors_count': 0,
            'average_processing_time_ms': 0
        }
    
    def _initialize_processors(self) -> None:
        """
        Initialize and register all available processors.
        
        🎓 LEARNING: Dynamic Processor Registration
        ==========================================
        Dynamic registration allows:
        - Easy addition of new processors
        - Graceful handling of missing dependencies
        - Runtime configuration of available formats
        """
        self.processors.clear()
        self.mime_type_mapping.clear()
        
        for processor_class in AVAILABLE_PROCESSORS:
            try:
                # Try to instantiate the processor
                processor = processor_class()
                processor_name = processor_class.__name__
                
                self.processors[processor_name] = processor
                
                # Map MIME types to processor names
                if hasattr(processor, 'SUPPORTED_MIME_TYPES'):
                    for mime_type in processor.SUPPORTED_MIME_TYPES:
                        self.mime_type_mapping[mime_type] = processor_name
                
                logger.info(f"Registered processor: {processor_name}")
                
            except Exception as e:
                logger.warning(
                    f"Failed to initialize processor {processor_class.__name__}: {e}"
                )
                # Continue with other processors even if one fails
        
        logger.info(
            f"File processing service initialized with {len(self.processors)} processors "
            f"supporting {len(self.mime_type_mapping)} MIME types"
        )
    
    def get_supported_mime_types(self) -> List[str]:
        """Get list of all supported MIME types."""
        return list(self.mime_type_mapping.keys())
    
    def is_supported_file_type(self, mime_type: str) -> bool:
        """Check if the given MIME type is supported."""
        return mime_type in self.mime_type_mapping
    
    def get_processor_for_file(self, mime_type: str) -> Optional[BaseFileProcessor]:
        """Get the appropriate processor for a given MIME type."""
        processor_name = self.mime_type_mapping.get(mime_type)
        if processor_name:
            return self.processors.get(processor_name)
        return None
    
    async def process_file(
        self, 
        file_upload: FileUpload, 
        include_metadata: bool = True
    ) -> ProcessingResult:
        """
        Process a file using the appropriate processor.
        
        🎓 LEARNING: Main Processing Workflow
        ===================================
        The main processing workflow:
        1. Validate file and check support
        2. Select appropriate processor
        3. Process file with error handling
        4. Update statistics and metrics
        5. Return structured result
        
        Args:
            file_upload: FileUpload model instance to process
            include_metadata: Whether to include detailed metadata
            
        Returns:
            ProcessingResult with success/error information
        """
        start_time = datetime.utcnow()
        
        try:
            # Validate input
            if not file_upload:
                return ProcessingResult.error_result(
                    "No file upload provided",
                    "invalid_input"
                )
            
            # Check if file type is supported
            if not self.is_supported_file_type(file_upload.mime_type):
                supported_types = ', '.join(self.get_supported_mime_types())
                return ProcessingResult.error_result(
                    f"Unsupported file type: {file_upload.mime_type}. "
                    f"Supported types: {supported_types}",
                    "unsupported_file_type"
                )
            
            # Get appropriate processor
            processor = self.get_processor_for_file(file_upload.mime_type)
            if not processor:
                return ProcessingResult.error_result(
                    f"No processor available for MIME type: {file_upload.mime_type}",
                    "no_processor"
                )
            
            # Log processing start
            logger.info(
                f"Processing {file_upload.filename} ({file_upload.mime_type}) "
                f"with {processor.__class__.__name__}"
            )
            
            # Process the file
            result = await processor.process(file_upload, include_metadata)
            
            # Update statistics
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            await self._update_processing_stats(result.success, int(processing_time))
            
            # Log result
            if result.success:
                content_length = len(result.content.processed_content) if result.content else 0
                logger.info(
                    f"Successfully processed {file_upload.filename}: "
                    f"{content_length} chars in {processing_time:.1f}ms"
                )
            else:
                logger.error(
                    f"Failed to process {file_upload.filename}: "
                    f"{result.error} (type: {result.error_type})"
                )
            
            return result
            
        except Exception as e:
            # Handle unexpected errors
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            error_msg = f"Unexpected error processing {file_upload.filename}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            
            await self._update_processing_stats(False, int(processing_time))
            
            return ProcessingResult.error_result(
                error_msg,
                "unexpected_error",
                int(processing_time)
            )
    
    async def process_multiple_files(
        self, 
        file_uploads: List[FileUpload], 
        include_metadata: bool = True,
        max_concurrent: int = 3
    ) -> List[ProcessingResult]:
        """
        Process multiple files concurrently.
        
        🎓 LEARNING: Concurrent File Processing
        ======================================
        Concurrent processing considerations:
        - Limit concurrent operations to avoid resource exhaustion
        - Handle individual file errors gracefully
        - Maintain processing order for results
        - Monitor overall performance
        
        Args:
            file_uploads: List of FileUpload instances to process
            include_metadata: Whether to include detailed metadata
            max_concurrent: Maximum number of concurrent processing operations
            
        Returns:
            List of ProcessingResults in the same order as input
        """
        if not file_uploads:
            return []
        
        logger.info(f"Processing {len(file_uploads)} files with max {max_concurrent} concurrent")
        
        # Create semaphore to limit concurrent operations
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def process_with_semaphore(file_upload: FileUpload) -> ProcessingResult:
            async with semaphore:
                return await self.process_file(file_upload, include_metadata)
        
        # Start all processing tasks
        tasks = [
            process_with_semaphore(file_upload) 
            for file_upload in file_uploads
        ]
        
        # Wait for all to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle any exceptions that occurred
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Exception processing file {i}: {result}")
                final_results.append(
                    ProcessingResult.error_result(
                        f"Processing exception: {str(result)}",
                        "processing_exception"
                    )
                )
            else:
                final_results.append(result)
        
        # Log summary
        successful = sum(1 for r in final_results if r.success)
        failed = len(final_results) - successful
        logger.info(
            f"Batch processing complete: {successful} successful, {failed} failed"
        )
        
        return final_results
    
    async def get_file_content_preview(
        self, 
        file_upload: FileUpload, 
        max_length: Optional[int] = None
    ) -> str:
        """
        Get a preview of file content without full processing.
        
        🎓 LEARNING: Preview Generation
        =============================
        Previews are useful for:
        - Quick content validation
        - User interface display
        - File selection assistance
        - Performance optimization
        
        Args:
            file_upload: FileUpload to preview
            max_length: Maximum preview length (defaults to config)
            
        Returns:
            Preview text content
        """
        if max_length is None:
            max_length = config.limits.preview_length
        
        try:
            # Process the file normally but truncate for preview
            result = await self.process_file(file_upload, include_metadata=False)
            
            if result.success and result.content:
                content = result.content.processed_content
                if len(content) <= max_length:
                    return content
                else:
                    # Truncate at word boundary if possible
                    truncated = content[:max_length]
                    last_space = truncated.rfind(' ')
                    if last_space > max_length * 0.8:  # If space is reasonably close to end
                        truncated = truncated[:last_space]
                    return truncated + "..."
            else:
                return f"[Error: {result.error}]"
                
        except Exception as e:
            logger.warning(f"Error generating preview for {file_upload.filename}: {e}")
            return f"[Preview unavailable: {str(e)}]"
    
    async def _update_processing_stats(self, success: bool, processing_time_ms: int) -> None:
        """Update internal processing statistics."""
        self.processing_stats['files_processed'] += 1
        self.processing_stats['total_processing_time_ms'] += processing_time_ms
        
        if not success:
            self.processing_stats['errors_count'] += 1
        
        # Update average
        if self.processing_stats['files_processed'] > 0:
            self.processing_stats['average_processing_time_ms'] = (
                self.processing_stats['total_processing_time_ms'] / 
                self.processing_stats['files_processed']
            )
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get current processing statistics."""
        return self.processing_stats.copy()
    
    def get_processor_info(self) -> Dict[str, Any]:
        """Get information about available processors."""
        processor_info = {}
        
        for name, processor in self.processors.items():
            supported_types = []
            for mime_type, processor_name in self.mime_type_mapping.items():
                if processor_name == name:
                    supported_types.append(mime_type)
            
            processor_info[name] = {
                'class': processor.__class__.__name__,
                'supported_mime_types': supported_types,
                'description': processor.__class__.__doc__.split('\\n')[0] if processor.__class__.__doc__ else ""
            }
        
        return processor_info
    
    async def validate_file_for_processing(self, file_upload: FileUpload) -> Dict[str, Any]:
        """
        Validate a file for processing without actually processing it.
        
        Returns validation information including:
        - Whether file is supported
        - Which processor would be used
        - Any validation warnings
        - Size and format information
        """
        validation_result = {
            'is_supported': False,
            'processor': None,
            'mime_type': file_upload.mime_type,
            'file_size': file_upload.file_size,
            'warnings': [],
            'errors': []
        }
        
        try:
            # Check if file type is supported
            if not self.is_supported_file_type(file_upload.mime_type):
                validation_result['errors'].append(
                    f"Unsupported file type: {file_upload.mime_type}"
                )
                return validation_result
            
            # Get processor
            processor = self.get_processor_for_file(file_upload.mime_type)
            if not processor:
                validation_result['errors'].append(
                    f"No processor available for {file_upload.mime_type}"
                )
                return validation_result
            
            validation_result['is_supported'] = True
            validation_result['processor'] = processor.__class__.__name__
            
            # Run processor validation
            try:
                processor.validate_file(file_upload)
            except FileProcessingError as e:
                validation_result['errors'].append(e.message)
                validation_result['is_supported'] = False
            
            # Check size limits
            size_limit = config.get_size_limit(file_upload.mime_type)
            if file_upload.file_size > size_limit:
                validation_result['warnings'].append(
                    f"File size ({file_upload.file_size} bytes) exceeds recommended limit ({size_limit} bytes)"
                )
            
            return validation_result
            
        except Exception as e:
            validation_result['errors'].append(f"Validation error: {str(e)}")
            return validation_result


# Global service instance
file_processing_service = FileProcessingService()


# Convenience functions for easy access
async def process_file(
    file_upload: FileUpload, 
    include_metadata: bool = True
) -> ProcessingResult:
    """Convenience function to process a single file."""
    return await file_processing_service.process_file(file_upload, include_metadata)


async def process_multiple_files(
    file_uploads: List[FileUpload], 
    include_metadata: bool = True,
    max_concurrent: int = 3
) -> List[ProcessingResult]:
    """Convenience function to process multiple files."""
    return await file_processing_service.process_multiple_files(
        file_uploads, include_metadata, max_concurrent
    )


async def get_file_preview(
    file_upload: FileUpload, 
    max_length: Optional[int] = None
) -> str:
    """Convenience function to get file content preview."""
    return await file_processing_service.get_file_content_preview(file_upload, max_length)


def get_supported_mime_types() -> List[str]:
    """Convenience function to get supported MIME types."""
    return file_processing_service.get_supported_mime_types()


def is_supported_file_type(mime_type: str) -> bool:
    """Convenience function to check if file type is supported."""
    return file_processing_service.is_supported_file_type(mime_type)
