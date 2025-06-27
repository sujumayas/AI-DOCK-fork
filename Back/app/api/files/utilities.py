"""
File Utility API Endpoints.

This module handles utility file operations including:
- File content preview for text files
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.file_upload import FileUpload
from ...services.file_service import FileService, get_file_service
from .dependencies import get_file_or_404

# Create the router
router = APIRouter()


@router.get("/{file_id}/content-preview")
async def preview_file_content(
    file_record: FileUpload = Depends(get_file_or_404),
    max_length: int = Query(1000, ge=100, le=10000, description="Maximum characters to preview"),
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service),
    db: Session = Depends(get_db)
):
    """
    Get a preview of text file content without downloading.
    
    🎓 LEARNING: Content Preview
    ===========================
    For text files, users often want to peek at content:
    - Verify it's the right file
    - Check content before using in chat
    - Quick content validation
    
    This is only for text-based files and returns truncated content
    for security and performance reasons.
    
    Args:
        file_record: File to preview
        max_length: Maximum characters to return
        current_user: Authenticated user
        file_service: File service for access control
        db: Database session
        
    Returns:
        JSON with file content preview
    """
    try:
        # Check access permissions
        can_access, error_message = file_service.get_file_access(file_record, current_user)
        if not can_access:
            if "access denied" in error_message.lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_message
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_message
                )
        
        # Only allow preview for text files
        if not file_record.is_text_file():
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Preview is only available for text files"
            )
        
        # Get content from database
        if not file_record.text_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File content is not available"
            )
        
        # Get content preview (truncate if needed)
        content = file_record.text_content
        is_truncated = len(content) > max_length
        
        if is_truncated:
            content = content[:max_length]
        
        # Update access tracking
        file_service.update_access_tracking(file_record, db)
        
        return {
            "file_id": file_record.id,
            "filename": file_record.original_filename,
            "content": content,
            "is_truncated": is_truncated,
            "content_length": len(content),
            "total_file_size": file_record.file_size,
            "total_content_length": len(file_record.text_content),
            "encoding": "utf-8",
            "preview_note": "This is a preview. Download the file for complete content." if is_truncated else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preview failed: {str(e)}"
        )
