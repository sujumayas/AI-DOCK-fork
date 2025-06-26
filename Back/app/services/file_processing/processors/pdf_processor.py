"""
PDF file processor implementation.

This module handles PDF files with robust text extraction, metadata analysis,
and error handling for various PDF-specific issues.

🎓 LEARNING: PDF Processing Challenges
===================================
PDF processing presents unique challenges:
- Password-protected documents
- Image-only PDFs (no extractable text)
- Complex layouts with multiple columns
- Corrupted or malformed files
- Very large documents requiring pagination
"""

import logging
from typing import Dict, Any, Optional
from pathlib import Path
import io

try:
    import PyPDF2
    from PyPDF2 import PdfReader
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

from .base_processor import BaseFileProcessor
from ..types import ContentType, PDFMetadata
from ..config import config
from ..exceptions import (
    PDFProcessingError,
    PDFPasswordProtectedError,
    PDFCorruptedError,
    PDFNoTextError,
    UnsupportedFileTypeError
)
from ...models.file_upload import FileUpload

logger = logging.getLogger(__name__)


class PDFProcessor(BaseFileProcessor):
    """
    PDF file processor with advanced text extraction and error handling.
    
    🎓 LEARNING: Multiple Extraction Strategies
    ==========================================
    PDFs can be tricky, so we use multiple extraction methods:
    1. pdfplumber (best for complex layouts, tables)
    2. PyPDF2 (reliable fallback, faster for simple PDFs)
    3. Graceful degradation when libraries unavailable
    """
    
    SUPPORTED_MIME_TYPES = {
        'application/pdf'
    }
    
    def __init__(self):
        super().__init__()
        self.check_dependencies()
    
    def check_dependencies(self) -> None:
        """Check if required PDF processing libraries are available."""
        if not HAS_PYPDF2 and not HAS_PDFPLUMBER:
            raise UnsupportedFileTypeError(
                "PDF processing requires PyPDF2 or pdfplumber library. "
                "Install with: pip install PyPDF2 pdfplumber"
            )
    
    def can_process(self, mime_type: str) -> bool:
        """Check if this processor can handle the given MIME type."""
        return mime_type in self.SUPPORTED_MIME_TYPES
    
    def get_content_type(self, mime_type: str) -> ContentType:
        """Get the appropriate ContentType for PDF files."""
        return ContentType.STRUCTURED_DATA
    
    def validate_format_specific(self, file_upload: FileUpload) -> None:
        """PDF-specific validation."""
        # Check if file size is within PDF limits
        if file_upload.file_size > self.config.pdf.max_pdf_size:
            raise PDFProcessingError(
                f"PDF file too large: {file_upload.file_size} bytes "
                f"(max {self.config.pdf.max_pdf_size})",
                file_upload.id
            )
    
    async def extract_content(self, file_upload: FileUpload) -> str:
        """
        Extract text content from PDF file.
        
        🎓 LEARNING: Robust PDF Text Extraction
        ======================================
        PDF text extraction strategy:
        1. Try pdfplumber first (better layout preservation)
        2. Fall back to PyPDF2 if pdfplumber fails
        3. Handle common PDF issues (password, corruption, no text)
        4. Extract metadata and structure information
        
        Args:
            file_upload: FileUpload model instance
            
        Returns:
            Extracted text content
            
        Raises:
            PDFProcessingError: If extraction fails
        """
        try:
            # Get file content as bytes
            pdf_bytes = await self._get_pdf_bytes(file_upload)
            
            # Try pdfplumber first (preferred for complex layouts)
            if HAS_PDFPLUMBER:
                try:
                    return await self._extract_with_pdfplumber(pdf_bytes, file_upload)
                except Exception as e:
                    self.logger.warning(
                        f"pdfplumber extraction failed for {file_upload.filename}: {e}"
                    )
                    # Fall back to PyPDF2
            
            # Try PyPDF2 as fallback
            if HAS_PYPDF2:
                return await self._extract_with_pypdf2(pdf_bytes, file_upload)
            
            raise PDFProcessingError(
                "No PDF processing library available",
                file_upload.id
            )
            
        except PDFProcessingError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error extracting PDF {file_upload.filename}: {e}")
            raise PDFProcessingError(
                f"Failed to extract content from PDF: {str(e)}",
                file_upload.id
            )
    
    async def _get_pdf_bytes(self, file_upload: FileUpload) -> bytes:
        """Get PDF content as bytes from file_upload."""
        if hasattr(file_upload, 'file_path') and file_upload.file_path:
            # File stored on disk
            file_path = Path(file_upload.file_path)
            if not file_path.exists():
                raise PDFProcessingError(
                    f"PDF file not found: {file_path}",
                    file_upload.id
                )
            return file_path.read_bytes()
        
        elif hasattr(file_upload, 'file_data') and file_upload.file_data:
            # File stored as binary data in database
            return file_upload.file_data
        
        else:
            raise PDFProcessingError(
                f"No accessible content for PDF {file_upload.filename}",
                file_upload.id
            )
    
    async def _extract_with_pdfplumber(self, pdf_bytes: bytes, file_upload: FileUpload) -> str:
        """
        Extract text using pdfplumber (preferred method).
        
        🎓 LEARNING: pdfplumber Benefits
        ==============================
        pdfplumber excels at:
        - Preserving text layout and spacing
        - Handling tables and columns correctly
        - Extracting metadata about text positioning
        - Better handling of complex PDF structures
        """
        import pdfplumber
        
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                # Check for password protection
                if pdf.pages and hasattr(pdf.pages[0], 'is_encrypted') and pdf.pages[0].is_encrypted:
                    raise PDFPasswordProtectedError(
                        f"PDF {file_upload.filename} is password-protected",
                        file_upload.id
                    )
                
                # Check page count
                page_count = len(pdf.pages)
                if page_count == 0:
                    raise PDFNoTextError(
                        f"PDF {file_upload.filename} contains no pages",
                        file_upload.id
                    )
                
                # Limit pages to process
                max_pages = min(page_count, self.config.pdf.max_pdf_pages)
                
                extracted_text_parts = []
                pages_with_text = 0
                
                for page_num in range(max_pages):
                    page = pdf.pages[page_num]
                    page_text = page.extract_text()
                    
                    if page_text and page_text.strip():
                        extracted_text_parts.append(f"--- Page {page_num + 1} ---\n{page_text}")
                        pages_with_text += 1
                    
                    # Check if we've extracted too much text
                    current_text = '\n\n'.join(extracted_text_parts)
                    if len(current_text) > self.config.pdf.max_extracted_text:
                        self.logger.info(
                            f"Stopping PDF extraction at page {page_num + 1} "
                            f"due to size limit ({len(current_text)} chars)"
                        )
                        break
                
                if not extracted_text_parts:
                    raise PDFNoTextError(
                        f"PDF {file_upload.filename} contains no extractable text",
                        file_upload.id
                    )
                
                extracted_text = '\n\n'.join(extracted_text_parts)
                
                self.logger.info(
                    f"pdfplumber extracted {len(extracted_text)} chars from "
                    f"{pages_with_text}/{page_count} pages of {file_upload.filename}"
                )
                
                return extracted_text
                
        except PDFProcessingError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            # Convert other errors to our format
            if "password" in str(e).lower():
                raise PDFPasswordProtectedError(
                    f"PDF {file_upload.filename} appears to be password-protected",
                    file_upload.id
                )
            elif "corrupt" in str(e).lower() or "invalid" in str(e).lower():
                raise PDFCorruptedError(
                    f"PDF {file_upload.filename} appears to be corrupted",
                    file_upload.id
                )
            else:
                raise PDFProcessingError(
                    f"pdfplumber extraction failed: {str(e)}",
                    file_upload.id
                )
    
    async def _extract_with_pypdf2(self, pdf_bytes: bytes, file_upload: FileUpload) -> str:
        """
        Extract text using PyPDF2 (fallback method).
        
        🎓 LEARNING: PyPDF2 Characteristics
        =================================
        PyPDF2 is a reliable fallback because:
        - Lightweight and fast
        - Good at basic text extraction
        - Handles most common PDF formats
        - Less complex than pdfplumber but more compatible
        """
        try:
            pdf_reader = PdfReader(io.BytesIO(pdf_bytes))
            
            # Check for password protection
            if pdf_reader.is_encrypted:
                raise PDFPasswordProtectedError(
                    f"PDF {file_upload.filename} is password-protected",
                    file_upload.id
                )
            
            # Check page count
            page_count = len(pdf_reader.pages)
            if page_count == 0:
                raise PDFNoTextError(
                    f"PDF {file_upload.filename} contains no pages",
                    file_upload.id
                )
            
            # Limit pages to process
            max_pages = min(page_count, self.config.pdf.max_pdf_pages)
            
            extracted_text_parts = []
            pages_with_text = 0
            
            for page_num in range(max_pages):
                page = pdf_reader.pages[page_num]
                page_text = page.extract_text()
                
                if page_text and page_text.strip():
                    extracted_text_parts.append(f"--- Page {page_num + 1} ---\n{page_text}")
                    pages_with_text += 1
                
                # Check if we've extracted too much text
                current_text = '\n\n'.join(extracted_text_parts)
                if len(current_text) > self.config.pdf.max_extracted_text:
                    self.logger.info(
                        f"Stopping PDF extraction at page {page_num + 1} "
                        f"due to size limit ({len(current_text)} chars)"
                    )
                    break
            
            if not extracted_text_parts:
                raise PDFNoTextError(
                    f"PDF {file_upload.filename} contains no extractable text",
                    file_upload.id
                )
            
            extracted_text = '\n\n'.join(extracted_text_parts)
            
            self.logger.info(
                f"PyPDF2 extracted {len(extracted_text)} chars from "
                f"{pages_with_text}/{page_count} pages of {file_upload.filename}"
            )
            
            return extracted_text
            
        except PDFProcessingError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            # Convert other errors to our format
            if "password" in str(e).lower() or "encrypted" in str(e).lower():
                raise PDFPasswordProtectedError(
                    f"PDF {file_upload.filename} appears to be password-protected",
                    file_upload.id
                )
            elif "corrupt" in str(e).lower() or "invalid" in str(e).lower():
                raise PDFCorruptedError(
                    f"PDF {file_upload.filename} appears to be corrupted",
                    file_upload.id
                )
            else:
                raise PDFProcessingError(
                    f"PyPDF2 extraction failed: {str(e)}",
                    file_upload.id
                )
    
    async def create_format_metadata(
        self, 
        file_upload: FileUpload, 
        extracted_content: str
    ) -> Dict[str, Any]:
        """Create PDF-specific metadata."""
        try:
            # Get basic PDF information
            pdf_bytes = await self._get_pdf_bytes(file_upload)
            
            metadata = {
                "format": "PDF",
                "extraction_library": "pdfplumber" if HAS_PDFPLUMBER else "PyPDF2",
                "extracted_text_length": len(extracted_content),
                "pages_processed": extracted_content.count("--- Page"),
            }
            
            # Try to get additional metadata from the PDF
            try:
                if HAS_PDFPLUMBER:
                    metadata.update(await self._get_pdfplumber_metadata(pdf_bytes))
                elif HAS_PYPDF2:
                    metadata.update(await self._get_pypdf2_metadata(pdf_bytes))
            except Exception as e:
                self.logger.warning(f"Could not extract PDF metadata: {e}")
                metadata["metadata_extraction_error"] = str(e)
            
            return metadata
            
        except Exception as e:
            self.logger.warning(f"Error creating PDF metadata: {e}")
            return {
                "format": "PDF",
                "metadata_error": str(e)
            }
    
    async def _get_pdfplumber_metadata(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """Get metadata using pdfplumber."""
        import pdfplumber
        
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            metadata = pdf.metadata or {}
            
            return {
                "total_pages": len(pdf.pages),
                "document_metadata": {
                    "title": metadata.get("Title", ""),
                    "author": metadata.get("Author", ""),
                    "creator": metadata.get("Creator", ""),
                    "producer": metadata.get("Producer", ""),
                    "creation_date": str(metadata.get("CreationDate", "")),
                    "modification_date": str(metadata.get("ModDate", ""))
                }
            }
    
    async def _get_pypdf2_metadata(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """Get metadata using PyPDF2."""
        pdf_reader = PdfReader(io.BytesIO(pdf_bytes))
        metadata = pdf_reader.metadata or {}
        
        return {
            "total_pages": len(pdf_reader.pages),
            "document_metadata": {
                "title": metadata.get("/Title", ""),
                "author": metadata.get("/Author", ""),
                "creator": metadata.get("/Creator", ""),
                "producer": metadata.get("/Producer", ""),
                "creation_date": str(metadata.get("/CreationDate", "")),
                "modification_date": str(metadata.get("/ModDate", ""))
            }
        }
