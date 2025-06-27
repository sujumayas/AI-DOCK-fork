"""
File Upload API Endpoints.

This module handles file upload operations including:
- Secure file upload with validation
- Pre-upload validation for better UX
"""

from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.file_upload import FileUpload
from ...services.file_service import FileService, get_file_service
from ...schemas.file_upload import (
    FileUploadResponse,
    FileUploadValidation,
    AllowedFileType
)

# Create the router
router = APIRouter()


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service),
    db: Session = Depends(get_db)
):
    """
    Upload a file to the AI Dock platform.
    
    🎓 LEARNING: File Upload Endpoint Design
    =======================================
    Key considerations for file uploads:
    
    1. **Security First**: Validate file type, size, and content
    2. **User Experience**: Provide clear error messages
    3. **Performance**: Handle large files efficiently
    4. **Storage**: Organize files systematically
    5. **Access Control**: Users can only upload to their account
    
    **Supported File Types** (Phase 1):
    - Text files (.txt)
    - Markdown files (.md)
    - CSV files (.csv)
    - JSON files (.json)
    
    **File Size Limit**: 10MB maximum
    
    **Security Features**:
    - File type validation
    - Filename sanitization
    - Content scanning
    - User authentication required
    
    Args:
        file: The uploaded file (multipart/form-data)
        current_user: Authenticated user (from JWT token)
        file_service: File service for business logic
        db: Database session
        
    Returns:
        FileUploadResponse with file metadata
        
    Raises:
        400: Invalid file type or size
        401: User not authenticated
        413: File too large
        422: Validation error
        500: Server error during upload
    """
    try:
        # Validate file before processing
        if not file or not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Upload the file using service layer
        file_record, error_message = await file_service.save_uploaded_file(
            file=file,
            user=current_user,
            db=db
        )
        
        if error_message:
            # Determine appropriate HTTP status code based on error
            if "not allowed" in error_message.lower():
                status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            elif "exceeds" in error_message.lower() or "size" in error_message.lower():
                status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            elif "dangerous" in error_message.lower() or "invalid" in error_message.lower():
                status_code = status.HTTP_400_BAD_REQUEST
            else:
                status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            
            raise HTTPException(
                status_code=status_code,
                detail=error_message
            )
        
        # Convert to response model with computed fields
        response_data = FileUploadResponse(
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
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions (they have proper status codes)
        raise
    except Exception as e:
        # Log unexpected errors and return generic 500
        print(f"Unexpected upload error: {e}")  # In production, use proper logging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during file upload"
        )


@router.post("/validate", response_model=Dict[str, Any])
async def validate_file_upload(
    validation_request: FileUploadValidation,
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service)
):
    """
    Pre-validate file upload without actually uploading.
    
    🎓 LEARNING: Pre-validation Pattern
    ==================================
    This endpoint allows frontend to validate files before upload:
    - Check file type is allowed
    - Verify file size is acceptable
    - Show helpful error messages immediately
    - Improve user experience (no failed uploads)
    
    This is especially useful for:
    - Large files (avoid wasted upload time)
    - Drag-and-drop interfaces
    - Progressive file upload flows
    
    Args:
        validation_request: File details to validate
        current_user: Authenticated user
        file_service: File service for validation logic
        
    Returns:
        Validation result with success/error details
    """
    try:
        # Check if file type is allowed
        if not FileUpload.is_allowed_file_type(validation_request.mime_type):
            allowed_types = [e.value for e in AllowedFileType]
            return {
                "valid": False,
                "error": "invalid_file_type",
                "message": f"File type '{validation_request.mime_type}' is not allowed",
                "allowed_types": allowed_types
            }
        
        # Check if file size is acceptable
        if not FileUpload.is_allowed_file_size(validation_request.file_size):
            max_size_mb = file_service.max_file_size / (1024 * 1024)
            return {
                "valid": False,
                "error": "file_too_large",
                "message": f"File size {validation_request.file_size} bytes exceeds {max_size_mb:.1f}MB limit",
                "max_size_bytes": file_service.max_file_size,
                "max_size_human": file_service._format_file_size(file_service.max_file_size)
            }
        
        # Check filename safety
        if not file_service._is_safe_filename(validation_request.filename):
            return {
                "valid": False,
                "error": "unsafe_filename",
                "message": "Filename contains dangerous characters",
                "safe_filename": FileUpload.sanitize_filename(validation_request.filename)
            }
        
        # All validations passed
        return {
            "valid": True,
            "message": "File is valid for upload",
            "sanitized_filename": FileUpload.sanitize_filename(validation_request.filename)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation error: {str(e)}"
        )
