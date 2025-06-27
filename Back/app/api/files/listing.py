"""
File Listing API Endpoints.

This module handles file listing and search operations including:
- Paginated file listing
- Advanced file search with filtering
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.file_upload import FileUpload
from ...services.file_service import FileService, get_file_service
from ...schemas.file_upload import (
    FileListResponse,
    FileSearchRequest,
    FileMetadata
)

# Create the router
router = APIRouter()


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
