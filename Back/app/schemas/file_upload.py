"""
File Upload schemas for AI Dock application.

These Pydantic models define the structure and validation rules for:
- File upload requests and responses
- File metadata structures
- File listing and search responses

🎓 LEARNING: API Schema Design
=============================
Schemas serve multiple purposes:
1. Data validation (ensure uploads meet requirements)
2. API documentation (automatic docs at /docs)
3. Type safety (prevents runtime errors)
4. Clear contracts (frontend knows what to expect)

Why separate schemas from models?
- Models define database structure
- Schemas define API structure
- They can differ (some fields private, some computed)
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class FileUploadStatus(str, Enum):
    """
    Possible file upload statuses.
    
    🎓 LEARNING: Enums in APIs
    =========================
    Enums ensure only valid values are used:
    - Frontend gets clear options
    - Backend validates automatically
    - No typos or invalid states
    """
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"
    DELETED = "deleted"


class AllowedFileType(str, Enum):
    """
    Allowed file types for upload.
    
    🎓 LEARNING: File Type Control
    =============================
    By defining allowed types as enum:
    - Easy to add new types later
    - Clear documentation for frontend
    - Automatic validation
    
    📕 PDF SUPPORT: Added application/pdf support
    - Text extraction for AI processing
    - Larger file size limit (25MB)
    - Special handling for password-protected PDFs
    
    📘 WORD SUPPORT: Added Microsoft Word document support
    - Modern .docx files with structure preservation
    - Legacy .doc files for backward compatibility
    - 20MB size limit for Word documents
    - Text extraction with formatting preservation
    """
    TEXT = "text/plain"
    MARKDOWN = "text/markdown"
    CSV = "text/csv"
    JSON = "application/json"
    PYTHON = "text/x-python"
    JAVASCRIPT = "text/javascript"
    HTML = "text/html"
    CSS = "text/css"
    XML = "application/xml"
    PDF = "application/pdf"  # 📕 PDF support for document analysis
    DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"  # 📘 Modern Word documents
    DOC = "application/msword"  # 📘 Legacy Word documents


# =============================================================================
# FILE UPLOAD REQUEST SCHEMAS
# =============================================================================

class FileUploadValidation(BaseModel):
    """
    Schema for pre-upload validation.
    
    🎓 LEARNING: Pre-validation Pattern
    ==================================
    Before actual upload, we validate:
    - File type is allowed
    - File size is acceptable
    - User has permission
    
    This prevents wasted uploads and gives immediate feedback.
    
    📕 PDF ENHANCEMENTS: Enhanced validation for PDF files
    - Different size limits per file type (25MB for PDFs)
    - PDF-specific structure validation
    - Enhanced error messages for PDF issues
    """
    filename: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Original filename to validate"
    )
    file_size: int = Field(
        ...,
        gt=0,  # Greater than 0
        le=26_214_400,  # Less than or equal to 25MB (max across all file types)
        description="File size in bytes (max 25MB for PDFs, 20MB for Word docs, 10MB for other files)"
    )
    mime_type: str = Field(
        ...,
        description="MIME type of the file"
    )
    
    @validator('filename')
    def validate_filename(cls, v):
        """Validate filename format and security."""
        if not v.strip():
            raise ValueError('Filename cannot be empty')
        
        # Check for dangerous patterns
        dangerous_patterns = ['../', '.\\', '<', '>', ':', '"', '|', '?', '*']
        for pattern in dangerous_patterns:
            if pattern in v:
                raise ValueError(f'Filename contains dangerous pattern: {pattern}')
        
        return v.strip()
    
    @validator('file_size')
    def validate_file_size_by_type(cls, v, values):
        """
        Validate file size based on file type.
        
        📕 PDF SUPPORT: Different limits for different file types
        - PDFs: 25MB (for document analysis)
        - Word docs: 20MB (for document processing)
        - Other files: 10MB (for text processing)
        """
        mime_type = values.get('mime_type')
        
        if mime_type == AllowedFileType.PDF.value:
            # PDF files can be up to 25MB
            max_size = 26_214_400  # 25MB
            if v > max_size:
                raise ValueError(f'PDF file size {v} bytes exceeds maximum of 25MB ({max_size} bytes)')
        elif mime_type in [AllowedFileType.DOCX.value, AllowedFileType.DOC.value]:
            # Word documents can be up to 20MB
            max_size = 20_971_520  # 20MB
            if v > max_size:
                file_type_name = "Word document (.docx)" if mime_type == AllowedFileType.DOCX.value else "Word document (.doc)"
                raise ValueError(f'{file_type_name} size {v} bytes exceeds maximum of 20MB ({max_size} bytes)')
        else:
            # Other files limited to 10MB
            max_size = 10_485_760  # 10MB
            if v > max_size:
                raise ValueError(f'File size {v} bytes exceeds maximum of 10MB ({max_size} bytes)')
        
        return v
    
    @validator('mime_type')
    def validate_mime_type(cls, v):
        """Validate MIME type is allowed."""
        allowed_types = [e.value for e in AllowedFileType]
        if v not in allowed_types:
            raise ValueError(f'File type {v} not allowed. Allowed types: {", ".join(allowed_types)}')
        return v
    
    @validator('filename')
    def validate_document_filename(cls, v, values):
        """
        Document-specific filename validation for PDFs and Word documents.
        
        📕 PDF VALIDATION: Special checks for PDF files
        - Ensure .pdf extension matches MIME type
        - Check for valid PDF filename patterns
        
        📘 WORD VALIDATION: Special checks for Word files
        - Ensure .docx/.doc extension matches MIME type
        - Check for valid Word filename patterns
        """
        mime_type = values.get('mime_type')
        
        if mime_type == AllowedFileType.PDF.value:
            # PDF files should have .pdf extension
            if not v.lower().endswith('.pdf'):
                raise ValueError('PDF files must have .pdf extension')
            
            # Check for common PDF naming issues
            if 'password' in v.lower() or 'protected' in v.lower():
                # Warn about potentially password-protected PDFs
                # Note: This is just a filename hint, actual protection check happens during processing
                pass
        
        elif mime_type == AllowedFileType.DOCX.value:
            # Modern Word documents should have .docx extension
            if not v.lower().endswith('.docx'):
                raise ValueError('Modern Word documents must have .docx extension')
            
            # Check for common Word naming issues
            if 'password' in v.lower() or 'protected' in v.lower() or 'readonly' in v.lower():
                # Warn about potentially protected Word documents
                # Note: This is just a filename hint, actual protection check happens during processing
                pass
        
        elif mime_type == AllowedFileType.DOC.value:
            # Legacy Word documents should have .doc extension
            if not v.lower().endswith('.doc'):
                raise ValueError('Legacy Word documents must have .doc extension')
            
            # Check for common legacy Word naming issues
            if 'password' in v.lower() or 'protected' in v.lower() or 'readonly' in v.lower():
                # Warn about potentially protected Word documents
                pass
        
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "filename": "document.pdf",
                "file_size": 2097152,  # 2MB
                "mime_type": "application/pdf"
            },
            "examples": {
                "pdf_document": {
                    "summary": "PDF document upload",
                    "value": {
                        "filename": "quarterly_report.pdf",
                        "file_size": 5242880,  # 5MB
                        "mime_type": "application/pdf"
                    }
                },
                "text_file": {
                    "summary": "Text file upload",
                    "value": {
                        "filename": "document.txt",
                        "file_size": 1024,
                        "mime_type": "text/plain"
                    }
                }
            }
        }


# =============================================================================
# FILE UPLOAD RESPONSE SCHEMAS
# =============================================================================

class FileUploadResponse(BaseModel):
    """
    Schema for successful file upload responses.
    
    🎓 LEARNING: Response Design
    ===========================
    Return enough info for frontend to:
    - Show upload success message
    - Update file lists
    - Enable further actions (download, delete)
    """
    id: int = Field(..., description="Unique file ID")
    original_filename: str = Field(..., description="Original filename")
    filename: str = Field(..., description="System filename")
    file_size: int = Field(..., description="File size in bytes")
    file_size_human: str = Field(..., description="Human-readable file size")
    mime_type: str = Field(..., description="MIME type")
    file_extension: Optional[str] = Field(None, description="File extension")
    upload_status: FileUploadStatus = Field(..., description="Upload status")
    upload_date: datetime = Field(..., description="Upload timestamp")
    file_hash: str = Field(..., description="SHA-256 hash for integrity")
    access_count: int = Field(default=0, description="Number of times accessed")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        schema_extra = {
            "example": {
                "id": 123,
                "original_filename": "my_document.txt",
                "filename": "abc12345_my_document.txt",
                "file_size": 2048,
                "file_size_human": "2.0 KB",
                "mime_type": "text/plain",
                "file_extension": ".txt",
                "upload_status": "completed",
                "upload_date": "2025-06-18T10:30:00Z",
                "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "access_count": 0
            }
        }


class FileMetadata(BaseModel):
    """
    Schema for file metadata (lighter version for lists).
    
    🎓 LEARNING: Different Detail Levels
    ===================================
    Sometimes you need less data:
    - File lists (show many files)
    - Search results (performance)
    - Quick previews (reduce bandwidth)
    """
    id: int = Field(..., description="Unique file ID")
    original_filename: str = Field(..., description="Original filename")
    file_size_human: str = Field(..., description="Human-readable file size")
    mime_type: str = Field(..., description="MIME type")
    upload_status: FileUploadStatus = Field(..., description="Upload status")
    upload_date: datetime = Field(..., description="Upload timestamp")
    access_count: int = Field(default=0, description="Access count")
    is_text_file: bool = Field(..., description="Whether this is a text file")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class FileListResponse(BaseModel):
    """
    Schema for file listing responses.
    
    🎓 LEARNING: Pagination Pattern
    ==============================
    When listing files, include pagination info:
    - Current page and total pages
    - Total count for UI
    - Has more pages for infinite scroll
    """
    files: List[FileMetadata] = Field(..., description="List of files")
    total_count: int = Field(..., description="Total number of files")
    page: int = Field(default=1, description="Current page number")
    page_size: int = Field(default=20, description="Number of files per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_previous: bool = Field(..., description="Whether there are previous pages")
    
    class Config:
        schema_extra = {
            "example": {
                "files": [
                    {
                        "id": 123,
                        "original_filename": "document.txt",
                        "file_size_human": "2.0 KB",
                        "mime_type": "text/plain",
                        "upload_status": "completed",
                        "upload_date": "2025-06-18T10:30:00Z",
                        "access_count": 5,
                        "is_text_file": True
                    }
                ],
                "total_count": 50,
                "page": 1,
                "page_size": 20,
                "total_pages": 3,
                "has_next": True,
                "has_previous": False
            }
        }


# =============================================================================
# FILE SEARCH AND FILTER SCHEMAS
# =============================================================================

class FileSearchRequest(BaseModel):
    """
    Schema for file search requests.
    
    🎓 LEARNING: Search API Design
    =============================
    Good search APIs provide multiple filters:
    - Text search (filename)
    - Type filters (file type)
    - Date ranges (upload date)
    - Status filters (completed only)
    """
    query: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Search query for filename"
    )
    file_type: Optional[AllowedFileType] = Field(
        None,
        description="Filter by file type"
    )
    status: Optional[FileUploadStatus] = Field(
        None,
        description="Filter by upload status"
    )
    date_from: Optional[datetime] = Field(
        None,
        description="Filter files uploaded after this date"
    )
    date_to: Optional[datetime] = Field(
        None,
        description="Filter files uploaded before this date"
    )
    page: int = Field(
        default=1,
        ge=1,  # Greater than or equal to 1
        description="Page number for pagination"
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=100,  # Maximum 100 files per page
        description="Number of files per page"
    )
    sort_by: Optional[str] = Field(
        default="upload_date",
        description="Sort field: upload_date, filename, file_size"
    )
    sort_order: Optional[str] = Field(
        default="desc",
        description="Sort order: asc or desc"
    )
    
    @validator('sort_by')
    def validate_sort_by(cls, v):
        """Validate sort field."""
        allowed_fields = ['upload_date', 'filename', 'file_size', 'access_count']
        if v not in allowed_fields:
            raise ValueError(f'Invalid sort field. Allowed: {", ".join(allowed_fields)}')
        return v
    
    @validator('sort_order')
    def validate_sort_order(cls, v):
        """Validate sort order."""
        if v not in ['asc', 'desc']:
            raise ValueError('Sort order must be "asc" or "desc"')
        return v
    
    @validator('date_to')
    def validate_date_range(cls, v, values):
        """Validate date range is logical."""
        if v and values.get('date_from') and v < values['date_from']:
            raise ValueError('date_to must be after date_from')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "query": "document",
                "file_type": "text/plain",
                "status": "completed",
                "page": 1,
                "page_size": 20,
                "sort_by": "upload_date",
                "sort_order": "desc"
            }
        }


# =============================================================================
# FILE OPERATION SCHEMAS
# =============================================================================

class FileDeleteRequest(BaseModel):
    """
    Schema for file deletion requests.
    
    🎓 LEARNING: Bulk Operations
    ===========================
    Allow deleting multiple files at once:
    - Better user experience
    - Fewer API calls
    - Atomic operations (all or nothing)
    """
    file_ids: List[int] = Field(
        ...,
        min_items=1,
        max_items=50,  # Limit bulk operations
        description="List of file IDs to delete"
    )
    permanent: bool = Field(
        default=False,
        description="Whether to permanently delete (vs soft delete)"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "file_ids": [123, 124, 125],
                "permanent": False
            }
        }


class FileDeleteResponse(BaseModel):
    """
    Schema for file deletion responses.
    """
    deleted_count: int = Field(..., description="Number of files successfully deleted")
    failed_count: int = Field(..., description="Number of files that failed to delete")
    errors: List[str] = Field(default_factory=list, description="Error messages for failed deletions")
    
    class Config:
        schema_extra = {
            "example": {
                "deleted_count": 3,
                "failed_count": 0,
                "errors": []
            }
        }


# =============================================================================
# FILE STATISTICS SCHEMAS
# =============================================================================

class FileStatistics(BaseModel):
    """
    Schema for file upload statistics.
    
    🎓 LEARNING: Analytics Data
    ==========================
    Provide useful stats for:
    - Admin dashboard
    - User insights
    - Storage management
    """
    total_files: int = Field(..., description="Total number of files")
    total_size_bytes: int = Field(..., description="Total storage used in bytes")
    total_size_human: str = Field(..., description="Human-readable total size")
    files_by_type: dict = Field(..., description="Count of files by type")
    files_by_status: dict = Field(..., description="Count of files by status")
    recent_uploads: int = Field(..., description="Files uploaded in last 24 hours")
    avg_file_size_bytes: float = Field(..., description="Average file size")
    most_active_users: List[dict] = Field(..., description="Users with most uploads")
    
    class Config:
        schema_extra = {
            "example": {
                "total_files": 150,
                "total_size_bytes": 52428800,
                "total_size_human": "50.0 MB",
                "files_by_type": {
                    "text/plain": 100,
                    "text/csv": 30,
                    "application/json": 20
                },
                "files_by_status": {
                    "completed": 145,
                    "failed": 3,
                    "uploading": 2
                },
                "recent_uploads": 15,
                "avg_file_size_bytes": 349525.33,
                "most_active_users": [
                    {"user_id": 1, "username": "john_doe", "file_count": 25},
                    {"user_id": 2, "username": "jane_smith", "file_count": 20}
                ]
            }
        }


# =============================================================================
# ERROR RESPONSE SCHEMAS
# =============================================================================

class FileUploadError(BaseModel):
    """
    Schema for file upload error responses.
    
    🎓 LEARNING: Error Handling
    ===========================
    Good error responses include:
    - Clear error type (for frontend handling)
    - Human-readable message (for user display)
    - Details for debugging
    
    📕 PDF ERROR HANDLING: Enhanced for PDF-specific issues
    - Password-protected PDF errors
    - PDF corruption detection
    - Text extraction failures
    - Size limit differentiation
    """
    error: str = Field(..., description="Error type/code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[dict] = Field(None, description="Additional error details")
    allowed_types: Optional[List[str]] = Field(None, description="List of allowed file types")
    max_size_bytes: Optional[int] = Field(None, description="Maximum file size in bytes")
    max_size_human: Optional[str] = Field(None, description="Human-readable max size")
    pdf_specific: Optional[dict] = Field(None, description="PDF-specific error information")
    suggested_action: Optional[str] = Field(None, description="Suggested action for user")
    
    class Config:
        schema_extra = {
            "example": {
                "error": "pdf_password_protected",
                "message": "This PDF is password-protected and cannot be processed",
                "details": {
                    "filename": "protected_document.pdf",
                    "mime_type": "application/pdf",
                    "file_size": 2097152
                },
                "pdf_specific": {
                    "issue": "password_protection",
                    "pages_detected": None,
                    "can_extract_text": False
                },
                "suggested_action": "Please provide an unlocked version of the PDF file"
            },
            "examples": {
                "pdf_password_protected": {
                    "summary": "Password-protected PDF error",
                    "value": {
                        "error": "pdf_password_protected",
                        "message": "This PDF is password-protected and cannot be processed",
                        "suggested_action": "Please provide an unlocked version of the PDF file"
                    }
                },
                "pdf_too_large": {
                    "summary": "PDF file too large",
                    "value": {
                        "error": "file_too_large",
                        "message": "PDF file exceeds the 25MB size limit",
                        "max_size_bytes": 26214400,
                        "max_size_human": "25.0 MB",
                        "suggested_action": "Please compress the PDF or split it into smaller files"
                    }
                },
                "pdf_corrupted": {
                    "summary": "Corrupted PDF file",
                    "value": {
                        "error": "pdf_corrupted",
                        "message": "PDF file appears to be corrupted or invalid",
                        "pdf_specific": {
                            "issue": "file_corruption",
                            "can_extract_text": False
                        },
                        "suggested_action": "Please try uploading the file again or use a different PDF"
                    }
                },
                "invalid_file_type": {
                    "summary": "Invalid file type",
                    "value": {
                        "error": "invalid_file_type",
                        "message": "File type not supported",
                        "allowed_types": ["text/plain", "text/csv", "application/json", "application/pdf"]
                    }
                }
            }
        }


# =============================================================================
# UTILITY SCHEMAS
# =============================================================================

class UploadLimits(BaseModel):
    """
    Schema for upload limits and restrictions.
    
    🎓 LEARNING: Configuration Exposure
    ==================================
    Expose limits to frontend so it can:
    - Show helpful UI hints
    - Validate before upload
    - Display progress correctly
    """
    max_file_size_bytes: int = Field(..., description="Maximum file size in bytes")
    max_file_size_human: str = Field(..., description="Human-readable max size")
    allowed_types: List[str] = Field(..., description="List of allowed MIME types")
    allowed_extensions: List[str] = Field(..., description="List of allowed file extensions")
    max_files_per_user: Optional[int] = Field(None, description="Maximum files per user")
    max_total_size_per_user: Optional[int] = Field(None, description="Max total storage per user")
    
    class Config:
        schema_extra = {
            "example": {
                "max_file_size_bytes": 10485760,
                "max_file_size_human": "10.0 MB",
                "allowed_types": [
                    "text/plain",
                    "text/csv",
                    "application/json"
                ],
                "allowed_extensions": [".txt", ".csv", ".json", ".md"],
                "max_files_per_user": 100,
                "max_total_size_per_user": 104857600
            }
        }


class FileHealthCheck(BaseModel):
    """
    Schema for file system health check.
    """
    status: str = Field(..., description="Health status")
    upload_directory_exists: bool = Field(..., description="Upload directory exists")
    upload_directory_writable: bool = Field(..., description="Upload directory is writable")
    total_files: int = Field(..., description="Total files in system")
    total_storage_bytes: int = Field(..., description="Total storage used")
    disk_space_available: bool = Field(..., description="Sufficient disk space available")
    errors: List[str] = Field(default_factory=list, description="Any health check errors")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "healthy",
                "upload_directory_exists": True,
                "upload_directory_writable": True,
                "total_files": 150,
                "total_storage_bytes": 52428800,
                "disk_space_available": True,
                "errors": []
            }
        }
