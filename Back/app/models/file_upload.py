# AI Dock File Upload Model
# This defines how we store file information in the database

from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional
import os

from ..core.database import Base

class FileUpload(Base):
    """
    File Upload model for storing file metadata in AI Dock.
    
    🎓 LEARNING: File Storage Strategy
    =================================
    We DON'T store the actual file content in the database because:
    - Database gets huge very quickly
    - Poor performance for large files
    - Databases aren't optimized for file storage
    
    Instead, we store:
    - File metadata (name, size, type) in database
    - Actual file content on disk
    - File path to connect them
    
    This is the standard pattern for web applications!
    
    Table: file_uploads
    Purpose: Track uploaded files and their metadata
    """
    
    # =============================================================================
    # TABLE CONFIGURATION
    # =============================================================================
    
    __tablename__ = "file_uploads"
    
    # =============================================================================
    # COLUMNS (DATABASE FIELDS)
    # =============================================================================
    
    # Primary key - unique identifier for each file
    id = Column(
        Integer, 
        primary_key=True, 
        index=True,
        comment="Unique file identifier"
    )
    
    # Original filename that user uploaded
    # Store this so we can show user-friendly names
    original_filename = Column(
        String(255),
        nullable=False,
        index=True,  # For searching files by name
        comment="Original filename as uploaded by user"
    )
    
    # System filename - what we actually save on disk
    # We change the filename for security and avoid conflicts
    filename = Column(
        String(255),
        nullable=False,
        unique=True,  # No two files can have same system filename
        index=True,
        comment="System filename (sanitized and unique)"
    )
    
    # Full path to file on disk
    # This tells us exactly where to find the file
    file_path = Column(
        String(500),  # Longer than filename to handle full paths
        nullable=False,
        unique=True,  # No two files can have same path
        comment="Full path to file on disk"
    )
    
    # File size in bytes
    # BigInteger can handle files up to ~9 quintillion bytes
    file_size = Column(
        BigInteger,  # Regular Integer only goes to ~2GB
        nullable=False,
        index=True,  # For filtering by file size
        comment="File size in bytes"
    )
    
    # MIME type (like 'text/plain', 'application/pdf')
    # This tells us what kind of file it is
    mime_type = Column(
        String(100),
        nullable=False,
        index=True,  # For filtering by file type
        comment="MIME type of the file (e.g., 'text/plain')"
    )
    
    # File extension (like '.txt', '.pdf')
    # Extracted from original filename for quick filtering
    file_extension = Column(
        String(10),
        nullable=True,
        index=True,  # For filtering by file type
        comment="File extension (e.g., '.txt', '.pdf')"
    )
    
    # SHA-256 hash of file content
    # This helps us:
    # 1. Detect duplicate files
    # 2. Verify file integrity (detect corruption)
    # 3. Security validation
    file_hash = Column(
        String(64),  # SHA-256 produces 64-character hex string
        nullable=False,
        index=True,  # For finding duplicate files
        comment="SHA-256 hash of file content for integrity and deduplication"
    )
    
    # Upload status - track file processing state
    # 'uploading', 'completed', 'failed', 'deleted'
    upload_status = Column(
        String(20),
        nullable=False,
        default='uploading',
        index=True,  # For filtering by status
        comment="Upload status: uploading, completed, failed, deleted"
    )
    
    # Error message if upload failed
    error_message = Column(
        Text,
        nullable=True,
        comment="Error message if upload failed"
    )
    
    # =============================================================================
    # USER RELATIONSHIP
    # =============================================================================
    
    # Foreign key to User table - who uploaded this file?
    user_id = Column(
        Integer,
        ForeignKey('users.id', ondelete='CASCADE'),  # Delete files when user is deleted
        nullable=False,
        index=True,
        comment="Foreign key to user who uploaded the file"
    )
    
    # =============================================================================
    # METADATA AND TRACKING
    # =============================================================================
    
    # When the file was uploaded
    upload_date = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,  # For sorting by upload date
        comment="When the file was uploaded"
    )
    
    # When the record was last updated
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="When the file record was last updated"
    )
    
    # When the file was accessed (downloaded)
    last_accessed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the file was last accessed/downloaded"
    )
    
    # Number of times file has been accessed
    access_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of times file has been accessed"
    )
    
    # =============================================================================
    # RELATIONSHIPS
    # =============================================================================
    
    # Relationship to User - who uploaded this file
    user = relationship(
        "User",
        back_populates="uploaded_files",  # User.uploaded_files will list all files
        lazy="select"  # Load user data when needed
    )
    
    # =============================================================================
    # MODEL METHODS
    # =============================================================================
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return f"<FileUpload(id={self.id}, filename='{self.filename}', user_id={self.user_id})>"
    
    def __str__(self) -> str:
        """Human-friendly string representation."""
        return f"{self.original_filename} ({self.get_file_size_human()})"
    
    # =============================================================================
    # PROPERTY METHODS
    # =============================================================================
    
    @property
    def is_uploaded(self) -> bool:
        """Check if file upload is complete."""
        return self.upload_status == 'completed'
    
    @property
    def is_failed(self) -> bool:
        """Check if file upload failed."""
        return self.upload_status == 'failed'
    
    @property
    def is_deleted(self) -> bool:
        """Check if file is marked as deleted."""
        return self.upload_status == 'deleted'
    
    @property
    def file_exists(self) -> bool:
        """Check if file actually exists on disk."""
        return os.path.exists(self.file_path) if self.file_path else False
    
    def get_file_size_human(self) -> str:
        """
        Get human-readable file size.
        
        🎓 LEARNING: File Size Formatting
        ================================
        Convert bytes to KB, MB, GB for better user experience:
        - 1024 bytes = 1 KB
        - 1024 KB = 1 MB  
        - 1024 MB = 1 GB
        
        Returns:
            Human-readable size like "1.5 MB" or "256 KB"
        """
        if not self.file_size:
            return "0 B"
        
        # Define size units
        units = ['B', 'KB', 'MB', 'GB', 'TB']
        size = float(self.file_size)
        
        # Find the appropriate unit
        unit_index = 0
        while size >= 1024 and unit_index < len(units) - 1:
            size /= 1024
            unit_index += 1
        
        # Format with appropriate decimal places
        if size == int(size):
            return f"{int(size)} {units[unit_index]}"
        else:
            return f"{size:.1f} {units[unit_index]}"
    
    def get_file_age_days(self) -> int:
        """Get the age of this file in days."""
        if not self.upload_date:
            return 0
        return (datetime.utcnow() - self.upload_date).days
    
    def is_text_file(self) -> bool:
        """Check if this is a text-based file type."""
        text_types = [
            'text/plain',
            'text/markdown',
            'text/csv',
            'application/json',
            'application/xml',
            'text/xml'
        ]
        return self.mime_type in text_types
    
    def is_image_file(self) -> bool:
        """Check if this is an image file."""
        return self.mime_type and self.mime_type.startswith('image/')
    
    def is_document_file(self) -> bool:
        """
        Check if this is a document file.
        
        📕 PDF SUPPORT: Enhanced document detection
        ==========================================
        Now recognizes PDFs as document files for:
        - Better UI categorization
        - Appropriate processing workflows
        - Document-specific features
        
        📘 WORD SUPPORT: Complete document detection
        ==========================================
        Now includes Word documents for:
        - Document-specific UI elements
        - Structured content processing
        - Document metadata display
        - Text extraction workflows
        """
        document_types = [
            'application/pdf',                                                              # PDF documents
            'application/msword',                                                           # 📘 Legacy Word documents (.doc)
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',    # 📘 Modern Word documents (.docx)
            'application/vnd.ms-excel',                                                     # Legacy Excel
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'           # Modern Excel
        ]
        return self.mime_type in document_types
    
    def is_pdf_file(self) -> bool:
        """
        Check if this is a PDF file.
        
        📕 NEW: PDF-specific detection method
        =====================================
        Useful for:
        - PDF-specific UI elements
        - Conditional processing
        - PDF preview capabilities
        """
        return self.mime_type == 'application/pdf'
    
    def is_word_file(self) -> bool:
        """
        Check if this is a Word document file.
        
        📘 NEW: Word-specific detection method
        ======================================
        Useful for:
        - Word-specific UI elements
        - Document structure processing
        - Word preview capabilities
        - Conditional text extraction
        
        Returns:
            True if this is either a .docx or .doc file
        """
        word_mime_types = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # .docx
            'application/msword'  # .doc
        ]
        return self.mime_type in word_mime_types
    
    def is_modern_word_file(self) -> bool:
        """
        Check if this is a modern Word document (.docx).
        
        📘 NEW: Modern Word detection
        =================================
        Useful for distinguishing between:
        - .docx files (modern, better structure support)
        - .doc files (legacy, limited structure support)
        """
        return self.mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    
    def is_legacy_word_file(self) -> bool:
        """
        Check if this is a legacy Word document (.doc).
        
        📘 NEW: Legacy Word detection
        ==================================
        Useful for:
        - Legacy-specific processing warnings
        - Different extraction methods
        - Format conversion suggestions
        """
        return self.mime_type == 'application/msword'
    
    # =============================================================================
    # BUSINESS LOGIC METHODS
    # =============================================================================
    
    def mark_as_completed(self) -> None:
        """Mark file upload as completed."""
        self.upload_status = 'completed'
        self.error_message = None
    
    def mark_as_failed(self, error_message: str) -> None:
        """Mark file upload as failed with error message."""
        self.upload_status = 'failed'
        self.error_message = error_message
    
    def mark_as_deleted(self) -> None:
        """Mark file as deleted (soft delete)."""
        self.upload_status = 'deleted'
    
    def update_access_tracking(self) -> None:
        """Update access tracking when file is accessed."""
        self.last_accessed_at = datetime.utcnow()
        self.access_count += 1
    
    def can_be_deleted_by_user(self, user_id: int) -> bool:
        """
        Check if file can be deleted by given user.
        
        Args:
            user_id: ID of user trying to delete
            
        Returns:
            True if user can delete this file
        """
        # Users can delete their own files
        return self.user_id == user_id
    
    def get_download_filename(self) -> str:
        """
        Get filename to use for downloads.
        Returns original filename for better user experience.
        """
        return self.original_filename
    
    # =============================================================================
    # VALIDATION METHODS
    # =============================================================================
    
    @staticmethod
    def is_allowed_file_type(mime_type: str) -> bool:
        """
        Check if file type is allowed for upload.
        
        🎓 LEARNING: File Type Security
        ==============================
        We only allow specific file types to prevent:
        - Executable files (.exe, .bat, .sh)
        - Script files (.js, .php, .py) 
        - Archive files that might contain malware
        
        📕 PDF SUPPORT ADDED!
        ====================
        Now supports PDF documents with:
        - Text extraction for AI processing
        - Larger file size limit (25MB)
        - Password protection detection
        - Document metadata extraction
        
        📘 WORD SUPPORT ADDED!
        ======================
        Now supports Microsoft Word documents with:
        - Modern .docx format (Office 2007+)
        - Legacy .doc format (Office 97-2003)
        - Text extraction with structure preservation
        - 20MB size limit for Word documents
        - Tables, lists, and formatting preservation
        """
        allowed_types = [
            'text/plain',           # .txt files
            'text/markdown',        # .md files  
            'text/csv',             # .csv files
            'application/json',     # .json files
            'text/x-python',        # .py files (for code sharing)
            'text/javascript',      # .js files (for code sharing)
            'text/html',            # .html files
            'text/css',             # .css files
            'application/xml',      # .xml files
            'text/xml',             # .xml files
            'application/pdf',      # 📕 PDF documents for AI analysis!
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # 📘 NEW: Modern Word documents (.docx)
            'application/msword'    # 📘 NEW: Legacy Word documents (.doc)
        ]
        return mime_type in allowed_types
    
    @staticmethod
    def is_allowed_file_size(file_size: int, mime_type: str = None) -> bool:
        """
        Check if file size is within allowed limits.
        
        📕 PDF SUPPORT: Different size limits by file type
        =============================================
        - PDF files: 25MB (for document analysis)
        - Word documents: 20MB (for document processing)
        - Other files: 10MB (for text processing)
        
        📘 WORD SUPPORT: Enhanced size limits
        ===================================
        Word documents get 20MB limit because:
        - Complex documents with images and formatting
        - Tables and embedded objects
        - Need space for structure preservation
        - Balance between functionality and performance
        
        Args:
            file_size: File size in bytes
            mime_type: MIME type for size limit determination
            
        Returns:
            True if file size is acceptable
        """
        if mime_type == 'application/pdf':
            # PDF files can be up to 25MB
            MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB in bytes
        elif mime_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']:
            # 📘 Word documents (.docx and .doc) can be up to 20MB
            MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB in bytes
        else:
            # Other files limited to 10MB  
            MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes
            
        return 0 < file_size <= MAX_FILE_SIZE
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize filename for safe storage.
        
        🎓 LEARNING: Filename Security
        =============================
        User-provided filenames can be dangerous:
        - "../../../etc/passwd" (directory traversal)
        - "CON.txt" (Windows reserved names)
        - Files with special characters
        
        We sanitize by:
        - Removing dangerous characters
        - Limiting length
        - Adding unique prefix
        """
        import re
        import uuid
        
        # Remove path separators and dangerous characters
        safe_filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        
        # Remove leading/trailing dots and spaces
        safe_filename = safe_filename.strip('. ')
        
        # Limit length (reserve space for UUID prefix)
        max_length = 200
        if len(safe_filename) > max_length:
            name, ext = os.path.splitext(safe_filename)
            safe_filename = name[:max_length-len(ext)] + ext
        
        # Add UUID prefix to ensure uniqueness
        unique_prefix = str(uuid.uuid4())[:8]
        safe_filename = f"{unique_prefix}_{safe_filename}"
        
        return safe_filename

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_upload_path(user_id: int, filename: str) -> str:
    """
    Create organized file path for uploads.
    
    🎓 LEARNING: File Organization
    =============================
    We organize files by date and user to:
    - Avoid directory overcrowding
    - Make files easier to find
    - Enable efficient cleanup
    
    Structure: uploads/YYYY/MM/DD/user_123_filename.txt
    
    Args:
        user_id: ID of uploading user
        filename: Sanitized filename
        
    Returns:
        Relative path where file should be stored
    """
    from datetime import datetime
    
    # Get current date for organization
    now = datetime.now()
    year = now.strftime('%Y')
    month = now.strftime('%m')
    day = now.strftime('%d')
    
    # Create user-specific filename
    user_filename = f"user_{user_id}_{filename}"
    
    # Create organized path
    relative_path = os.path.join(year, month, day, user_filename)
    
    return relative_path

def get_file_mime_type(filename: str) -> str:
    """
    Detect MIME type from filename extension.
    
    🎓 LEARNING: MIME Types
    ======================
    MIME types tell us what kind of file we're dealing with:
    - text/plain for .txt files
    - application/json for .json files
    - text/csv for .csv files
    
    This is important for:
    - Security validation
    - Proper file handling
    - Browser behavior
    
    Args:
        filename: Name of file to analyze
        
    Returns:
        MIME type string
    """
    import mimetypes
    
    # Get MIME type from filename
    mime_type, _ = mimetypes.guess_type(filename)
    
    # Default to text/plain if unknown
    if mime_type is None:
        mime_type = 'text/plain'
    
    return mime_type

def calculate_file_hash(file_path: str) -> str:
    """
    Calculate SHA-256 hash of file content.
    
    🎓 LEARNING: File Hashing
    ========================
    Hashing creates a unique "fingerprint" for each file:
    - Same content = same hash
    - Different content = different hash
    - Used for detecting duplicates and verifying integrity
    
    Args:
        file_path: Path to file to hash
        
    Returns:
        SHA-256 hash as hex string
    """
    import hashlib
    
    hash_sha256 = hashlib.sha256()
    
    # Read file in chunks to handle large files efficiently
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    
    return hash_sha256.hexdigest()
