"""
File Utility Service for AI Dock

Atomic service responsible for configuration and utility functions:
- Upload limits and restrictions
- File type configuration
- Format conversion utilities
- Configuration exposure for frontend
- System utility functions

🎓 LEARNING: Utility Service Pattern
===================================
This service provides configuration and utilities without business logic:
- Configuration management
- Format conversion helpers
- System information exposure
- Frontend integration support
- Follows integration guide's utility patterns
"""

import os
from typing import Dict, Any, List, Optional, Tuple

# Internal imports
from ...schemas.file_upload import AllowedFileType
from ...core.config import settings


class FileUtilityService:
    """
    Atomic service for file configuration and utility functions.
    
    Following integration guide patterns:
    - Single responsibility (configuration and utilities)
    - No business logic (pure utility functions)
    - Frontend integration support
    - Clear configuration management
    - Reusable helper functions
    """
    
    def __init__(self):
        """Initialize utility service with configuration."""
        # File size limits by type
        self.file_size_limits = {
            AllowedFileType.PDF.value: 25 * 1024 * 1024,  # 25MB for PDFs
            AllowedFileType.DOCX.value: 20 * 1024 * 1024,  # 20MB for Word documents (.docx)
            AllowedFileType.DOC.value: 20 * 1024 * 1024,   # 20MB for Word documents (.doc)
            'default': 10 * 1024 * 1024  # 10MB for other files
        }
        
        # Legacy max file size for backward compatibility
        self.max_file_size = getattr(settings, 'max_file_size_bytes', 10 * 1024 * 1024)
        
        # Allowed file types
        self.allowed_types = [e.value for e in AllowedFileType]
    
    # =============================================================================
    # UPLOAD LIMITS AND CONFIGURATION
    # =============================================================================
    
    def get_upload_limits(self) -> Dict[str, Any]:
        """
        Get comprehensive upload limits and restrictions for frontend.
        
        🎓 LEARNING: Configuration Exposure
        ==================================
        Expose system limits to frontend so it can:
        - Show helpful UI messages
        - Validate files before upload
        - Display progress bars correctly
        - Provide better user experience
        
        This prevents users from attempting invalid uploads
        and provides clear guidance on what's allowed.
        
        Returns:
            Dictionary with all current upload restrictions
        """
        # Get allowed extensions from MIME types
        extension_map = self._get_extension_mapping()
        
        allowed_extensions = []
        for mime_type in self.allowed_types:
            if mime_type in extension_map:
                allowed_extensions.extend(extension_map[mime_type])
        
        # Create detailed size limits information
        size_limits_by_type = {}
        for mime_type in self.allowed_types:
            max_size = self.file_size_limits.get(mime_type, self.file_size_limits['default'])
            size_limits_by_type[mime_type] = {
                "max_size_bytes": max_size,
                "max_size_human": self.format_file_size(max_size),
                "file_type_name": self._get_file_type_display_name(mime_type)
            }
        
        return {
            # Legacy compatibility
            "max_file_size_bytes": self.max_file_size,
            "max_file_size_human": self.format_file_size(self.max_file_size),
            
            # Type-specific limits
            "size_limits_by_type": size_limits_by_type,
            
            # Allowed types and extensions
            "allowed_types": self.allowed_types,
            "allowed_extensions": list(set(allowed_extensions)),  # Remove duplicates
            
            # Specific type limits for convenience
            "pdf_max_size_bytes": self.file_size_limits[AllowedFileType.PDF.value],
            "pdf_max_size_human": self.format_file_size(self.file_size_limits[AllowedFileType.PDF.value]),
            "word_max_size_bytes": self.file_size_limits[AllowedFileType.DOCX.value],
            "word_max_size_human": self.format_file_size(self.file_size_limits[AllowedFileType.DOCX.value]),
            "default_max_size_bytes": self.file_size_limits['default'],
            "default_max_size_human": self.format_file_size(self.file_size_limits['default']),
            
            # System limits (can be None if not configured)
            "max_files_per_user": getattr(settings, 'max_files_per_user', None),
            "max_total_size_per_user": getattr(settings, 'max_total_size_per_user', None),
            
            # Additional information
            "upload_method": "database_storage",
            "supports_text_extraction": True,
            "supports_file_preview": True
        }
    
    # =============================================================================
    # FILE TYPE CONFIGURATION
    # =============================================================================
    
    def get_file_type_information(self) -> Dict[str, Any]:
        """
        Get comprehensive file type information and capabilities.
        
        Returns:
            Dictionary with file type details and capabilities
        """
        file_types_info = {}
        
        for file_type in self.allowed_types:
            file_types_info[file_type] = {
                "display_name": self._get_file_type_display_name(file_type),
                "extensions": self._get_extensions_for_type(file_type),
                "max_size_bytes": self.file_size_limits.get(file_type, self.file_size_limits['default']),
                "max_size_human": self.format_file_size(self.file_size_limits.get(file_type, self.file_size_limits['default'])),
                "supports_text_extraction": self._supports_text_extraction(file_type),
                "extraction_method": self._get_extraction_method(file_type),
                "description": self._get_file_type_description(file_type)
            }
        
        return {
            "supported_file_types": file_types_info,
            "total_supported_types": len(self.allowed_types),
            "text_extraction_types": [t for t in self.allowed_types if self._supports_text_extraction(t)]
        }
    
    def _get_file_type_display_name(self, mime_type: str) -> str:
        """Get human-readable file type name."""
        display_names = {
            AllowedFileType.PDF.value: "PDF Document",
            AllowedFileType.DOCX.value: "Word Document (.docx)",
            AllowedFileType.DOC.value: "Word Document (.doc)",
            'text/plain': "Plain Text",
            'text/markdown': "Markdown",
            'text/csv': "CSV (Comma-Separated Values)",
            'application/json': "JSON",
            'text/x-python': "Python Script",
            'text/javascript': "JavaScript",
            'text/html': "HTML",
            'text/css': "CSS Stylesheet",
            'application/xml': "XML",
            'text/xml': "XML"
        }
        return display_names.get(mime_type, mime_type)
    
    def _get_extensions_for_type(self, mime_type: str) -> List[str]:
        """Get file extensions for a MIME type."""
        extension_map = self._get_extension_mapping()
        return extension_map.get(mime_type, [])
    
    def _get_extension_mapping(self) -> Dict[str, List[str]]:
        """Get mapping of MIME types to file extensions."""
        return {
            'text/plain': ['.txt'],
            'text/markdown': ['.md'],
            'text/csv': ['.csv'],
            'application/json': ['.json'],
            'text/x-python': ['.py'],
            'text/javascript': ['.js'],
            'text/html': ['.html'],
            'text/css': ['.css'],
            'application/xml': ['.xml'],
            'text/xml': ['.xml'],
            AllowedFileType.PDF.value: ['.pdf'],
            AllowedFileType.DOCX.value: ['.docx'],
            AllowedFileType.DOC.value: ['.doc']
        }
    
    def _supports_text_extraction(self, mime_type: str) -> bool:
        """Check if MIME type supports text extraction."""
        # All supported types should support text extraction
        return mime_type in self.allowed_types
    
    def _get_extraction_method(self, mime_type: str) -> str:
        """Get text extraction method for file type."""
        extraction_methods = {
            AllowedFileType.PDF.value: "PyPDF2 library",
            AllowedFileType.DOCX.value: "python-docx + docx2txt",
            AllowedFileType.DOC.value: "Not implemented (conversion recommended)",
            'text/plain': "Direct UTF-8 decoding",
            'text/markdown': "Direct UTF-8 decoding",
            'text/csv': "Direct UTF-8 decoding",
            'application/json': "Direct UTF-8 decoding",
            'text/x-python': "Direct UTF-8 decoding",
            'text/javascript': "Direct UTF-8 decoding",
            'text/html': "Direct UTF-8 decoding",
            'text/css': "Direct UTF-8 decoding",
            'application/xml': "Direct UTF-8 decoding",
            'text/xml': "Direct UTF-8 decoding"
        }
        return extraction_methods.get(mime_type, "Unknown")
    
    def _get_file_type_description(self, mime_type: str) -> str:
        """Get description for file type."""
        descriptions = {
            AllowedFileType.PDF.value: "Portable Document Format - supports text extraction from documents",
            AllowedFileType.DOCX.value: "Modern Word document format with full text and table extraction",
            AllowedFileType.DOC.value: "Legacy Word format - conversion to .docx recommended",
            'text/plain': "Plain text files with UTF-8 encoding support",
            'text/markdown': "Markdown formatted text documents",
            'text/csv': "Comma-separated values for data tables",
            'application/json': "JSON data format",
            'text/x-python': "Python source code files",
            'text/javascript': "JavaScript source code",
            'text/html': "HTML markup files",
            'text/css': "CSS stylesheet files",
            'application/xml': "XML data format",
            'text/xml': "XML text format"
        }
        return descriptions.get(mime_type, "Supported file format")
    
    # =============================================================================
    # FORMAT CONVERSION UTILITIES
    # =============================================================================
    
    def format_file_size(self, size_bytes: int) -> str:
        """
        Format file size in human-readable format.
        
        🎓 LEARNING: Consistent Formatting
        =================================
        Consistent formatting across the application:
        - Same format in all components
        - Clear, readable units
        - Appropriate precision
        - International standards (1024-based)
        
        Args:
            size_bytes: Size in bytes
            
        Returns:
            Human-readable size string
        """
        if size_bytes == 0:
            return "0 B"
        
        units = ['B', 'KB', 'MB', 'GB', 'TB']
        size = float(size_bytes)
        unit_index = 0
        
        while size >= 1024 and unit_index < len(units) - 1:
            size /= 1024
            unit_index += 1
        
        if size == int(size):
            return f"{int(size)} {units[unit_index]}"
        else:
            return f"{size:.1f} {units[unit_index]}"
    
    def parse_file_size(self, size_str: str) -> Optional[int]:
        """
        Parse human-readable file size string to bytes.
        
        Args:
            size_str: Size string like "10 MB", "1.5GB"
            
        Returns:
            Size in bytes, or None if parsing failed
        """
        try:
            import re
            
            # Remove whitespace and convert to uppercase
            size_str = re.sub(r'\s+', '', size_str.upper())
            
            # Extract number and unit
            match = re.match(r'^(\d+(?:\.\d+)?)(B|KB|MB|GB|TB)?$', size_str)
            if not match:
                return None
            
            number = float(match.group(1))
            unit = match.group(2) or 'B'
            
            # Convert to bytes
            multipliers = {
                'B': 1,
                'KB': 1024,
                'MB': 1024**2,
                'GB': 1024**3,
                'TB': 1024**4
            }
            
            return int(number * multipliers[unit])
            
        except Exception:
            return None
    
    # =============================================================================
    # SYSTEM INFORMATION
    # =============================================================================
    
    def get_system_capabilities(self) -> Dict[str, Any]:
        """
        Get system capabilities and feature availability.
        
        Returns:
            Dictionary with system capabilities
        """
        # Check library availability
        pdf_available = False
        word_available = False
        
        try:
            import PyPDF2
            pdf_available = True
        except ImportError:
            pass
        
        try:
            import docx2txt
            from docx import Document
            word_available = True
        except ImportError:
            pass
        
        return {
            "storage_type": "database",
            "text_extraction_libraries": {
                "pdf_extraction_available": pdf_available,
                "word_extraction_available": word_available,
                "text_encoding_support": True
            },
            "features": {
                "file_deduplication": True,
                "integrity_checking": True,
                "soft_delete": True,
                "access_tracking": True,
                "bulk_operations": True,
                "file_preview": True
            },
            "performance": {
                "chunked_uploads": True,
                "streaming_downloads": True,
                "concurrent_processing": True
            },
            "security": {
                "filename_sanitization": True,
                "type_validation": True,
                "size_limits": True,
                "access_control": True
            }
        }
    
    def get_configuration_summary(self) -> Dict[str, Any]:
        """
        Get summary of current configuration for debugging/admin.
        
        Returns:
            Dictionary with configuration summary
        """
        return {
            "file_limits": {
                "total_allowed_types": len(self.allowed_types),
                "max_pdf_size_mb": self.file_size_limits[AllowedFileType.PDF.value] / (1024**2),
                "max_word_size_mb": self.file_size_limits[AllowedFileType.DOCX.value] / (1024**2),
                "max_default_size_mb": self.file_size_limits['default'] / (1024**2)
            },
            "storage_config": {
                "storage_type": "database",
                "upload_directory": getattr(settings, 'upload_directory', 'uploads'),
                "max_content_size_mb": 50  # Database storage limit
            },
            "feature_flags": {
                "text_extraction_enabled": True,
                "file_preview_enabled": True,
                "bulk_operations_enabled": True,
                "analytics_enabled": True,
                "health_monitoring_enabled": True
            }
        }
    
    # =============================================================================
    # VALIDATION UTILITIES
    # =============================================================================
    
    def is_allowed_file_type(self, mime_type: str) -> bool:
        """Check if MIME type is in allowed list."""
        return mime_type in self.allowed_types
    
    def is_allowed_file_size(self, size_bytes: int, mime_type: str) -> bool:
        """Check if file size is within limits for the type."""
        max_size = self.file_size_limits.get(mime_type, self.file_size_limits['default'])
        return size_bytes <= max_size
    
    def get_max_size_for_type(self, mime_type: str) -> int:
        """Get maximum allowed size for a file type."""
        return self.file_size_limits.get(mime_type, self.file_size_limits['default'])
    
    def validate_filename_characters(self, filename: str) -> Tuple[bool, List[str]]:
        """
        Validate filename characters and return issues.
        
        Args:
            filename: Filename to validate
            
        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []
        
        if not filename or not filename.strip():
            issues.append("Filename is empty")
            return False, issues
        
        # Check for dangerous patterns
        dangerous_patterns = ['../', '..\\', '<', '>', ':', '"', '|', '?', '*']
        for pattern in dangerous_patterns:
            if pattern in filename:
                issues.append(f"Contains dangerous character(s): {pattern}")
        
        # Check for control characters
        if any(ord(c) < 32 for c in filename):
            issues.append("Contains control characters")
        
        # Check for Windows reserved names
        reserved_names = ['CON', 'PRN', 'AUX', 'NUL'] + [f'COM{i}' for i in range(1, 10)] + [f'LPT{i}' for i in range(1, 10)]
        name_without_ext = os.path.splitext(filename)[0].upper()
        if name_without_ext in reserved_names:
            issues.append(f"Uses reserved name: {name_without_ext}")
        
        return len(issues) == 0, issues
