"""
File Validation Service for AI Dock

Atomic service responsible for all file validation logic including:
- File type validation (PDF, DOCX, DOC, text files)
- File size limits per type
- Filename safety checks
- Content structure validation
- User permission validation

🎓 LEARNING: Single Responsibility Principle
==========================================
This service only handles validation - no storage, no processing.
This makes it:
- Easy to test independently
- Reusable across different contexts
- Maintainable and focused
- Follows validation patterns from integration guide
"""

import os
import zipfile
from io import BytesIO
from typing import Tuple, Optional, List
from pathlib import Path

# FastAPI imports
from fastapi import UploadFile

# Internal imports
from ...models.file_upload import FileUpload, get_file_mime_type
from ...models.user import User
from ...schemas.file_upload import AllowedFileType


class FileValidationService:
    """
    Atomic service for file validation operations.
    
    Following integration guide patterns:
    - Single responsibility (validation only)
    - Comprehensive error handling
    - Clear return types (success, error_message)
    - No side effects (pure validation)
    """
    
    def __init__(self):
        """Initialize validation service with type-specific size limits."""
        # File size limits by type (following integration guide patterns)
        self.file_size_limits = {
            AllowedFileType.PDF.value: 25 * 1024 * 1024,  # 25MB for PDFs
            AllowedFileType.DOCX.value: 20 * 1024 * 1024,  # 20MB for Word documents (.docx)
            AllowedFileType.DOC.value: 20 * 1024 * 1024,   # 20MB for Word documents (.doc)
            'default': 10 * 1024 * 1024  # 10MB for other files
        }
        
        # Allowed file types
        self.allowed_types = [e.value for e in AllowedFileType]
    
    # =============================================================================
    # MAIN VALIDATION ENTRY POINT
    # =============================================================================
    
    def validate_file_upload(self, file: UploadFile, user: User) -> Tuple[bool, Optional[str]]:
        """
        Comprehensive file validation before upload.
        
        🎓 LEARNING: Validation Chain Pattern
        ====================================
        Run multiple validation checks in sequence:
        1. Basic file existence
        2. File size validation
        3. File type validation
        4. Type-specific validation (PDF, Word, etc.)
        5. Filename safety
        6. User permissions
        
        Stop at first failure for performance.
        
        Args:
            file: FastAPI UploadFile object
            user: User uploading the file
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # 1. Check basic file existence
        if not file or not file.filename:
            return False, "No file provided"
        
        # 2. Get content type for validation
        content_type = file.content_type or get_file_mime_type(file.filename)
        
        # 3. Validate file size
        if hasattr(file, 'size') and file.size:
            is_size_valid, size_error = self._validate_file_size(file.size, content_type)
            if not is_size_valid:
                return False, size_error
        
        # 4. Validate file type
        is_type_valid, type_error = self._validate_file_type(content_type)
        if not is_type_valid:
            return False, type_error
        
        # 5. Type-specific validation
        if content_type == AllowedFileType.PDF.value:
            is_pdf_valid, pdf_error = self._validate_pdf_file(file)
            if not is_pdf_valid:
                return False, pdf_error
        
        elif content_type in [AllowedFileType.DOCX.value, AllowedFileType.DOC.value]:
            is_word_valid, word_error = self._validate_word_file(file)
            if not is_word_valid:
                return False, word_error
        
        # 6. Validate filename safety
        is_filename_safe, filename_error = self._validate_filename_safety(file.filename)
        if not is_filename_safe:
            return False, filename_error
        
        # 7. Validate user permissions
        is_user_valid, user_error = self._validate_user_permissions(user)
        if not is_user_valid:
            return False, user_error
        
        # All validations passed
        return True, None
    
    # =============================================================================
    # SIZE VALIDATION
    # =============================================================================
    
    def _validate_file_size(self, file_size: int, content_type: str) -> Tuple[bool, Optional[str]]:
        """
        Validate file size based on type-specific limits.
        
        🎓 LEARNING: Type-Specific Validation
        ====================================
        Different file types have different size limits:
        - PDFs can be larger (25MB) - often contain images
        - Word docs get 20MB - can have embedded media
        - Text files get 10MB - should be sufficient
        """
        # Use FileUpload model validation with MIME type
        if not FileUpload.is_allowed_file_size(file_size, content_type):
            max_size = self.file_size_limits.get(content_type, self.file_size_limits['default'])
            max_size_mb = max_size / (1024 * 1024)
            
            # Get human-readable file type name
            file_type_name = self._get_file_type_display_name(content_type)
            
            return False, f"{file_type_name} size exceeds {max_size_mb:.0f}MB limit"
        
        return True, None
    
    def _get_file_type_display_name(self, content_type: str) -> str:
        """Get human-readable file type name for error messages."""
        type_names = {
            AllowedFileType.PDF.value: "PDF",
            AllowedFileType.DOCX.value: "Word document (.docx)",
            AllowedFileType.DOC.value: "Word document (.doc)",
        }
        return type_names.get(content_type, "File")
    
    # =============================================================================
    # TYPE VALIDATION
    # =============================================================================
    
    def _validate_file_type(self, content_type: str) -> Tuple[bool, Optional[str]]:
        """
        Validate that file type is in allowed list.
        
        Args:
            content_type: MIME type of the file
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if content_type not in self.allowed_types:
            allowed_types_str = ", ".join(self.allowed_types)
            return False, f"File type '{content_type}' not allowed. Allowed types: {allowed_types_str}"
        
        return True, None
    
    # =============================================================================
    # FILENAME VALIDATION
    # =============================================================================
    
    def _validate_filename_safety(self, filename: str) -> Tuple[bool, Optional[str]]:
        """
        Validate filename safety to prevent security issues.
        
        🎓 LEARNING: Filename Security
        =============================
        Dangerous filename patterns:
        - Path traversal: ../, ..\\
        - Reserved names: CON, PRN, AUX (Windows)
        - Special characters: <, >, :, ", |, ?, *
        - Control characters: \\x00-\\x1f
        """
        if not self._is_safe_filename(filename):
            return False, "Filename contains dangerous characters"
        
        return True, None
    
    def _is_safe_filename(self, filename: str) -> bool:
        """
        Check if filename is safe for storage.
        
        Args:
            filename: Filename to check
            
        Returns:
            True if filename is safe
        """
        if not filename or not filename.strip():
            return False
        
        # Check for dangerous patterns
        dangerous_patterns = ['../', '..\\', '<', '>', ':', '"', '|', '?', '*']
        for pattern in dangerous_patterns:
            if pattern in filename:
                return False
        
        # Check for control characters
        if any(ord(c) < 32 for c in filename):
            return False
        
        # Check for Windows reserved names
        reserved_names = ['CON', 'PRN', 'AUX', 'NUL'] + [f'COM{i}' for i in range(1, 10)] + [f'LPT{i}' for i in range(1, 10)]
        name_without_ext = os.path.splitext(filename)[0].upper()
        if name_without_ext in reserved_names:
            return False
        
        return True
    
    # =============================================================================
    # USER VALIDATION
    # =============================================================================
    
    def _validate_user_permissions(self, user: User) -> Tuple[bool, Optional[str]]:
        """
        Validate user permissions for file upload.
        
        Args:
            user: User requesting upload
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check if user account is active
        if not user.is_active:
            return False, "User account is not active"
        
        # Future: Add additional permission checks
        # - Department quotas
        # - Role-based restrictions
        # - Upload limits per user
        
        return True, None
    
    # =============================================================================
    # PDF-SPECIFIC VALIDATION
    # =============================================================================
    
    def _validate_pdf_file(self, file: UploadFile) -> Tuple[bool, Optional[str]]:
        """
        PDF-specific validation including header and structure checks.
        
        🎓 LEARNING: PDF Validation Techniques
        =====================================
        PDF validation involves checking:
        - Basic PDF structure (header, trailer)
        - File integrity
        - Version compatibility
        - No password protection (for text extraction)
        
        Args:
            file: UploadFile to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Check filename extension
            if not file.filename.lower().endswith('.pdf'):
                return False, "PDF files must have .pdf extension"
            
            # Preserve file position
            original_position = file.file.tell() if hasattr(file.file, 'tell') else 0
            
            # Reset to beginning
            if hasattr(file.file, 'seek'):
                file.file.seek(0)
            
            # Read PDF header (first 8 bytes should be %PDF-x.x)
            header = file.file.read(8)
            
            # Reset file position
            if hasattr(file.file, 'seek'):
                file.file.seek(original_position)
            
            # Validate PDF header
            if not header.startswith(b'%PDF-'):
                return False, "File does not appear to be a valid PDF (invalid header)"
            
            # Extract and validate PDF version
            try:
                pdf_version = header.decode('ascii')
                # Basic version check (PDF 1.0 to 2.0)
                valid_versions = ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '2.0']
                if not any(v in pdf_version for v in valid_versions):
                    return False, "Unsupported PDF version detected"
            except UnicodeDecodeError:
                return False, "PDF header contains invalid characters"
            
            return True, None
            
        except Exception as e:
            return False, f"PDF validation failed: {str(e)}"
    
    # =============================================================================
    # WORD DOCUMENT VALIDATION
    # =============================================================================
    
    def _validate_word_file(self, file: UploadFile) -> Tuple[bool, Optional[str]]:
        """
        Word document validation for both .docx and .doc files.
        
        🎓 LEARNING: Word Document Validation (IMPROVED)
        ===============================================
        Word document validation involves checking:
        - Extension consistency with content type
        - Basic file structure (ZIP for .docx, OLE for .doc)
        - File integrity
        - Accessibility (not password-protected)
        
        🐛 BUG FIX: More robust validation with better error handling
        
        Args:
            file: UploadFile to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            content_type = file.content_type or get_file_mime_type(file.filename)
            
            # Validate extension consistency
            extension_valid, extension_error = self._validate_word_extension(file.filename, content_type)
            if not extension_valid:
                return False, extension_error
            
            # Validate file structure
            structure_valid, structure_error = self._validate_word_structure(file, content_type)
            if not structure_valid:
                return False, structure_error
            
            return True, None
            
        except Exception as e:
            return False, f"Word document validation failed for {file.filename}: {str(e)}. File may be corrupted or in an unsupported format."
    
    def _validate_word_extension(self, filename: str, content_type: str) -> Tuple[bool, Optional[str]]:
        """Validate filename extension matches content type."""
        if content_type == AllowedFileType.DOCX.value:
            if not filename.lower().endswith('.docx'):
                return False, "Modern Word documents must have .docx extension"
        elif content_type == AllowedFileType.DOC.value:
            if not filename.lower().endswith('.doc'):
                return False, "Legacy Word documents must have .doc extension"
        
        return True, None
    
    def _validate_word_structure(self, file: UploadFile, content_type: str) -> Tuple[bool, Optional[str]]:
        """Validate basic file structure for Word documents."""
        try:
            # Preserve file position
            original_position = file.file.tell() if hasattr(file.file, 'tell') else 0
            
            # Reset to beginning
            if hasattr(file.file, 'seek'):
                file.file.seek(0)
            
            # Read header for validation (32 bytes for better detection)
            header = file.file.read(32)
            
            # Reset file position
            if hasattr(file.file, 'seek'):
                file.file.seek(original_position)
            
            # Check minimum file size
            if len(header) < 4:
                return False, f"File {file.filename} is too small to be a valid Word document"
            
            if content_type == AllowedFileType.DOCX.value:
                return self._validate_docx_structure(file, header)
            elif content_type == AllowedFileType.DOC.value:
                return self._validate_doc_structure(header)
            
            return True, None
            
        except Exception as e:
            return False, f"Structure validation failed: {str(e)}"
    
    def _validate_docx_structure(self, file: UploadFile, header: bytes) -> Tuple[bool, Optional[str]]:
        """Validate .docx file structure (ZIP-based)."""
        # .docx files are ZIP-based - check for valid ZIP signatures
        valid_zip_signatures = [
            b'PK\x03\x04',  # Most common - local file header
            b'PK\x05\x06',  # Central directory end
            b'PK\x07\x08',  # Spanned archive
            b'PK\x01\x02',  # Central directory file header
        ]
        
        # Check if header starts with any valid ZIP signature
        is_valid_zip = any(header.startswith(sig) for sig in valid_zip_signatures)
        
        if not is_valid_zip:
            # More specific error message for debugging
            header_hex = header[:8].hex() if len(header) >= 8 else header.hex()
            return False, f"File does not appear to be a valid .docx document. Expected ZIP signature (PK...), got: {header_hex}"
        
        # Additional ZIP structure validation (optional, more lenient)
        try:
            # Read more data for ZIP validation
            if hasattr(file.file, 'seek'):
                file.file.seek(0)
            zip_test_data = file.file.read(2048)  # Read first 2KB for validation
            if hasattr(file.file, 'seek'):
                file.file.seek(0)  # Reset for future use
            
            # Test ZIP structure
            zip_bytes = BytesIO(zip_test_data)
            with zipfile.ZipFile(zip_bytes, 'r') as test_zip:
                # If we can create the ZipFile object, basic structure is valid
                pass
        except zipfile.BadZipFile:
            # Be lenient - some .docx files have unusual structures that still work
            # The file processor will catch real issues during processing
            pass
        except ImportError:
            # zipfile not available - skip ZIP validation
            pass
        except Exception:
            # Any other exception, be lenient and allow upload
            pass
        
        return True, None
    
    def _validate_doc_structure(self, header: bytes) -> Tuple[bool, Optional[str]]:
        """Validate .doc file structure (OLE compound document)."""
        # .doc files are OLE compound documents
        ole_signature = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'
        
        if not header.startswith(ole_signature):
            # More specific error message
            header_hex = header[:8].hex() if len(header) >= 8 else header.hex()
            return False, f"File does not appear to be a valid .doc document. Expected OLE signature, got: {header_hex}"
        
        return True, None
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def get_allowed_types(self) -> List[str]:
        """Get list of allowed file types."""
        return self.allowed_types.copy()
    
    def get_size_limits(self) -> dict:
        """Get file size limits by type."""
        return self.file_size_limits.copy()
    
    def is_text_file_type(self, content_type: str) -> bool:
        """Check if content type represents a text file."""
        text_types = [
            'text/plain',
            'text/markdown', 
            'text/csv',
            'application/json',
            'text/x-python',
            'text/javascript',
            'text/html',
            'text/css',
            'application/xml',
            'text/xml'
        ]
        return content_type in text_types
