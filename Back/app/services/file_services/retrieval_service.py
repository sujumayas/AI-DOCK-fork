"""
File Retrieval Service for AI Dock

Atomic service responsible for file retrieval and access control:
- User permission validation
- File access tracking
- Content retrieval from database
- Access control enforcement
- Download authorization

🎓 LEARNING: Access Control Patterns
===================================
This service implements comprehensive access control:
- Owner-based access (users can access their files)
- Admin override (admins can access all files)
- Status-based restrictions (no access to deleted files)
- Future: Department-based access, role-based permissions
- Follows integration guide's security patterns
"""

from typing import Tuple, Optional
from pathlib import Path
from datetime import datetime

# FastAPI imports
from sqlalchemy.orm import Session

# Internal imports
from ...models.file_upload import FileUpload
from ...models.user import User
from ...schemas.file_upload import FileUploadStatus


class FileRetrievalService:
    """
    Atomic service for file retrieval and access control operations.
    
    Following integration guide patterns:
    - Single responsibility (retrieval and access control)
    - Comprehensive security checks
    - Access tracking and analytics
    - Clear authorization logic
    """
    
    def __init__(self):
        """Initialize retrieval service."""
        pass
    
    # =============================================================================
    # MAIN ACCESS CONTROL ENTRY POINT
    # =============================================================================
    
    def check_file_access(self, file_record: FileUpload, user: User) -> Tuple[bool, Optional[str]]:
        """
        Comprehensive file access control check.
        
        🎓 LEARNING: Defense in Depth
        =============================
        Multiple layers of access control:
        1. File existence and status
        2. User permissions
        3. Content availability
        4. Future: Department policies, quotas, etc.
        
        Args:
            file_record: FileUpload database record
            user: User requesting access
            
        Returns:
            Tuple of (can_access, error_message)
        """
        # Layer 1: Check file status
        status_valid, status_error = self._check_file_status(file_record)
        if not status_valid:
            return False, status_error
        
        # Layer 2: Check user permissions
        permission_valid, permission_error = self._check_user_permissions(file_record, user)
        if not permission_valid:
            return False, permission_error
        
        # Layer 3: Check content availability
        content_valid, content_error = self._check_content_availability(file_record)
        if not content_valid:
            return False, content_error
        
        # All checks passed
        return True, None
    
    # =============================================================================
    # ACCESS CONTROL LAYERS
    # =============================================================================
    
    def _check_file_status(self, file_record: FileUpload) -> Tuple[bool, Optional[str]]:
        """
        Check if file is in a valid state for access.
        
        Args:
            file_record: FileUpload to check
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check if file is deleted
        if file_record.is_deleted:
            return False, "File has been deleted"
        
        # Check if upload is complete
        if not file_record.is_uploaded:
            return False, "File upload is not complete"
        
        # Check upload status
        if file_record.upload_status == FileUploadStatus.FAILED:
            return False, "File upload failed"
        
        if file_record.upload_status == FileUploadStatus.PROCESSING:
            return False, "File is still being processed"
        
        return True, None
    
    def _check_user_permissions(self, file_record: FileUpload, user: User) -> Tuple[bool, Optional[str]]:
        """
        Check if user has permission to access the file.
        
        🎓 LEARNING: Permission Hierarchy
        ================================
        Permission levels (in order):
        1. File owner (user uploaded the file)
        2. Admin users (can access all files)
        3. Future: Department members with permissions
        4. Future: Shared files or public files
        
        Args:
            file_record: FileUpload to check
            user: User requesting access
            
        Returns:
            Tuple of (has_permission, error_message)
        """
        # Level 1: User owns the file
        if file_record.user_id == user.id:
            return True, None
        
        # Level 2: Admin users can access all files
        if user.is_admin:
            return True, None
        
        # Level 3: Future - Department-based access
        # if user.department_id == file_record.user.department_id and user.has_permission('can_view_department_files'):
        #     return True, None
        
        # Level 4: Future - Shared files
        # if file_record.is_shared and user.has_permission('can_view_shared_files'):
        #     return True, None
        
        # No permission found
        return False, "Access denied"
    
    def _check_content_availability(self, file_record: FileUpload) -> Tuple[bool, Optional[str]]:
        """
        Check if file content is available for retrieval.
        
        Args:
            file_record: FileUpload to check
            
        Returns:
            Tuple of (is_available, error_message)
        """
        # For database-stored files, check if text_content exists
        if not hasattr(file_record, 'text_content'):
            return False, "File content not available"
        
        # Content can be empty string (valid) but not None
        if file_record.text_content is None:
            return False, "File content is not available"
        
        return True, None
    
    # =============================================================================
    # CONTENT RETRIEVAL
    # =============================================================================
    
    def get_file_content(self, file_record: FileUpload, user: User) -> Tuple[Optional[str], Optional[str]]:
        """
        Retrieve file content with access control.
        
        🎓 LEARNING: Secure Content Retrieval
        =====================================
        Content retrieval must:
        1. Validate access permissions first
        2. Return content safely
        3. Track access for analytics
        4. Handle errors gracefully
        
        Args:
            file_record: FileUpload to retrieve content from
            user: User requesting content
            
        Returns:
            Tuple of (content, error_message)
        """
        # Check access permissions
        can_access, access_error = self.check_file_access(file_record, user)
        if not can_access:
            return None, access_error
        
        # Get content from database
        content = file_record.text_content
        
        # Content can be empty string (valid case)
        if content is None:
            return None, "File content is not available"
        
        return content, None
    
    def get_file_metadata(self, file_record: FileUpload, user: User) -> Tuple[Optional[dict], Optional[str]]:
        """
        Retrieve file metadata with access control.
        
        Args:
            file_record: FileUpload to get metadata for
            user: User requesting metadata
            
        Returns:
            Tuple of (metadata_dict, error_message)
        """
        # Check access permissions
        can_access, access_error = self.check_file_access(file_record, user)
        if not can_access:
            return None, access_error
        
        # Build metadata dictionary
        metadata = {
            "id": file_record.id,
            "original_filename": file_record.original_filename,
            "filename": file_record.filename,
            "file_size": file_record.file_size,
            "file_size_human": file_record.get_file_size_human(),
            "mime_type": file_record.mime_type,
            "file_extension": file_record.file_extension,
            "upload_status": file_record.upload_status,
            "upload_date": file_record.upload_date,
            "file_hash": file_record.file_hash,
            "access_count": file_record.access_count,
            "last_accessed": file_record.last_accessed,
            "is_text_file": file_record.is_text_file(),
            "content_length": len(file_record.text_content) if file_record.text_content else 0
        }
        
        return metadata, None
    
    # =============================================================================
    # ACCESS TRACKING
    # =============================================================================
    
    def track_file_access(self, file_record: FileUpload, user: User, db: Session, access_type: str = "view") -> None:
        """
        Track file access for analytics and auditing.
        
        🎓 LEARNING: Access Analytics
        ============================
        Track file access for:
        - Usage analytics (popular files)
        - Security auditing (who accessed what)
        - Performance optimization (cache frequently accessed)
        - User behavior insights
        
        Args:
            file_record: FileUpload that was accessed
            user: User who accessed the file
            db: Database session
            access_type: Type of access (view, download, preview)
        """
        try:
            # Update file access tracking
            file_record.update_access_tracking()
            
            # Future: Create detailed access log entry
            # access_log = FileAccessLog(
            #     file_id=file_record.id,
            #     user_id=user.id,
            #     access_type=access_type,
            #     access_timestamp=datetime.utcnow(),
            #     ip_address=request.client.host if request else None,
            #     user_agent=request.headers.get("user-agent") if request else None
            # )
            # db.add(access_log)
            
            db.commit()
            
        except Exception as e:
            # Don't fail the main operation if tracking fails
            db.rollback()
            print(f"Warning: Failed to track file access: {e}")
    
    # =============================================================================
    # LEGACY COMPATIBILITY
    # =============================================================================
    
    def get_file_path(self, file_record: FileUpload, user: User) -> Tuple[Optional[Path], Optional[str]]:
        """
        Legacy method for backward compatibility.
        
        🎓 LEARNING: Migration Strategy
        ==============================
        When changing storage approach (disk → database), keep legacy methods
        to avoid breaking existing code. Gradually migrate callers to new methods.
        
        Args:
            file_record: FileUpload database record
            user: User requesting access
            
        Returns:
            Tuple of (None, explanation) - no file path for database storage
        """
        can_access, error_message = self.check_file_access(file_record, user)
        if not can_access:
            return None, error_message
        
        # For database-stored files, we don't have a physical file path
        return None, "File content is stored in database, use get_file_content() method"
    
    # =============================================================================
    # PERMISSION UTILITIES
    # =============================================================================
    
    def can_user_delete_file(self, file_record: FileUpload, user: User) -> bool:
        """
        Check if user can delete the specified file.
        
        Args:
            file_record: FileUpload to check
            user: User requesting deletion
            
        Returns:
            True if user can delete file
        """
        # Use model's built-in permission check
        return file_record.can_be_deleted_by_user(user.id) or user.is_admin
    
    def can_user_modify_file(self, file_record: FileUpload, user: User) -> bool:
        """
        Check if user can modify the specified file.
        
        Args:
            file_record: FileUpload to check
            user: User requesting modification
            
        Returns:
            True if user can modify file
        """
        # Only file owner or admin can modify
        return file_record.user_id == user.id or user.is_admin
    
    def get_user_file_permissions(self, file_record: FileUpload, user: User) -> dict:
        """
        Get comprehensive permission information for user and file.
        
        Args:
            file_record: FileUpload to check
            user: User to check permissions for
            
        Returns:
            Dictionary with permission details
        """
        can_access, access_error = self.check_file_access(file_record, user)
        
        permissions = {
            "can_view": can_access,
            "can_download": can_access,
            "can_delete": self.can_user_delete_file(file_record, user),
            "can_modify": self.can_user_modify_file(file_record, user),
            "is_owner": file_record.user_id == user.id,
            "is_admin_access": user.is_admin and file_record.user_id != user.id,
            "access_error": access_error if not can_access else None
        }
        
        return permissions
    
    # =============================================================================
    # BULK OPERATIONS
    # =============================================================================
    
    def check_bulk_file_access(self, file_ids: list, user: User, db: Session) -> dict:
        """
        Check access permissions for multiple files at once.
        
        Args:
            file_ids: List of file IDs to check
            user: User requesting access
            db: Database session
            
        Returns:
            Dictionary with access results for each file
        """
        results = {
            "accessible_files": [],
            "inaccessible_files": [],
            "not_found_files": [],
            "errors": []
        }
        
        for file_id in file_ids:
            try:
                # Get file record
                file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
                
                if not file_record:
                    results["not_found_files"].append(file_id)
                    continue
                
                # Check access
                can_access, error_message = self.check_file_access(file_record, user)
                
                if can_access:
                    results["accessible_files"].append({
                        "file_id": file_id,
                        "filename": file_record.original_filename
                    })
                else:
                    results["inaccessible_files"].append({
                        "file_id": file_id,
                        "filename": file_record.original_filename,
                        "error": error_message
                    })
                    
            except Exception as e:
                results["errors"].append({
                    "file_id": file_id,
                    "error": str(e)
                })
        
        return results
