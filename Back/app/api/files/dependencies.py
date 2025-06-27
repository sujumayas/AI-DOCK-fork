"""
Shared dependencies for file API endpoints.

This module provides reusable dependency functions that are used
across multiple file API endpoints, following the DRY principle.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.file_upload import FileUpload


def get_file_or_404(file_id: int, db: Session = Depends(get_db)) -> FileUpload:
    """
    Get file by ID or raise 404 error.
    
    🎓 LEARNING: Dependency Pattern
    ==============================
    This is a FastAPI dependency that:
    1. Takes file_id from URL path
    2. Queries database for the file
    3. Returns file if found, raises 404 if not
    4. Can be reused across multiple endpoints
    
    Usage:
    @router.get("/files/{file_id}")
    def get_file(file: FileUpload = Depends(get_file_or_404)):
        # file is guaranteed to exist here
    
    Args:
        file_id: File ID from URL path parameter
        db: Database session dependency
        
    Returns:
        FileUpload: The file record from database
        
    Raises:
        HTTPException: 404 if file not found
    """
    file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID {file_id} not found"
        )
    return file_record
