"""
File Storage Service for AI Dock

Atomic service responsible for file upload and storage operations:
- Database-stored file content (in-memory approach)
- File metadata management
- Hash calculation and deduplication
- Upload status tracking
- Transactional storage operations

🎓 LEARNING: Database Storage Strategy
=====================================
This service implements database-stored files rather than disk storage:
- Simplifies deployment (no file system dependencies)
- Ensures data consistency (everything in database)
- Works well for text files up to reasonable sizes
- Allows easy backup/restore with database
- Follows integration guide's storage patterns
"""

import hashlib
import os
from datetime import datetime
from typing import Tuple, Optional

# FastAPI imports
from fastapi import UploadFile
from sqlalchemy.orm import Session

# Internal imports
from ...models.file_upload import FileUpload, create_upload_path, get_file_mime_type
from ...models.user import User
from ...schemas.file_upload import FileUploadStatus


class FileStorageService:
    """
    Atomic service for file storage operations.
    
    Following integration guide patterns:
    - Single responsibility (storage only)
    - Database-first approach
    - Comprehensive error handling
    - Transactional operations
    - No file system dependencies
    """
    
    def __init__(self):
        """Initialize storage service."""
        # Maximum content size for database storage (50MB of text)
        self.max_content_size = 50 * 1024 * 1024
        
        # Chunk size for reading large files
        self.chunk_size = 8192  # 8KB chunks
    
    # =============================================================================
    # MAIN STORAGE ENTRY POINT
    # =============================================================================
    
    async def store_file_content(
        self, 
        file: UploadFile, 
        user: User, 
        extracted_text: str,
        db: Session
    ) -> Tuple[Optional[FileUpload], Optional[str]]:
        """
        Store file content and metadata in database.
        
        🎓 LEARNING: Transactional Storage
        =================================
        This method:
        1. Reads file content safely
        2. Calculates file hash for integrity
        3. Creates database record with metadata
        4. Stores extracted text content
        5. Handles rollback on errors
        
        All operations are atomic - either everything succeeds or nothing changes.
        
        Args:
            file: FastAPI UploadFile object
            user: User uploading the file
            extracted_text: Pre-extracted text content
            db: Database session
            
        Returns:
            Tuple of (FileUpload object, error_message)
        """
        file_record = None
        try:
            # Read file content in-memory
            content_bytes = await self._read_file_content_safely(file)
            
            # Calculate file hash for integrity/deduplication
            file_hash = self._calculate_file_hash(content_bytes)
            
            # Generate unique virtual file path
            virtual_file_path = self._generate_virtual_path(user.id, file.filename)
            
            # Create file metadata record
            file_record = self._create_file_record(
                file=file,
                user=user,
                content_bytes=content_bytes,
                extracted_text=extracted_text,
                file_hash=file_hash,
                virtual_file_path=virtual_file_path
            )
            
            # Save to database
            db.add(file_record)
            db.commit()
            db.refresh(file_record)
            
            return file_record, None
            
        except Exception as e:
            # Rollback transaction on any error
            if db:
                db.rollback()
            
            # Mark record as failed if it was created
            if file_record and hasattr(file_record, 'id') and file_record.id:
                try:
                    file_record.mark_as_failed(str(e))
                    db.commit()
                except:
                    pass
            
            return None, f"Storage failed: {str(e)}"
    
    # =============================================================================
    # FILE CONTENT OPERATIONS
    # =============================================================================
    
    async def _read_file_content_safely(self, file: UploadFile) -> bytes:
        """
        Read file content safely with size limits and error handling.
        
        🎓 LEARNING: Safe File Reading
        =============================
        Reading uploaded files requires:
        - Size limit enforcement
        - Memory-efficient chunked reading
        - Proper error handling
        - File position management
        
        Args:
            file: UploadFile to read
            
        Returns:
            File content as bytes
            
        Raises:
            ValueError: If file is too large
            Exception: On read errors
        """
        # Reset file position to beginning
        await file.seek(0)
        
        # Read content in chunks to handle large files
        content_chunks = []
        total_size = 0
        
        while chunk := await file.read(self.chunk_size):
            content_chunks.append(chunk)
            total_size += len(chunk)
            
            # Check size limit during reading
            if total_size > self.max_content_size:
                raise ValueError(f"File content exceeds maximum size limit ({self.max_content_size / (1024*1024):.1f}MB)")
        
        # Combine all chunks
        content_bytes = b''.join(content_chunks)
        
        return content_bytes
    
    def _calculate_file_hash(self, content_bytes: bytes) -> str:
        """
        Calculate SHA-256 hash of file content for integrity checking.
        
        🎓 LEARNING: File Integrity
        ==========================
        File hashes provide:
        - Integrity verification (detect corruption)
        - Deduplication (same hash = same content)
        - Change detection (hash changes if content changes)
        - Security (tamper detection)
        
        Args:
            content_bytes: File content as bytes
            
        Returns:
            SHA-256 hash as hexadecimal string
        """
        return hashlib.sha256(content_bytes).hexdigest()
    
    def _generate_virtual_path(self, user_id: int, filename: str) -> str:
        """
        Generate unique virtual file path for database storage.
        
        🎓 LEARNING: Virtual File Paths
        ==============================
        Since we store in database, we don't need real file paths.
        Virtual paths provide:
        - Unique identifiers (satisfies DB constraints)
        - Logical organization (by user/date)
        - Future migration path (if moving to disk storage)
        
        Args:
            user_id: ID of user uploading file
            filename: Original filename
            
        Returns:
            Unique virtual path string
        """
        # Sanitize filename for virtual path
        sanitized_filename = FileUpload.sanitize_filename(filename)
        
        # Use model's path creation function for consistency
        virtual_path = create_upload_path(user_id, sanitized_filename)
        
        return virtual_path
    
    # =============================================================================
    # DATABASE RECORD CREATION
    # =============================================================================
    
    def _create_file_record(
        self,
        file: UploadFile,
        user: User,
        content_bytes: bytes,
        extracted_text: str,
        file_hash: str,
        virtual_file_path: str
    ) -> FileUpload:
        """
        Create FileUpload database record with all metadata.
        
        🎓 LEARNING: Model Creation
        ==========================
        Creating database records involves:
        - Setting all required fields
        - Computing derived fields
        - Ensuring data consistency
        - Following model constraints
        
        Args:
            file: Original UploadFile
            user: User uploading
            content_bytes: File content
            extracted_text: Extracted text content
            file_hash: Content hash
            virtual_file_path: Virtual storage path
            
        Returns:
            FileUpload model instance
        """
        # Determine content type
        content_type = file.content_type or get_file_mime_type(file.filename)
        
        # Create file record with all metadata
        file_record = FileUpload(
            # Basic file information
            original_filename=file.filename,
            filename=FileUpload.sanitize_filename(file.filename),
            file_path=virtual_file_path,
            
            # Size and type information
            file_size=len(content_bytes),
            mime_type=content_type,
            file_extension=os.path.splitext(file.filename)[1].lower(),
            
            # User and status information
            user_id=user.id,
            upload_status=FileUploadStatus.COMPLETED,
            
            # Content and integrity
            file_hash=file_hash,
            text_content=extracted_text,
            
            # Timestamps (set automatically by model)
            upload_date=datetime.utcnow()
        )
        
        return file_record
    
    # =============================================================================
    # STORAGE VALIDATION
    # =============================================================================
    
    def validate_storage_requirements(self, content_bytes: bytes, extracted_text: str) -> Tuple[bool, Optional[str]]:
        """
        Validate that content can be stored in database.
        
        🎓 LEARNING: Storage Validation
        ==============================
        Database storage has different limits than file storage:
        - Text content size limits
        - Database field constraints
        - Memory usage considerations
        
        Args:
            content_bytes: Raw file content
            extracted_text: Extracted text content
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check raw content size
        if len(content_bytes) > self.max_content_size:
            max_size_mb = self.max_content_size / (1024 * 1024)
            return False, f"File content exceeds database storage limit ({max_size_mb:.1f}MB)"
        
        # Check extracted text size (database TEXT field limits)
        max_text_size = 16 * 1024 * 1024  # 16MB text limit for most databases
        if len(extracted_text) > max_text_size:
            text_size_mb = len(extracted_text) / (1024 * 1024)
            max_text_mb = max_text_size / (1024 * 1024)
            return False, f"Extracted text size ({text_size_mb:.1f}MB) exceeds database limit ({max_text_mb:.1f}MB)"
        
        return True, None
    
    # =============================================================================
    # STORAGE STATISTICS
    # =============================================================================
    
    def get_storage_info(self, db: Session, user: Optional[User] = None) -> dict:
        """
        Get storage information and statistics.
        
        Args:
            db: Database session
            user: Optional user to filter by
            
        Returns:
            Dictionary with storage statistics
        """
        try:
            # Base query
            query = db.query(FileUpload)
            
            # Filter by user if specified
            if user:
                query = query.filter(FileUpload.user_id == user.id)
            
            # Filter out deleted files
            active_files = query.filter(FileUpload.upload_status != FileUploadStatus.DELETED)
            
            # Calculate statistics
            files = active_files.all()
            total_files = len(files)
            total_raw_size = sum(f.file_size for f in files)
            total_text_size = sum(len(f.text_content or "") for f in files)
            
            # Average sizes
            avg_raw_size = total_raw_size / total_files if total_files > 0 else 0
            avg_text_size = total_text_size / total_files if total_files > 0 else 0
            
            # Compression ratio (text vs raw)
            compression_ratio = (total_text_size / total_raw_size * 100) if total_raw_size > 0 else 0
            
            return {
                "total_files": total_files,
                "total_raw_size_bytes": total_raw_size,
                "total_text_size_bytes": total_text_size,
                "average_raw_size_bytes": avg_raw_size,
                "average_text_size_bytes": avg_text_size,
                "text_compression_ratio_percent": compression_ratio,
                "storage_efficiency": "database_stored"
            }
            
        except Exception as e:
            return {
                "error": f"Failed to get storage info: {str(e)}",
                "total_files": 0,
                "total_raw_size_bytes": 0,
                "total_text_size_bytes": 0
            }
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def check_duplicate_by_hash(self, file_hash: str, user_id: int, db: Session) -> Optional[FileUpload]:
        """
        Check if file with same hash already exists for user.
        
        🎓 LEARNING: Deduplication
        =========================
        Checking for duplicates by hash:
        - Saves storage space
        - Prevents redundant uploads
        - Detects identical content
        - User-scoped to maintain privacy
        
        Args:
            file_hash: SHA-256 hash to check
            user_id: User ID to scope check
            db: Database session
            
        Returns:
            FileUpload record if duplicate found, None otherwise
        """
        try:
            existing_file = db.query(FileUpload).filter(
                FileUpload.file_hash == file_hash,
                FileUpload.user_id == user_id,
                FileUpload.upload_status != FileUploadStatus.DELETED
            ).first()
            
            return existing_file
        except Exception:
            # If check fails, allow upload to proceed
            return None
    
    def get_storage_limits(self) -> dict:
        """Get current storage limits and configuration."""
        return {
            "max_content_size_bytes": self.max_content_size,
            "max_content_size_human": self._format_bytes(self.max_content_size),
            "chunk_size_bytes": self.chunk_size,
            "storage_type": "database",
            "supports_deduplication": True,
            "supports_integrity_checking": True
        }
    
    def _format_bytes(self, size_bytes: int) -> str:
        """Format byte size as human-readable string."""
        if size_bytes == 0:
            return "0 B"
        
        units = ['B', 'KB', 'MB', 'GB']
        size = float(size_bytes)
        unit_index = 0
        
        while size >= 1024 and unit_index < len(units) - 1:
            size /= 1024
            unit_index += 1
        
        if size == int(size):
            return f"{int(size)} {units[unit_index]}"
        else:
            return f"{size:.1f} {units[unit_index]}"
