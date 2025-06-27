"""
File Deletion API Endpoints.

This module handles file deletion operations including:
- Single file deletion (soft delete by default)
- Bulk file deletion
"""

from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.file_upload import FileUpload
from ...services.file_service import FileService, get_file_service
from ...schemas.file_upload import (
    FileDeleteRequest,
    FileDeleteResponse
)
from .dependencies import get_file_or_404

# Create the router
router = APIRouter()


@router.delete("/{file_id}", response_model=Dict[str, Any])
async def delete_file(
    file_record: FileUpload = Depends(get_file_or_404),
    permanent: bool = Query(False, description="Permanently delete file"),
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service),
    db: Session = Depends(get_db)
):
    """
    Delete a file (soft delete by default).
    
    🎓 LEARNING: Soft vs Hard Delete
    ===============================
    Two deletion strategies:
    
    **Soft Delete** (default):
    - Mark file as deleted in database
    - Keep file on disk for recovery
    - User can't see it anymore
    - Can be restored by admin
    
    **Hard Delete** (permanent=true):
    - Remove file from disk completely
    - Delete database record
    - Cannot be recovered
    - Use only when certain
    
    Most applications use soft delete by default for safety!
    
    Args:
        file_record: File to delete
        permanent: Whether to permanently delete
        current_user: Authenticated user
        file_service: File service for deletion logic
        db: Database session
        
    Returns:
        Success message with deletion details
    """
    try:
        success, error_message = file_service.delete_file(
            file_record=file_record,
            user=current_user,
            db=db,
            permanent=permanent
        )
        
        if not success:
            if "access denied" in error_message.lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_message
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_message
                )
        
        deletion_type = "permanently deleted" if permanent else "moved to trash"
        return {
            "success": True,
            "message": f"File '{file_record.original_filename}' has been {deletion_type}",
            "file_id": file_record.id,
            "deletion_type": "permanent" if permanent else "soft",
            "can_recover": not permanent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Delete failed: {str(e)}"
        )


@router.post("/bulk-delete", response_model=FileDeleteResponse)
async def bulk_delete_files(
    delete_request: FileDeleteRequest,
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service),
    db: Session = Depends(get_db)
):
    """
    Delete multiple files at once.
    
    🎓 LEARNING: Bulk Operations
    ===========================
    Bulk operations improve user experience:
    - Select multiple files and delete all
    - More efficient than individual requests
    - Better error handling (partial success)
    - Atomic operations when possible
    
    This endpoint processes each file individually and
    reports success/failure for each one.
    
    Args:
        delete_request: List of file IDs to delete
        current_user: Authenticated user
        file_service: File service for bulk operations
        db: Database session
        
    Returns:
        FileDeleteResponse with success/failure summary
    """
    try:
        result = file_service.bulk_delete_files(
            file_ids=delete_request.file_ids,
            user=current_user,
            db=db,
            permanent=delete_request.permanent
        )
        
        return FileDeleteResponse(
            deleted_count=result["deleted_count"],
            failed_count=result["failed_count"],
            errors=result["errors"]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk delete failed: {str(e)}"
        )
