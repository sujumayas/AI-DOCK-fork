"""
File Statistics and Monitoring API Endpoints.

This module handles file statistics and system monitoring including:
- User file statistics
- Upload limits configuration
- File system health checks
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.file_upload import FileUpload
from ...services.file_service import FileService, get_file_service
from ...schemas.file_upload import (
    FileStatistics,
    UploadLimits,
    FileHealthCheck
)

# Create the router
router = APIRouter()


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
