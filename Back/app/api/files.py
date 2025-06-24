"""
File Upload API Endpoints for AI Dock.

This module provides REST API endpoints for file upload functionality:
- Secure file upload with validation
- File download with access control
- File listing with pagination and search
- File deletion with proper authorization
- File statistics and health monitoring

🎓 LEARNING: File Upload API Design
==================================
File uploads in web APIs require careful consideration of:
1. Security (file type validation, size limits)
2. Performance (streaming uploads, chunked processing)
3. Storage (organized file paths, cleanup)
4. Access control (who can upload/download what)
5. User experience (progress, error messages)

This implementation follows REST principles and provides comprehensive
file management capabilities for the AI Dock platform.
"""

import os
from typing import List, Optional, Dict, Any
from pathlib import Path

# FastAPI imports
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

# Internal imports
from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..models.file_upload import FileUpload
from ..services.file_service import FileService, get_file_service
from ..schemas.file_upload import (
    FileUploadResponse,
    FileListResponse,
    FileSearchRequest,
    FileDeleteRequest,
    FileDeleteResponse,
    FileStatistics,
    FileUploadError,
    UploadLimits,
    FileHealthCheck,
    FileUploadValidation,
    FileMetadata,
    AllowedFileType
)

# Create the router
router = APIRouter(prefix="/files", tags=["Files"])


