"""
File Deletion Service for AI Dock

Atomic service responsible for file deletion operations:
- Soft delete (mark as deleted, recoverable)
- Hard delete (permanent removal)
- Bulk deletion operations
- Permission validation
- Deletion tracking and auditing

🎓 LEARNING: Deletion Strategy Patterns
======================================
This service implements multiple deletion strategies:
- Soft delete: Safe, recoverable, audit-friendly
- Hard delete: Permanent, space-saving, irreversible
- Bulk operations: Efficient multi-file processing
- Permission-based: Only authorized users can delete
- Follows integration guide's data management patterns
"""

from typing import Tuple, Optional, List, Dict, Any
from datetime import datetime

# FastAPI imports
from sqlalchemy.orm import Session

# Internal imports
from ...models.file_upload import FileUpload
from ...models.user import User
from ...schemas.file_upload import FileUploadStatus


class FileDeletionService:
    """
    Atomic service for file deletion operations.
    
    Following integration guide patterns:
    - Single responsibility (deletion only)
    - Multiple deletion strategies
    - Comprehensive permission checks
    - Audit trail maintenance
    - Transactional operations
    """
    
    def __init__(self):
        """Initialize deletion service."""
        pass
    
    # =============================================================================
    # MAIN DELETION ENTRY POINT
    # =============================================================================
    
    def delete_file(
        self, 
        file_record: FileUpload, 
        user: User, 
        db: Session, 
        permanent: bool = False
    ) -> Tuple[bool, Optional[str]]:
        """
        Delete file with appropriate strategy and permission checks.
        
        🎓 LEARNING: Strategy Pattern for Deletion
        ==========================================
        Two deletion strategies:
        1. Soft delete (default): Mark as deleted, keep data
        2. Hard delete: Remove completely, free space
        
        Choice depends on:
        - Business requirements (compliance, audit)
        - Storage constraints (disk space)
        - User safety (accident recovery)
        - Data retention policies
        
        Args:
            file_record: FileUpload to delete
            user: User requesting deletion
            db: Database session
            permanent: Whether to permanently delete
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Validate deletion permissions
            can_delete, permission_error = self._check_deletion_permissions(file_record, user)
            if not can_delete:
                return False, permission_error
            
            # Choose deletion strategy
            if permanent:
                success, error = self._delete_permanently(file_record, db)
            else:
                success, error = self._delete_soft(file_record, db)
            
            return success, error
            
        except Exception as e:
            db.rollback()
            return False, f"Delete failed: {str(e)}"
    
    # =============================================================================
    # PERMISSION VALIDATION
    # =============================================================================
    
    def _check_deletion_permissions(self, file_record: FileUpload, user: User) -> Tuple[bool, Optional[str]]:
        """
        Check if user has permission to delete the file.
        
        🎓 LEARNING: Deletion Authorization
        ==================================
        Deletion is a destructive operation requiring strict validation:
        - User owns the file (primary permission)
        - Admin override (administrative access)
        - File is not already deleted
        - File is not protected/locked
        
        Args:
            file_record: FileUpload to check
            user: User requesting deletion
            
        Returns:
            Tuple of (can_delete, error_message)
        """
        # Check if file is already deleted
        if file_record.is_deleted:
            return False, "File is already deleted"
        
        # Check if user has delete permission
        if not file_record.can_be_deleted_by_user(user.id) and not user.is_admin:
            return False, "Access denied: Cannot delete this file"
        
        # Future: Additional checks
        # - File protection status
        # - Department policies
        # - Retention policies
        # - Active file usage
        
        return True, None
    
    # =============================================================================
    # SOFT DELETION STRATEGY
    # =============================================================================
    
    def _delete_soft(self, file_record: FileUpload, db: Session) -> Tuple[bool, Optional[str]]:
        """
        Soft delete: mark file as deleted but keep all data.
        
        🎓 LEARNING: Soft Delete Benefits
        ================================
        Soft delete provides:
        - Safety: Accidental deletions recoverable
        - Audit: Complete history of file lifecycle
        - Compliance: Meet data retention requirements
        - Performance: Faster than hard delete
        - Rollback: Easy to undo operations
        
        Args:
            file_record: FileUpload to soft delete
            db: Database session
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Mark file as deleted using model method
            file_record.mark_as_deleted()
            
            # Add deletion metadata
            file_record.upload_status = FileUploadStatus.DELETED
            
            # Commit changes
            db.commit()
            
            return True, None
            
        except Exception as e:
            db.rollback()
            return False, f"Soft delete failed: {str(e)}"
    
    # =============================================================================
    # HARD DELETION STRATEGY
    # =============================================================================
    
    def _delete_permanently(self, file_record: FileUpload, db: Session) -> Tuple[bool, Optional[str]]:
        """
        Hard delete: permanently remove file and database record.
        
        🎓 LEARNING: Hard Delete Considerations
        ======================================
        Hard delete is irreversible and should:
        - Remove all traces of the file
        - Free up storage space
        - Maintain referential integrity
        - Log the deletion for auditing
        - Handle cascade deletions properly
        
        Args:
            file_record: FileUpload to permanently delete
            db: Database session
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Note: For database-stored files, we only need to delete the record
            # Future: If using disk storage, would delete physical file here
            
            # Log deletion for audit trail before removing record
            self._log_permanent_deletion(file_record)
            
            # Delete database record (CASCADE should handle related records)
            db.delete(file_record)
            db.commit()
            
            return True, None
            
        except Exception as e:
            db.rollback()
            return False, f"Permanent delete failed: {str(e)}"
    
    def _log_permanent_deletion(self, file_record: FileUpload) -> None:
        """
        Log permanent deletion for audit purposes.
        
        Args:
            file_record: FileUpload being permanently deleted
        """
        # Future: Create audit log entry
        print(f"AUDIT: Permanent deletion of file {file_record.id} ({file_record.original_filename}) at {datetime.utcnow()}")
        
        # In production, this would create a permanent audit record:
        # audit_log = DeletionAuditLog(
        #     file_id=file_record.id,
        #     original_filename=file_record.original_filename,
        #     user_id=file_record.user_id,
        #     file_size=file_record.file_size,
        #     deletion_timestamp=datetime.utcnow(),
        #     deletion_type="permanent"
        # )
    
    # =============================================================================
    # BULK DELETION OPERATIONS
    # =============================================================================
    
    def delete_multiple_files(
        self, 
        file_ids: List[int], 
        user: User, 
        db: Session, 
        permanent: bool = False
    ) -> Dict[str, Any]:
        """
        Delete multiple files at once with detailed results.
        
        🎓 LEARNING: Bulk Operation Patterns
        ===================================
        Bulk operations should:
        - Process each item individually
        - Collect successes and failures
        - Provide detailed feedback
        - Not let one failure stop everything
        - Maintain transaction integrity where possible
        
        Args:
            file_ids: List of file IDs to delete
            user: User requesting deletion
            db: Database session
            permanent: Whether to permanently delete
            
        Returns:
            Dictionary with detailed results
        """
        results = {
            "deleted_count": 0,
            "failed_count": 0,
            "not_found_count": 0,
            "permission_denied_count": 0,
            "successful_deletions": [],
            "failed_deletions": [],
            "errors": []
        }
        
        for file_id in file_ids:
            try:
                # Get file record
                file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
                
                if not file_record:
                    results["not_found_count"] += 1
                    results["errors"].append(f"File {file_id} not found")
                    continue
                
                # Try to delete
                success, error = self.delete_file(file_record, user, db, permanent)
                
                if success:
                    results["deleted_count"] += 1
                    results["successful_deletions"].append({
                        "file_id": file_id,
                        "filename": file_record.original_filename,
                        "deletion_type": "permanent" if permanent else "soft"
                    })
                else:
                    results["failed_count"] += 1
                    results["failed_deletions"].append({
                        "file_id": file_id,
                        "filename": file_record.original_filename,
                        "error": error
                    })
                    
                    # Track specific error types
                    if "access denied" in error.lower():
                        results["permission_denied_count"] += 1
                    
                    results["errors"].append(f"File {file_id}: {error}")
                    
            except Exception as e:
                results["failed_count"] += 1
                results["errors"].append(f"File {file_id}: Unexpected error - {str(e)}")
        
        return results
    
    # =============================================================================
    # RECOVERY OPERATIONS
    # =============================================================================
    
    def restore_soft_deleted_file(self, file_record: FileUpload, user: User, db: Session) -> Tuple[bool, Optional[str]]:
        """
        Restore a soft-deleted file.
        
        🎓 LEARNING: File Recovery
        =========================
        Recovery from soft delete:
        - Only works for soft-deleted files
        - Requires appropriate permissions
        - Restores full functionality
        - Updates metadata appropriately
        
        Args:
            file_record: FileUpload to restore
            user: User requesting restoration
            db: Database session
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Check if file is soft-deleted
            if not file_record.is_deleted:
                return False, "File is not deleted"
            
            # Check permissions (same as deletion)
            can_restore, permission_error = self._check_deletion_permissions(file_record, user)
            if not can_restore:
                return False, f"Cannot restore file: {permission_error}"
            
            # Restore file
            file_record.upload_status = FileUploadStatus.COMPLETED
            file_record.is_deleted = False
            
            # Update metadata
            # file_record.restored_at = datetime.utcnow()
            # file_record.restored_by_user_id = user.id
            
            db.commit()
            
            return True, None
            
        except Exception as e:
            db.rollback()
            return False, f"Restore failed: {str(e)}"
    
    def get_user_deleted_files(self, user: User, db: Session, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """
        Get paginated list of user's soft-deleted files.
        
        Args:
            user: User to get deleted files for
            db: Database session
            page: Page number
            page_size: Items per page
            
        Returns:
            Dictionary with paginated deleted files
        """
        try:
            # Query soft-deleted files
            query = db.query(FileUpload).filter(
                FileUpload.user_id == user.id,
                FileUpload.upload_status == FileUploadStatus.DELETED
            )
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            offset = (page - 1) * page_size
            deleted_files = query.order_by(FileUpload.upload_date.desc()).offset(offset).limit(page_size).all()
            
            # Calculate pagination info
            total_pages = (total_count + page_size - 1) // page_size
            has_next = page < total_pages
            has_previous = page > 1
            
            return {
                "files": deleted_files,
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_next": has_next,
                "has_previous": has_previous
            }
            
        except Exception as e:
            return {
                "error": f"Failed to retrieve deleted files: {str(e)}",
                "files": [],
                "total_count": 0
            }
    
    # =============================================================================
    # CLEANUP OPERATIONS
    # =============================================================================
    
    def cleanup_old_deleted_files(self, db: Session, days_threshold: int = 30) -> Dict[str, Any]:
        """
        Permanently delete soft-deleted files older than threshold.
        
        🎓 LEARNING: Automated Cleanup
        =============================
        Automated cleanup helps:
        - Free storage space
        - Comply with retention policies
        - Maintain system performance
        - Reduce database size
        
        Should be run periodically as a maintenance task.
        
        Args:
            db: Database session
            days_threshold: Delete files soft-deleted more than this many days ago
            
        Returns:
            Dictionary with cleanup results
        """
        try:
            from datetime import timedelta
            
            # Calculate cutoff date
            cutoff_date = datetime.utcnow() - timedelta(days=days_threshold)
            
            # Find old soft-deleted files
            old_deleted_files = db.query(FileUpload).filter(
                FileUpload.upload_status == FileUploadStatus.DELETED,
                FileUpload.upload_date < cutoff_date  # Using upload_date as proxy for deletion_date
            ).all()
            
            cleanup_results = {
                "files_found": len(old_deleted_files),
                "files_cleaned": 0,
                "files_failed": 0,
                "space_freed_bytes": 0,
                "errors": []
            }
            
            # Delete each file permanently
            for file_record in old_deleted_files:
                try:
                    # Track space that will be freed
                    cleanup_results["space_freed_bytes"] += file_record.file_size
                    
                    # Log permanent deletion
                    self._log_permanent_deletion(file_record)
                    
                    # Delete permanently
                    db.delete(file_record)
                    cleanup_results["files_cleaned"] += 1
                    
                except Exception as e:
                    cleanup_results["files_failed"] += 1
                    cleanup_results["errors"].append(f"File {file_record.id}: {str(e)}")
            
            # Commit all changes
            db.commit()
            
            return cleanup_results
            
        except Exception as e:
            db.rollback()
            return {
                "error": f"Cleanup failed: {str(e)}",
                "files_found": 0,
                "files_cleaned": 0,
                "files_failed": 0
            }
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def get_deletion_statistics(self, db: Session, user: Optional[User] = None) -> Dict[str, Any]:
        """
        Get deletion statistics for monitoring and analytics.
        
        Args:
            db: Database session
            user: Optional user to filter by
            
        Returns:
            Dictionary with deletion statistics
        """
        try:
            # Base query
            query = db.query(FileUpload)
            
            # Filter by user if specified
            if user:
                query = query.filter(FileUpload.user_id == user.id)
            
            # Count by status
            total_files = query.count()
            active_files = query.filter(FileUpload.upload_status != FileUploadStatus.DELETED).count()
            deleted_files = query.filter(FileUpload.upload_status == FileUploadStatus.DELETED).count()
            
            # Calculate percentages
            deletion_rate = (deleted_files / total_files * 100) if total_files > 0 else 0
            
            return {
                "total_files": total_files,
                "active_files": active_files,
                "deleted_files": deleted_files,
                "deletion_rate_percent": deletion_rate,
                "can_be_restored": deleted_files  # All soft-deleted files can be restored
            }
            
        except Exception as e:
            return {
                "error": f"Failed to get deletion statistics: {str(e)}",
                "total_files": 0,
                "active_files": 0,
                "deleted_files": 0
            }
