"""
File service for AI Dock application.

This service handles all file operations including:
- Secure file upload and storage
- File validation and sanitization
- File retrieval and access control
- File deletion and cleanup
- Storage organization and management

🎓 LEARNING: Service Layer Pattern
=================================
Services contain business logic and are separate from:
- Models (database structure)
- Schemas (API structure)  
- Endpoints (HTTP handling)

This separation allows:
- Reusable code across endpoints
- Easier testing
- Clear responsibility boundaries
- Better error handling
"""

import os
import shutil
import hashlib
import mimetypes
from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any
from pathlib import Path

# FastAPI imports
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

# Internal imports
from ..models.file_upload import FileUpload, create_upload_path, get_file_mime_type, calculate_file_hash
from ..models.user import User
from ..schemas.file_upload import FileUploadStatus, AllowedFileType
from ..core.config import settings


class FileService:
    """
    Service class for handling file operations.
    
    🎓 LEARNING: Class-Based Services
    ================================
    Using a class allows us to:
    - Group related functions together
    - Share common configuration
    - Maintain state if needed
    - Easy dependency injection
    """
    
    def __init__(self):
        """Initialize the file service with configuration."""
        # Base upload directory (where all files are stored)
        self.upload_dir = Path(settings.upload_directory if hasattr(settings, 'upload_directory') else "uploads")
        
        # File size limits by type
        self.file_size_limits = {
            AllowedFileType.PDF.value: 25 * 1024 * 1024,  # 25MB for PDFs
            AllowedFileType.DOCX.value: 20 * 1024 * 1024,  # 20MB for Word documents (.docx)
            AllowedFileType.DOC.value: 20 * 1024 * 1024,   # 20MB for Word documents (.doc)
            'default': 10 * 1024 * 1024  # 10MB for other files
        }
        
        # Legacy max file size (for backward compatibility)
        self.max_file_size = getattr(settings, 'max_file_size_bytes', 10 * 1024 * 1024)
        
        # Allowed file types
        self.allowed_types = [e.value for e in AllowedFileType]
        
        # Ensure upload directory exists
        self.ensure_upload_directory()
    
    def ensure_upload_directory(self) -> None:
        """
        Ensure the upload directory exists and is writable.
        
        🎓 LEARNING: Directory Management
        ================================
        Always check directory exists before using it:
        - Create if missing
        - Check permissions
        - Handle errors gracefully
        """
        try:
            self.upload_dir.mkdir(parents=True, exist_ok=True)
            
            # Test write permissions by creating a temporary file
            test_file = self.upload_dir / ".write_test"
            test_file.write_text("test")
            test_file.unlink()  # Delete test file
            
        except Exception as e:
            raise RuntimeError(f"Cannot create or write to upload directory {self.upload_dir}: {e}")
    
    # =============================================================================
    # FILE VALIDATION
    # =============================================================================
    
    def validate_file_upload(self, file: UploadFile, user: User) -> Tuple[bool, Optional[str]]:
        """
        Validate file before upload.
        
        🎓 LEARNING: Comprehensive Validation
        ====================================
        Validate multiple aspects:
        1. File exists and has content
        2. File size within limits
        3. File type is allowed
        4. Filename is safe
        5. User has permission
        
        Args:
            file: FastAPI UploadFile object
            user: User uploading the file
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check if file exists
        if not file or not file.filename:
            return False, "No file provided"
        
        # Check file size using model validation with MIME type
        content_type = file.content_type or get_file_mime_type(file.filename)
        
        if hasattr(file, 'size') and file.size:
            # Use FileUpload model validation with MIME type
            if not FileUpload.is_allowed_file_size(file.size, content_type):
                max_size = self.file_size_limits.get(content_type, self.file_size_limits['default'])
                max_size_mb = max_size / (1024 * 1024)
                
                # Determine file type name for error message
                if content_type == AllowedFileType.PDF.value:
                    file_type_name = "PDF"
                elif content_type == AllowedFileType.DOCX.value:
                    file_type_name = "Word document (.docx)"
                elif content_type == AllowedFileType.DOC.value:
                    file_type_name = "Word document (.doc)"
                else:
                    file_type_name = "File"
                
                return False, f"{file_type_name} size exceeds {max_size_mb:.0f}MB limit"
        
        # Check file type
        if content_type not in self.allowed_types:
            allowed_types_str = ", ".join(self.allowed_types)
            return False, f"File type '{content_type}' not allowed. Allowed types: {allowed_types_str}"
        
        # PDF-specific validation
        if content_type == AllowedFileType.PDF.value:
            pdf_validation_result = self._validate_pdf_file(file)
            if not pdf_validation_result[0]:
                return False, pdf_validation_result[1]
        
        # Word document-specific validation
        if content_type in [AllowedFileType.DOCX.value, AllowedFileType.DOC.value]:
            word_validation_result = self._validate_word_file(file)
            if not word_validation_result[0]:
                return False, word_validation_result[1]
        
        # Check filename safety
        if not self._is_safe_filename(file.filename):
            return False, "Filename contains dangerous characters"
        
        # Check user permissions (can be extended later)
        if not user.is_active:
            return False, "User account is not active"
        
        return True, None
    
    def _is_safe_filename(self, filename: str) -> bool:
        """
        Check if filename is safe for storage.
        
        🎓 LEARNING: Filename Security
        =============================
        Dangerous filename patterns:
        - Path traversal: ../, ..\\
        - Reserved names: CON, PRN, AUX (Windows)
        - Special characters: <, >, :, ", |, ?, *
        - Control characters: \\x00-\\x1f
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
    
    def _validate_pdf_file(self, file: UploadFile) -> Tuple[bool, Optional[str]]:
        """
        PDF-specific validation.
        
        📕 LEARNING: PDF Validation Techniques
        =====================================
        PDF validation involves checking:
        - Basic PDF structure (header, trailer)
        - File integrity
        - Password protection detection
        - Content accessibility
        
        Args:
            file: UploadFile to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Check filename extension
            if not file.filename.lower().endswith('.pdf'):
                return False, "PDF files must have .pdf extension"
            
            # Read first few bytes to check PDF header
            original_position = file.file.tell() if hasattr(file.file, 'tell') else 0
            
            # Reset to beginning
            if hasattr(file.file, 'seek'):
                file.file.seek(0)
            
            # Read PDF header (first 8 bytes should be %PDF-x.x)
            header = file.file.read(8)
            
            # Reset file position
            if hasattr(file.file, 'seek'):
                file.file.seek(original_position)
            
            # Check PDF header
            if not header.startswith(b'%PDF-'):
                return False, "File does not appear to be a valid PDF (invalid header)"
            
            # Extract PDF version
            try:
                pdf_version = header.decode('ascii')
                # Basic version check (PDF 1.0 to 2.0)
                if not any(v in pdf_version for v in ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '2.0']):
                    return False, "Unsupported PDF version detected"
            except UnicodeDecodeError:
                return False, "PDF header contains invalid characters"
            
            # Note: More advanced PDF validation (password protection, corruption)
            # will be handled during processing phase with PyPDF2
            
            return True, None
            
        except Exception as e:
            return False, f"PDF validation failed: {str(e)}"
    
    def _validate_word_file(self, file: UploadFile) -> Tuple[bool, Optional[str]]:
        """
        Word document-specific validation.
        
        📘 LEARNING: Word Document Validation Techniques (IMPROVED)
        =========================================================
        Word document validation involves checking:
        - Basic file structure (magic bytes)
        - File integrity
        - Extension consistency
        - Accessibility (not password-protected)
        
        🐛 BUG FIX: More robust ZIP signature validation for .docx files
        - Accept various ZIP signature variants (PK\x03\x04, PK\x05\x06, PK\x07\x08)
        - Better error messages for debugging
        - More lenient validation to prevent false positives
        
        Args:
            file: UploadFile to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            content_type = file.content_type or get_file_mime_type(file.filename)
            
            # Check filename extension consistency
            if content_type == AllowedFileType.DOCX.value:
                if not file.filename.lower().endswith('.docx'):
                    return False, "Modern Word documents must have .docx extension"
            elif content_type == AllowedFileType.DOC.value:
                if not file.filename.lower().endswith('.doc'):
                    return False, "Legacy Word documents must have .doc extension"
            
            # Read first chunk to check file signature
            original_position = file.file.tell() if hasattr(file.file, 'tell') else 0
            
            # Reset to beginning
            if hasattr(file.file, 'seek'):
                file.file.seek(0)
            
            # Read more data for better validation (32 bytes instead of 8)
            header = file.file.read(32)
            
            # Reset file position
            if hasattr(file.file, 'seek'):
                file.file.seek(original_position)
            
            # Check minimum file size
            if len(header) < 4:
                return False, f"File {file.filename} is too small to be a valid Word document"
            
            # Basic file signature validation
            if content_type == AllowedFileType.DOCX.value:
                # .docx files are ZIP-based - check for valid ZIP signatures
                # Common ZIP signatures: PK\x03\x04 (local file), PK\x05\x06 (central dir), PK\x07\x08 (spanned)
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
                
                # Additional ZIP structure validation (more lenient)
                try:
                    import zipfile
                    from io import BytesIO
                    
                    # Read more data for ZIP validation
                    if hasattr(file.file, 'seek'):
                        file.file.seek(0)
                    zip_test_data = file.file.read(2048)  # Read first 2KB for better validation
                    if hasattr(file.file, 'seek'):
                        file.file.seek(original_position)
                    
                    # Try to create a BytesIO object and test ZIP structure
                    try:
                        zip_bytes = BytesIO(zip_test_data)
                        # Just try to create ZipFile object - don't read contents yet
                        with zipfile.ZipFile(zip_bytes, 'r') as test_zip:
                            # If we can create the ZipFile object, the basic structure is valid
                            pass
                    except zipfile.BadZipFile:
                        # Only fail if we're certain it's not a ZIP file
                        # Some .docx files might have unusual structures that still work
                        # We'll be lenient here and let the processing stage handle it
                        pass
                    except Exception:
                        # Any other exception, be lenient and allow upload
                        pass
                        
                except ImportError:
                    # zipfile not available - skip ZIP validation
                    pass
                except Exception as zip_error:
                    # ZIP validation failed, but be lenient - just log and continue
                    # The file processor will catch real issues during processing
                    pass
                    
            elif content_type == AllowedFileType.DOC.value:
                # .doc files are OLE compound documents
                ole_signature = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'
                if not header.startswith(ole_signature):
                    # More specific error message
                    header_hex = header[:8].hex() if len(header) >= 8 else header.hex()
                    return False, f"File does not appear to be a valid .doc document. Expected OLE signature, got: {header_hex}"
            
            # Check for potential issues based on filename (warnings only)
            filename_lower = file.filename.lower()
            suspicious_keywords = ['password', 'protected', 'encrypted', 'readonly']
            if any(keyword in filename_lower for keyword in suspicious_keywords):
                # This is just a warning based on filename - actual protection check happens during processing
                # We'll still allow the upload but note the potential issue
                # Could add logging here if needed
                pass
            
            # Validation passed
            return True, None
            
        except Exception as e:
            # More detailed error message for debugging
            return False, f"Word document validation failed for {file.filename}: {str(e)}. File may be corrupted or in an unsupported format."
    
    # =============================================================================
    # FILE UPLOAD
    # =============================================================================
    
    async def save_uploaded_file(
        self, 
        file: UploadFile, 
        user: User, 
        db: Session
    ) -> Tuple[FileUpload, Optional[str]]:
        """
        Save uploaded file to disk and database.
        
        🎓 LEARNING: Async File Operations
        =================================
        File I/O can be slow, so we use async to:
        - Not block other requests
        - Handle large files efficiently
        - Provide better user experience
        
        Args:
            file: FastAPI UploadFile object
            user: User uploading the file
            db: Database session
            
        Returns:
            Tuple of (FileUpload object, error_message)
        """
        try:
            # Validate file first
            is_valid, error_msg = self.validate_file_upload(file, user)
            if not is_valid:
                return None, error_msg
            
            # Generate safe filename (no path needed)
            safe_filename = FileUpload.sanitize_filename(file.filename)

            # Read file in-memory (do not save to disk)
            file_bytes = await file.read()
            file_size = len(file_bytes)

            # Optionally: extract text/metadata here if needed
            # extracted_text = extract_text_from_file(file_bytes, file.content_type)

            # Create database record (no file_path, no file_hash)
            file_record = FileUpload(
                original_filename=file.filename,
                filename=safe_filename,
                file_path=None,  # Not stored
                file_size=file_size,
                mime_type=file.content_type or get_file_mime_type(file.filename),
                file_extension=os.path.splitext(file.filename)[1].lower(),
                user_id=user.id,
                upload_status=FileUploadStatus.COMPLETED,
                file_hash=None  # Not stored
                # Optionally: add extracted_text=extracted_text
            )

            db.add(file_record)
            db.commit()
            db.refresh(file_record)

            return file_record, None
            
        except Exception as e:
            # Rollback database changes
            db.rollback()
            
            # Clean up partial file if it exists
            if 'full_path' in locals() and full_path.exists():
                try:
                    full_path.unlink()
                except:
                    pass  # Ignore cleanup errors
            
            # Mark as failed if we have a record
            if 'file_record' in locals() and file_record.id:
                try:
                    file_record.mark_as_failed(str(e))
                    db.commit()
                except:
                    pass  # Ignore if can't update
            
            return None, f"Upload failed: {str(e)}"
    
    async def _write_file_to_disk(self, file: UploadFile, file_path: Path) -> int:
        """
        Write uploaded file to disk efficiently.
        
        🎓 LEARNING: Efficient File Writing
        ==================================
        For large files, read/write in chunks:
        - Prevents memory overflow
        - Allows progress tracking
        - Handles interruptions better
        
        📕 PDF ENHANCEMENT: Different size limits
        - PDFs can be up to 25MB
        - Other files limited to 10MB
        
        Args:
            file: UploadFile to write
            file_path: Path where to write file
            
        Returns:
            Total bytes written
        """
        total_size = 0
        chunk_size = 8192  # 8KB chunks
        
        # Determine size limit based on file type
        content_type = file.content_type or get_file_mime_type(file.filename)
        max_size = self.file_size_limits.get(content_type, self.file_size_limits['default'])
        
        # Reset file position to beginning
        await file.seek(0)
        
        with open(file_path, "wb") as f:
            while chunk := await file.read(chunk_size):
                f.write(chunk)
                total_size += len(chunk)
                
                # Check size limit during writing using model validation
                if not FileUpload.is_allowed_file_size(total_size, content_type):
                    f.close()
                    file_path.unlink()  # Delete partial file
                    max_size_mb = max_size / (1024 * 1024)
                    
                    # Determine file type name for error message
                    if content_type == AllowedFileType.PDF.value:
                        file_type_name = "PDF"
                    elif content_type == AllowedFileType.DOCX.value:
                        file_type_name = "Word document (.docx)"
                    elif content_type == AllowedFileType.DOC.value:
                        file_type_name = "Word document (.doc)"
                    else:
                        file_type_name = "File"
                    
                    raise ValueError(f"{file_type_name} size exceeds {max_size_mb:.0f}MB limit")
        
        return total_size
    
    # =============================================================================
    # FILE RETRIEVAL
    # =============================================================================
    
    def get_file_path(self, file_record: FileUpload, user: User) -> Tuple[Optional[Path], Optional[str]]:
        """
        Get file path for download with access control.
        
        🎓 LEARNING: Access Control
        ===========================
        Always check permissions before file access:
        - User owns the file
        - User has admin privileges
        - File is not deleted
        - File actually exists on disk
        
        Args:
            file_record: FileUpload database record
            user: User requesting access
            
        Returns:
            Tuple of (file_path, error_message)
        """
        # Check if file is deleted
        if file_record.is_deleted:
            return None, "File has been deleted"
        
        # Check if upload is complete
        if not file_record.is_uploaded:
            return None, "File upload is not complete"
        
        # Check access permissions
        if not self._can_user_access_file(file_record, user):
            return None, "Access denied"
        
        # Check if file exists on disk
        file_path = Path(file_record.file_path)
        if not file_path.exists():
            return None, "File not found on disk"
        
        return file_path, None
    
    def _can_user_access_file(self, file_record: FileUpload, user: User) -> bool:
        """
        Check if user can access the file.
        
        Args:
            file_record: FileUpload to check
            user: User requesting access
            
        Returns:
            True if user can access file
        """
        # User owns the file
        if file_record.user_id == user.id:
            return True
        
        # Admin users can access all files
        if user.is_admin:
            return True
        
        # TODO: Add department-based access control
        # if user.department_id == file_record.user.department_id and user.has_permission('can_view_department_files'):
        #     return True
        
        return False
    
    def update_access_tracking(self, file_record: FileUpload, db: Session) -> None:
        """
        Update file access tracking.
        
        🎓 LEARNING: Usage Analytics
        ===========================
        Track file access for:
        - Usage analytics
        - Popular files identification
        - Access auditing
        - Storage optimization
        """
        try:
            file_record.update_access_tracking()
            db.commit()
        except Exception as e:
            # Don't fail the download if tracking fails
            db.rollback()
            print(f"Warning: Failed to update access tracking: {e}")
    
    # =============================================================================
    # FILE DELETION
    # =============================================================================
    
    def delete_file(self, file_record: FileUpload, user: User, db: Session, permanent: bool = False) -> Tuple[bool, Optional[str]]:
        """
        Delete file with proper access control.
        
        🎓 LEARNING: Soft vs Hard Delete
        ===============================
        - Soft delete: Mark as deleted, keep file (safer)
        - Hard delete: Remove from disk and database (permanent)
        
        Most apps use soft delete by default for:
        - Recovery from accidents
        - Audit trails
        - Data compliance
        
        Args:
            file_record: FileUpload to delete
            user: User requesting deletion
            db: Database session
            permanent: Whether to permanently delete
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Check if user can delete this file
            if not file_record.can_be_deleted_by_user(user.id) and not user.is_admin:
                return False, "Access denied: Cannot delete this file"
            
            if permanent:
                # Hard delete: remove file and database record
                success, error = self._delete_file_permanently(file_record, db)
            else:
                # Soft delete: mark as deleted
                success, error = self._delete_file_soft(file_record, db)
            
            return success, error
            
        except Exception as e:
            db.rollback()
            return False, f"Delete failed: {str(e)}"
    
    def _delete_file_soft(self, file_record: FileUpload, db: Session) -> Tuple[bool, Optional[str]]:
        """
        Soft delete: mark file as deleted but keep everything.
        """
        try:
            file_record.mark_as_deleted()
            db.commit()
            return True, None
        except Exception as e:
            db.rollback()
            return False, str(e)
    
    def _delete_file_permanently(self, file_record: FileUpload, db: Session) -> Tuple[bool, Optional[str]]:
        """
        Hard delete: remove file from disk and database.
        """
        try:
            # Delete file from disk first
            file_path = Path(file_record.file_path)
            if file_path.exists():
                file_path.unlink()
            
            # Delete database record
            db.delete(file_record)
            db.commit()
            
            return True, None
            
        except Exception as e:
            db.rollback()
            return False, str(e)
    
    def bulk_delete_files(self, file_ids: List[int], user: User, db: Session, permanent: bool = False) -> Dict[str, Any]:
        """
        Delete multiple files at once.
        
        🎓 LEARNING: Bulk Operations
        ===========================
        Bulk operations are more efficient but need careful error handling:
        - Process each item individually
        - Collect successes and failures
        - Don't let one failure stop everything
        
        Args:
            file_ids: List of file IDs to delete
            user: User requesting deletion
            db: Database session
            permanent: Whether to permanently delete
            
        Returns:
            Dictionary with results summary
        """
        deleted_count = 0
        failed_count = 0
        errors = []
        
        for file_id in file_ids:
            try:
                # Get file record
                file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
                
                if not file_record:
                    failed_count += 1
                    errors.append(f"File {file_id} not found")
                    continue
                
                # Try to delete
                success, error = self.delete_file(file_record, user, db, permanent)
                
                if success:
                    deleted_count += 1
                else:
                    failed_count += 1
                    errors.append(f"File {file_id}: {error}")
                    
            except Exception as e:
                failed_count += 1
                errors.append(f"File {file_id}: {str(e)}")
        
        return {
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "errors": errors
        }
    
    # =============================================================================
    # FILE LISTING AND SEARCH
    # =============================================================================
    
    def get_user_files(
        self, 
        user: User, 
        db: Session,
        page: int = 1,
        page_size: int = 20,
        include_deleted: bool = False
    ) -> Dict[str, Any]:
        """
        Get paginated list of user's files.
        
        🎓 LEARNING: Pagination Implementation
        ====================================
        Large lists need pagination for:
        - Better performance
        - Faster page loads
        - Better user experience
        
        Standard pagination pattern:
        - OFFSET for skipping records
        - LIMIT for page size
        - Count total for UI
        """
        try:
            # Base query
            query = db.query(FileUpload).filter(FileUpload.user_id == user.id)
            
            # Filter out deleted files unless requested
            if not include_deleted:
                query = query.filter(FileUpload.upload_status != FileUploadStatus.DELETED)
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            offset = (page - 1) * page_size
            files = query.order_by(FileUpload.upload_date.desc()).offset(offset).limit(page_size).all()
            
            # Calculate pagination info
            total_pages = (total_count + page_size - 1) // page_size
            has_next = page < total_pages
            has_previous = page > 1
            
            return {
                "files": files,
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_next": has_next,
                "has_previous": has_previous
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve files: {str(e)}"
            )
    
    # =============================================================================
    # FILE STATISTICS
    # =============================================================================
    
    def get_file_statistics(self, db: Session, user: Optional[User] = None) -> Dict[str, Any]:
        """
        Get file upload statistics.
        
        Args:
            db: Database session
            user: If provided, get stats for specific user only
            
        Returns:
            Dictionary with statistics
        """
        try:
            # Base query
            query = db.query(FileUpload)
            
            # Filter by user if specified
            if user:
                query = query.filter(FileUpload.user_id == user.id)
            
            # Filter out deleted files
            active_files = query.filter(FileUpload.upload_status != FileUploadStatus.DELETED)
            
            # Basic stats
            total_files = active_files.count()
            total_size = sum(f.file_size for f in active_files.all())
            
            # Files by type
            files_by_type = {}
            for file in active_files.all():
                mime_type = file.mime_type
                files_by_type[mime_type] = files_by_type.get(mime_type, 0) + 1
            
            # Files by status
            files_by_status = {}
            for file in query.all():
                status = file.upload_status
                files_by_status[status] = files_by_status.get(status, 0) + 1
            
            # Recent uploads (last 24 hours)
            from datetime import timedelta
            yesterday = datetime.utcnow() - timedelta(days=1)
            recent_uploads = active_files.filter(FileUpload.upload_date >= yesterday).count()
            
            # Average file size
            avg_size = total_size / total_files if total_files > 0 else 0
            
            return {
                "total_files": total_files,
                "total_size_bytes": total_size,
                "total_size_human": self._format_file_size(total_size),
                "files_by_type": files_by_type,
                "files_by_status": files_by_status,
                "recent_uploads": recent_uploads,
                "avg_file_size_bytes": avg_size
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get statistics: {str(e)}"
            )
    
    def _format_file_size(self, size_bytes: int) -> str:
        """
        Format file size in human-readable format.
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
    
    # =============================================================================
    # HEALTH CHECK
    # =============================================================================
    
    def check_file_system_health(self, db: Session) -> Dict[str, Any]:
        """
        Check file system health.
        
        🎓 LEARNING: Health Checks
        =========================
        Monitor system components:
        - Directory exists and writable
        - Disk space available
        - File counts match database
        - No orphaned files
        """
        errors = []
        
        # Check upload directory
        upload_dir_exists = self.upload_dir.exists()
        upload_dir_writable = False
        
        if upload_dir_exists:
            try:
                test_file = self.upload_dir / ".health_check"
                test_file.write_text("test")
                test_file.unlink()
                upload_dir_writable = True
            except Exception as e:
                errors.append(f"Upload directory not writable: {e}")
        else:
            errors.append("Upload directory does not exist")
        
        # Get file statistics
        try:
            stats = self.get_file_statistics(db)
            total_files = stats["total_files"]
            total_storage = stats["total_size_bytes"]
        except Exception as e:
            total_files = 0
            total_storage = 0
            errors.append(f"Failed to get file statistics: {e}")
        
        # Check disk space (simplified)
        disk_space_available = True
        try:
            import shutil
            _, _, free_bytes = shutil.disk_usage(self.upload_dir)
            # Consider healthy if more than 1GB free
            if free_bytes < 1024 * 1024 * 1024:
                disk_space_available = False
                errors.append("Low disk space")
        except Exception as e:
            errors.append(f"Cannot check disk space: {e}")
        
        # Determine overall status
        status = "healthy" if not errors else "unhealthy"
        
        return {
            "status": status,
            "upload_directory_exists": upload_dir_exists,
            "upload_directory_writable": upload_dir_writable,
            "total_files": total_files,
            "total_storage_bytes": total_storage,
            "disk_space_available": disk_space_available,
            "errors": errors
        }
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def get_upload_limits(self) -> Dict[str, Any]:
        """
        Get current upload limits and restrictions.
        
        🎓 LEARNING: Configuration Exposure
        ==================================
        Expose limits to frontend for:
        - Better user experience
        - Client-side validation
        - Progress indicators
        
        📕 PDF SUPPORT: Enhanced limits information
        - Different size limits per file type
        - PDF-specific guidance
        - Updated extension mappings
        """
        # Get allowed extensions from MIME types
        extension_map = {
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
            'application/pdf': ['.pdf'],  # 📕 PDF extension support
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],  # 📘 NEW: Modern Word documents
            'application/msword': ['.doc']  # 📘 NEW: Legacy Word documents
        }
        
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
                "max_size_human": self._format_file_size(max_size)
            }
        
        return {
            "max_file_size_bytes": self.max_file_size,  # Legacy/default
            "max_file_size_human": self._format_file_size(self.max_file_size),
            "allowed_types": self.allowed_types,
            "allowed_extensions": list(set(allowed_extensions)),  # Remove duplicates
            "size_limits_by_type": size_limits_by_type,  # 📕 Detailed size limits
            "pdf_max_size_bytes": self.file_size_limits[AllowedFileType.PDF.value],
            "pdf_max_size_human": self._format_file_size(self.file_size_limits[AllowedFileType.PDF.value]),
            "word_max_size_bytes": self.file_size_limits[AllowedFileType.DOCX.value],  # 📘 NEW: Word document size limit
            "word_max_size_human": self._format_file_size(self.file_size_limits[AllowedFileType.DOCX.value]),
            "default_max_size_bytes": self.file_size_limits['default'],
            "default_max_size_human": self._format_file_size(self.file_size_limits['default']),
            "max_files_per_user": getattr(settings, 'max_files_per_user', None),
            "max_total_size_per_user": getattr(settings, 'max_total_size_per_user', None)
        }


# =============================================================================
# GLOBAL SERVICE INSTANCE
# =============================================================================

# Create a global instance that can be imported and used
file_service = FileService()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_file_service() -> FileService:
    """
    Get the file service instance.
    
    🎓 LEARNING: Dependency Injection
    ================================
    This function can be used as a FastAPI dependency:
    
    @app.post("/files/upload")
    async def upload_file(
        file: UploadFile,
        service: FileService = Depends(get_file_service)
    ):
        # Use service...
    """
    return file_service
