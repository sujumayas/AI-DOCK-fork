"""
File Retrieval API Endpoints.

This module handles file retrieval operations including:
- File download with access control
- File metadata retrieval
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.file_upload import FileUpload
from ...services.file_service import FileService, get_file_service
from ...schemas.file_upload import FileUploadResponse
from .dependencies import get_file_or_404

# Create the router
router = APIRouter()


@router.get("/{file_id}/download")
async def download_file(
    file_record: FileUpload = Depends(get_file_or_404),
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service),
    db: Session = Depends(get_db)
):
    """
    Download a file with proper access control.
    
    🎓 LEARNING: Database-Stored File Downloads
    ============================================
    Since files are now stored in the database as text_content,
    we return the content directly as a downloadable response.
    
    Benefits of this approach:
    - No file system dependencies
    - Consistent with database storage
    - Better for containerized deployments
    - Easier backup/restore
    
    Args:
        file_record: File to download (from URL path)
        current_user: Authenticated user
        file_service: File service for access control
        db: Database session
        
    Returns:
        Response with file content for download
        
    Raises:
        404: File not found
        403: Access denied
        410: File deleted or corrupted
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
            elif "deleted" in error_message.lower():
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail=error_message
                )
            elif "not found" in error_message.lower() or "not available" in error_message.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_message
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_message
                )
        
        # Get file content from database
        if not file_record.text_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File content is empty or not available"
            )
        
        # Update access tracking
        file_service.update_access_tracking(file_record, db)
        
        # Return file content as downloadable response
        return Response(
            content=file_record.text_content.encode('utf-8'),
            media_type=file_record.mime_type or 'text/plain',
            headers={
                "Content-Disposition": f"attachment; filename=\"{file_record.original_filename}\"",
                "X-File-ID": str(file_record.id),
                "X-File-Hash": file_record.file_hash,
                "Content-Length": str(len(file_record.text_content.encode('utf-8')))
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Download failed: {str(e)}"
        )


@router.get("/{file_id}/metadata", response_model=FileUploadResponse)
async def get_file_metadata(
    file_record: FileUpload = Depends(get_file_or_404),
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service)
):
    """
    Get file metadata without downloading the actual file.
    
    🎓 LEARNING: Metadata vs Content
    ===============================
    Sometimes you need file information without the content:
    - File browsers (show size, type, date)
    - Validation (check if file exists)
    - Analytics (track file details)
    - Thumbnails (show file info)
    
    This is much faster than downloading the full file!
    
    Args:
        file_record: File to get metadata for
        current_user: Authenticated user
        file_service: File service for access control
        
    Returns:
        FileUploadResponse with all metadata
    """
    # Check access permissions (same as download)
    can_access, error_message = file_service.get_file_access(file_record, current_user)
    if not can_access:
        if "access denied" in error_message.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_message
            )
        elif "deleted" in error_message.lower():
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail=error_message
            )
        elif "not available" in error_message.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_message
            )
    
    # Return metadata
    return FileUploadResponse(
        id=file_record.id,
        original_filename=file_record.original_filename,
        filename=file_record.filename,
        file_size=file_record.file_size,
        file_size_human=file_record.get_file_size_human(),
        mime_type=file_record.mime_type,
        file_extension=file_record.file_extension,
        upload_status=file_record.upload_status,
        upload_date=file_record.upload_date,
        file_hash=file_record.file_hash,
        access_count=file_record.access_count
    )
