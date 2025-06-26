"""
Base file processor interface and abstract implementation.

This module defines the contract that all file processors must implement,
ensuring consistent behavior across different file types.

🎓 LEARNING: Abstract Base Class Design
====================================
Abstract base classes provide:
- Consistent interface contracts
- Shared functionality implementation
- Template method patterns
- Polymorphic behavior support
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime

from ..types import ProcessedFileContent, ContentType, ProcessingResult
from ..config import config
from ..exceptions import FileProcessingError, UnsupportedFileTypeError
from ...models.file_upload import FileUpload

logger = logging.getLogger(__name__)


class BaseFileProcessor(ABC):
    """
    Abstract base class for all file processors.
    
    🎓 LEARNING: Strategy Pattern Implementation
    ==========================================
    This abstract base class enables the Strategy pattern:
    - Define common interface for all processors
    - Allow runtime selection of processing strategy
    - Encapsulate format-specific algorithms
    - Enable easy extension with new formats
    """
    
    def __init__(self):
        """Initialize the processor with configuration."""
        self.config = config
        self.logger = logger
    
    @abstractmethod
    def can_process(self, mime_type: str) -> bool:
        """
        Check if this processor can handle the given MIME type.
        
        Args:
            mime_type: MIME type of the file
            
        Returns:
            True if this processor can handle the file type
        """
        pass
    
    @abstractmethod
    async def extract_content(self, file_upload: FileUpload) -> str:
        """
        Extract content from the file.
        
        Args:
            file_upload: FileUpload model instance
            
        Returns:
            Extracted content as string
            
        Raises:
            FileProcessingError: If content extraction fails
        """
        pass
    
    @abstractmethod
    def get_content_type(self, mime_type: str) -> ContentType:
        """
        Get the appropriate ContentType for the MIME type.
        
        Args:
            mime_type: MIME type of the file
            
        Returns:
            ContentType enum value
        """
        pass
    
    def validate_file(self, file_upload: FileUpload) -> None:
        """
        Validate that the file can be processed.
        
        🎓 LEARNING: Template Method Pattern
        ===================================
        This method provides a template for validation:
        1. Common validation (size, existence)
        2. Format-specific validation (overrideable)
        3. Consistent error handling
        
        Args:
            file_upload: FileUpload to validate
            
        Raises:
            FileProcessingError: If validation fails
        """
        # Check if processor supports this file type
        if not self.can_process(file_upload.mime_type):
            raise UnsupportedFileTypeError(
                f"Processor {self.__class__.__name__} cannot handle {file_upload.mime_type}",
                file_upload.id
            )
        
        # Check file exists (for disk-based files) or has content (for DB-stored files)
        if hasattr(file_upload, 'file_path') and file_upload.file_path:
            # Disk-based file validation
            from pathlib import Path
            if not Path(file_upload.file_path).exists():
                raise FileProcessingError(
                    f"File {file_upload.filename} not found on disk",
                    file_upload.id,
                    "file_not_found"
                )
        elif hasattr(file_upload, 'text_content'):
            # Database-stored file validation
            if not file_upload.text_content:
                raise FileProcessingError(
                    f"No content found for file {file_upload.filename}",
                    file_upload.id,
                    "no_content"
                )
        else:
            raise FileProcessingError(
                f"File {file_upload.filename} has no accessible content",
                file_upload.id,
                "no_content_source"
            )
        
        # Check file size against appropriate limit
        size_limit = self.config.get_size_limit(file_upload.mime_type)
        if file_upload.file_size > size_limit:
            raise FileProcessingError(
                f"File {file_upload.filename} too large: {file_upload.file_size} bytes (max {size_limit})",
                file_upload.id,
                "file_too_large"
            )
        
        # Format-specific validation (can be overridden)
        self.validate_format_specific(file_upload)
    
    def validate_format_specific(self, file_upload: FileUpload) -> None:
        """
        Format-specific validation that can be overridden by subclasses.
        
        Args:
            file_upload: FileUpload to validate
        """
        # Default implementation does nothing
        # Subclasses can override for specific validation
        pass
    
    async def process(
        self, 
        file_upload: FileUpload, 
        include_metadata: bool = True
    ) -> ProcessingResult:
        """
        Main processing method that orchestrates the entire process.
        
        🎓 LEARNING: Template Method with Error Handling
        ==============================================
        This method provides a complete processing template:
        1. Validation
        2. Content extraction
        3. Content formatting
        4. Metadata creation
        5. Result packaging
        6. Comprehensive error handling
        
        Args:
            file_upload: FileUpload to process
            include_metadata: Whether to include metadata
            
        Returns:
            ProcessingResult with success/error information
        """
        start_time = datetime.utcnow()
        
        try:
            self.logger.info(f"Processing {file_upload.filename} with {self.__class__.__name__}")
            
            # Step 1: Validate file
            self.validate_file(file_upload)
            
            # Step 2: Extract content
            extracted_content = await self.extract_content(file_upload)
            
            # Step 3: Format content for AI
            formatted_content = self.format_for_ai(
                extracted_content, 
                file_upload.filename,
                file_upload.mime_type,
                include_metadata
            )
            
            # Step 4: Handle size limits
            final_content, is_truncated, truncation_info = self.handle_content_size(
                formatted_content,
                file_upload.filename
            )
            
            # Step 5: Create metadata
            metadata = await self.create_metadata(
                file_upload,
                extracted_content,
                include_metadata
            ) if include_metadata else None
            
            # Step 6: Build result
            processed_content = ProcessedFileContent(
                file_id=file_upload.id,
                filename=file_upload.filename,
                content_type=self.get_content_type(file_upload.mime_type),
                processed_content=final_content,
                content_length=len(final_content),
                is_truncated=is_truncated,
                truncation_info=truncation_info,
                metadata=metadata,
                processed_at=datetime.utcnow()
            )
            
            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            processed_content.processing_time_ms = int(processing_time)
            
            self.logger.info(
                f"Successfully processed {file_upload.filename} - "
                f"{len(final_content)} chars in {processing_time:.1f}ms"
            )
            
            return ProcessingResult.success_result(processed_content, int(processing_time))
            
        except FileProcessingError as e:
            # Re-raise our custom errors with timing info
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self.logger.error(f"Processing failed for {file_upload.filename}: {e.message}")
            return ProcessingResult.error_result(e.message, e.error_type, int(processing_time))
            
        except Exception as e:
            # Handle unexpected errors
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            error_msg = f"Unexpected error processing {file_upload.filename}: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            return ProcessingResult.error_result(error_msg, "unexpected_error", int(processing_time))
    
    def format_for_ai(
        self, 
        content: str, 
        filename: str, 
        mime_type: str, 
        include_metadata: bool
    ) -> str:
        """
        Format content for optimal AI consumption.
        
        🎓 LEARNING: AI Context Formatting
        =================================
        AI works best with clearly formatted context:
        1. Clear file identification
        2. Content type explanation
        3. Structured content with separators
        4. Instructions for AI on how to process
        
        Args:
            content: Extracted content
            filename: Original filename
            mime_type: File MIME type
            include_metadata: Whether to include metadata
            
        Returns:
            AI-formatted content string
        """
        formatted_parts = []
        
        # Header with file information
        formatted_parts.append(f"File: {filename}")
        
        if include_metadata:
            file_type = self.config.get_human_readable_type(mime_type)
            formatted_parts.append(f"Type: {file_type}")
        
        # Content separator
        formatted_parts.append("---")
        
        # The processed content
        formatted_parts.append(content)
        
        # End separator
        formatted_parts.append("---")
        
        return "\n".join(formatted_parts)
    
    def handle_content_size(
        self, 
        content: str, 
        filename: str
    ) -> tuple[str, bool, Optional[str]]:
        """
        Handle content size limits for AI processing.
        
        🎓 LEARNING: Content Truncation Strategy
        =======================================
        AI models have context limits, so we need smart truncation:
        1. Try to keep content under limit
        2. If too large, truncate intelligently
        3. Preserve important parts (beginning + end)
        4. Add clear truncation notice
        5. Provide metadata about what was truncated
        
        Args:
            content: Content to check
            filename: Original filename for logging
            
        Returns:
            Tuple of (final_content, is_truncated, truncation_info)
        """
        max_size = self.config.limits.max_ai_content_size
        
        if len(content) <= max_size:
            return content, False, None
        
        # Content is too large - need to truncate
        self.logger.warning(
            f"Content too large for {filename}: {len(content)} chars (max {max_size})"
        )
        
        # Calculate truncation strategy
        # Keep beginning and end, with clear truncation marker
        keep_start = int(max_size * 0.6)  # 60% for beginning
        keep_end = int(max_size * 0.3)    # 30% for end
        # 10% reserved for truncation message
        
        truncation_message = f"\n\n[... Content truncated - {len(content) - keep_start - keep_end} characters hidden ...]\n\n"
        
        start_content = content[:keep_start]
        end_content = content[-keep_end:] if keep_end > 0 else ""
        
        truncated_content = start_content + truncation_message + end_content
        
        truncation_info = (
            f"Truncated from {len(content)} to {len(truncated_content)} characters "
            f"({len(content) - len(truncated_content)} characters hidden)"
        )
        
        return truncated_content, True, truncation_info
    
    async def create_metadata(
        self, 
        file_upload: FileUpload, 
        extracted_content: str,
        include_detailed: bool
    ) -> Dict[str, Any]:
        """
        Create metadata about the processed content.
        
        Args:
            file_upload: Original file upload
            extracted_content: Extracted content
            include_detailed: Whether to include detailed analysis
            
        Returns:
            Metadata dictionary
        """
        metadata = {
            "processor": self.__class__.__name__,
            "original_size_bytes": file_upload.file_size,
            "content_length": len(extracted_content),
            "line_count": len(extracted_content.split('\n')),
            "word_count": len(extracted_content.split()),
            "file_extension": file_upload.file_extension,
            "mime_type": file_upload.mime_type,
            "processing_timestamp": datetime.utcnow().isoformat()
        }
        
        if include_detailed:
            # Add format-specific metadata (can be overridden)
            format_metadata = await self.create_format_metadata(file_upload, extracted_content)
            metadata.update(format_metadata)
        
        return metadata
    
    async def create_format_metadata(
        self, 
        file_upload: FileUpload, 
        extracted_content: str
    ) -> Dict[str, Any]:
        """
        Create format-specific metadata (can be overridden by subclasses).
        
        Args:
            file_upload: Original file upload
            extracted_content: Extracted content
            
        Returns:
            Format-specific metadata dictionary
        """
        # Default implementation returns empty dict
        # Subclasses can override for specific metadata
        return {}