# =============================================================================
# DEPENDENCY FUNCTIONS
# =============================================================================

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
    """
    file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID {file_id} not found"
        )
    return file_record


# =============================================================================
# FILE UPLOAD ENDPOINTS
# =============================================================================




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


# =============================================================================
# FILE RETRIEVAL ENDPOINTS
# =============================================================================

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
        from fastapi.responses import Response
        
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


# =============================================================================
# FILE LISTING ENDPOINTS
# =============================================================================

@router.get("/", response_model=FileListResponse)
async def list_files(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    include_deleted: bool = Query(False, description="Include deleted files"),
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service),
    db: Session = Depends(get_db)
):
    """
    List user's files with pagination.
    
    🎓 LEARNING: API Pagination
    ==========================
    Large datasets need pagination for:
    - Performance (don't load 1000s of records)
    - User experience (faster page loads)
    - Memory efficiency (server and client)
    
    Standard pagination includes:
    - page: Current page number (1-based)
    - page_size: Items per page (limited to prevent abuse)
    - total_count: Total items available
    - has_next/has_previous: For UI navigation
    
    Args:
        page: Page number (1-based)
        page_size: Number of files per page (max 100)
        include_deleted: Whether to include soft-deleted files
        current_user: Authenticated user
        file_service: File service for business logic
        db: Database session
        
    Returns:
        FileListResponse with paginated file list
    """
    try:
        # Get files using service layer
        result = file_service.get_user_files(
            user=current_user,
            db=db,
            page=page,
            page_size=page_size,
            include_deleted=include_deleted
        )
        
        # Convert files to metadata format
        file_metadata = []
        for file_record in result["files"]:
            metadata = FileMetadata(
                id=file_record.id,
                original_filename=file_record.original_filename,
                file_size_human=file_record.get_file_size_human(),
                mime_type=file_record.mime_type,
                upload_status=file_record.upload_status,
                upload_date=file_record.upload_date,
                access_count=file_record.access_count,
                is_text_file=file_record.is_text_file()
            )
            file_metadata.append(metadata)
        
        # Return paginated response
        return FileListResponse(
            files=file_metadata,
            total_count=result["total_count"],
            page=result["page"],
            page_size=result["page_size"],
            total_pages=result["total_pages"],
            has_next=result["has_next"],
            has_previous=result["has_previous"]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list files: {str(e)}"
        )


@router.post("/search", response_model=FileListResponse)
async def search_files(
    search_request: FileSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search files with advanced filtering.
    
    🎓 LEARNING: Search API Design
    =============================
    Good search APIs provide multiple filters:
    - Text search (filename contains...)
    - Type filters (only PDFs, only images)
    - Date ranges (uploaded this week)
    - Status filters (completed uploads only)
    - Sorting options (by date, size, name)
    
    This gives users powerful ways to find their files!
    
    Args:
        search_request: Search criteria and filters
        current_user: Authenticated user
        db: Database session
        
    Returns:
        FileListResponse with filtered results
    """
    try:
        # Build base query for user's files
        query = db.query(FileUpload).filter(FileUpload.user_id == current_user.id)
        
        # Apply text search filter
        if search_request.query:
            query = query.filter(
                FileUpload.original_filename.ilike(f"%{search_request.query}%")
            )
        
        # Apply file type filter
        if search_request.file_type:
            query = query.filter(FileUpload.mime_type == search_request.file_type.value)
        
        # Apply status filter
        if search_request.status:
            query = query.filter(FileUpload.upload_status == search_request.status.value)
        else:
            # Default: exclude deleted files
            query = query.filter(FileUpload.upload_status != "deleted")
        
        # Apply date range filters
        if search_request.date_from:
            query = query.filter(FileUpload.upload_date >= search_request.date_from)
        if search_request.date_to:
            query = query.filter(FileUpload.upload_date <= search_request.date_to)
        
        # Apply sorting
        sort_column = getattr(FileUpload, search_request.sort_by)
        if search_request.sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply pagination
        offset = (search_request.page - 1) * search_request.page_size
        files = query.offset(offset).limit(search_request.page_size).all()
        
        # Calculate pagination info
        total_pages = (total_count + search_request.page_size - 1) // search_request.page_size
        has_next = search_request.page < total_pages
        has_previous = search_request.page > 1
        
        # Convert to metadata format
        file_metadata = []
        for file_record in files:
            metadata = FileMetadata(
                id=file_record.id,
                original_filename=file_record.original_filename,
                file_size_human=file_record.get_file_size_human(),
                mime_type=file_record.mime_type,
                upload_status=file_record.upload_status,
                upload_date=file_record.upload_date,
                access_count=file_record.access_count,
                is_text_file=file_record.is_text_file()
            )
            file_metadata.append(metadata)
        
        return FileListResponse(
            files=file_metadata,
            total_count=total_count,
            page=search_request.page,
            page_size=search_request.page_size,
            total_pages=total_pages,
            has_next=has_next,
            has_previous=has_previous
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


# =============================================================================
# FILE DELETION ENDPOINTS
# =============================================================================

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


# =============================================================================
# STATISTICS AND MONITORING ENDPOINTS
# =============================================================================

@router.get("/statistics", response_model=FileStatistics)
async def get_file_statistics(
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service),
    db: Session = Depends(get_db)
):
    """
    Get file upload statistics for current user.
    
    🎓 LEARNING: User Analytics
    ==========================
    Users like to see their usage statistics:
    - How many files uploaded
    - Total storage used
    - Most common file types
    - Recent activity
    
    This helps users understand their usage patterns
    and manage their storage effectively.
    
    Args:
        current_user: Authenticated user
        file_service: File service for statistics
        db: Database session
        
    Returns:
        FileStatistics with comprehensive usage data
    """
    try:
        stats = file_service.get_file_statistics(db, user=current_user)
        
        # Get most active users (empty for regular users, populated for admins)
        most_active_users = []
        if current_user.is_admin:
            # For admins, show top uploaders across all users
            top_uploaders = db.query(
                FileUpload.user_id,
                db.func.count(FileUpload.id).label('file_count')
            ).filter(
                FileUpload.upload_status != "deleted"
            ).group_by(
                FileUpload.user_id
            ).order_by(
                db.func.count(FileUpload.id).desc()
            ).limit(5).all()
            
            for uploader in top_uploaders:
                user = db.query(User).filter(User.id == uploader.user_id).first()
                if user:
                    most_active_users.append({
                        "user_id": user.id,
                        "username": user.username,
                        "file_count": uploader.file_count
                    })
        
        return FileStatistics(
            total_files=stats["total_files"],
            total_size_bytes=stats["total_size_bytes"],
            total_size_human=stats["total_size_human"],
            files_by_type=stats["files_by_type"],
            files_by_status=stats["files_by_status"],
            recent_uploads=stats["recent_uploads"],
            avg_file_size_bytes=stats["avg_file_size_bytes"],
            most_active_users=most_active_users
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )


@router.get("/limits", response_model=UploadLimits)
async def get_upload_limits(
    file_service: FileService = Depends(get_file_service)
):
    """
    Get current upload limits and restrictions.
    
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
        UploadLimits with all current restrictions
    """
    try:
        limits = file_service.get_upload_limits()
        
        return UploadLimits(
            max_file_size_bytes=limits["max_file_size_bytes"],
            max_file_size_human=limits["max_file_size_human"],
            allowed_types=limits["allowed_types"],
            allowed_extensions=limits["allowed_extensions"],
            max_files_per_user=limits.get("max_files_per_user"),
            max_total_size_per_user=limits.get("max_total_size_per_user")
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get limits: {str(e)}"
        )


@router.get("/health", response_model=FileHealthCheck)
async def file_system_health_check(
    current_user: User = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service),
    db: Session = Depends(get_db)
):
    """
    Check file system health and availability.
    
    🎓 LEARNING: Health Monitoring
    =============================
    Health checks help detect problems early:
    - Upload directory accessible
    - Sufficient disk space
    - File counts match database
    - No system errors
    
    This endpoint can be called by:
    - Monitoring systems (automated checks)
    - Admin dashboard (system status)
    - Frontend (show service status)
    
    Regular health checks prevent user frustration
    and help maintain system reliability.
    
    Args:
        current_user: Authenticated user (admin access recommended)
        file_service: File service for health checks
        db: Database session
        
    Returns:
        FileHealthCheck with system status
    """
    try:
        health_data = file_service.check_file_system_health(db)
        
        return FileHealthCheck(
            status=health_data["status"],
            upload_directory_exists=health_data["upload_directory_exists"],
            upload_directory_writable=health_data["upload_directory_writable"],
            total_files=health_data["total_files"],
            total_storage_bytes=health_data["total_storage_bytes"],
            disk_space_available=health_data["disk_space_available"],
            errors=health_data["errors"]
        )
        
    except Exception as e:
        # Health check should always return something, even if it fails
        return FileHealthCheck(
            status="error",
            upload_directory_exists=False,
            upload_directory_writable=False,
            total_files=0,
            total_storage_bytes=0,
            disk_space_available=False,
            errors=[f"Health check failed: {str(e)}"]
        )


# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================

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


# =============================================================================
# ADMIN ENDPOINTS (Future Enhancement)
# =============================================================================

# Note: These endpoints would be useful for admin file management
# but are not implemented in Phase 1 to keep scope focused.
# 
# Future admin endpoints could include:
# - GET /files/admin/all - List all files across all users
# - POST /files/admin/cleanup - Clean up orphaned files
# - GET /files/admin/storage-report - Detailed storage analytics
# - DELETE /files/admin/{user_id}/all - Delete all files for a user
# - POST /files/admin/migrate - Migrate files to new storage location
