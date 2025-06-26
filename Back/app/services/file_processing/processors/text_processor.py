"""
Text file processor implementation.

This module handles plain text files with robust encoding detection,
content validation, and optimization for AI consumption.

🎓 LEARNING: Text Processing Challenges
=====================================
Text file processing involves:
- Encoding detection and conversion
- Handling different line endings
- Managing very large text files
- Preserving formatting while cleaning content
- Detecting and handling binary content
"""

import logging
from typing import Dict, Any, Optional, List
from pathlib import Path
import re

try:
    import chardet
    HAS_CHARDET = True
except ImportError:
    HAS_CHARDET = False

from .base_processor import BaseFileProcessor
from ..types import ContentType
from ..config import config
from ..exceptions import (
    TextProcessingError,
    EncodingError,
    ContentFormatError,
    UnsupportedFileTypeError
)
from ...models.file_upload import FileUpload

logger = logging.getLogger(__name__)


class TextProcessor(BaseFileProcessor):
    """
    Plain text file processor with intelligent encoding detection.
    
    🎓 LEARNING: Text Encoding Complexity
    ====================================
    Text files can be tricky because:
    - Various encodings (UTF-8, Latin-1, CP1252, etc.)
    - Different line ending styles (\\n, \\r\\n, \\r)
    - Mixed content (code, prose, data)
    - Large files requiring streaming processing
    - Binary content disguised as text
    """
    
    SUPPORTED_MIME_TYPES = {
        'text/plain',
        'text/markdown',
        'text/x-python',
        'text/javascript',
        'text/css',
        'text/html',
        'text/xml',
        'application/xml',
        'text/csv'  # Basic CSV as text
    }
    
    # Common text file extensions for additional validation
    TEXT_EXTENSIONS = {
        '.txt', '.md', '.markdown', '.py', '.js', '.css', '.html', '.htm',
        '.xml', '.csv', '.tsv', '.log', '.conf', '.cfg', '.ini', '.json',
        '.yaml', '.yml', '.sql', '.sh', '.bat', '.ps1', '.dockerfile',
        '.gitignore', '.readme', '.rst', '.tex'
    }
    
    def __init__(self):
        super().__init__()
        # Text processor doesn't require external dependencies
        pass
    
    def can_process(self, mime_type: str) -> bool:
        """Check if this processor can handle the given MIME type."""
        return mime_type in self.SUPPORTED_MIME_TYPES
    
    def get_content_type(self, mime_type: str) -> ContentType:
        """Get the appropriate ContentType for text files."""
        if mime_type in ['text/x-python', 'text/javascript', 'text/css']:
            return ContentType.CODE
        elif mime_type in ['text/html', 'text/xml', 'application/xml']:
            return ContentType.MARKUP
        elif mime_type in ['text/csv']:
            return ContentType.STRUCTURED_DATA
        else:
            return ContentType.PLAIN_TEXT
    
    def validate_format_specific(self, file_upload: FileUpload) -> None:
        """Text file-specific validation."""
        # Check file extension if available
        if hasattr(file_upload, 'file_extension') and file_upload.file_extension:
            ext = file_upload.file_extension.lower()
            if ext not in self.TEXT_EXTENSIONS and not ext.startswith('.'):
                self.logger.warning(
                    f"Unusual extension for text file: {file_upload.filename} ({ext})"
                )
    
    async def extract_content(self, file_upload: FileUpload) -> str:
        """
        Extract and clean text content from file.
        
        🎓 LEARNING: Robust Text Processing
        =================================
        Text processing workflow:
        1. Detect encoding with multiple strategies
        2. Read and decode content properly
        3. Normalize line endings and whitespace
        4. Validate that it's actually text (not binary)
        5. Clean and format for AI consumption
        6. Handle large files with smart truncation
        
        Args:
            file_upload: FileUpload model instance
            
        Returns:
            Clean, properly encoded text content
            
        Raises:
            TextProcessingError: If text extraction fails
        """
        try:
            # Get file content as bytes
            file_bytes = await self._get_file_bytes(file_upload)
            
            # Detect encoding
            encoding = await self._detect_encoding(file_bytes, file_upload.filename)
            
            # Decode to text
            text_content = await self._decode_content(file_bytes, encoding, file_upload)
            
            # Validate that it's actually text content
            await self._validate_text_content(text_content, file_upload)
            
            # Clean and normalize the content
            cleaned_content = await self._clean_text_content(text_content, file_upload)
            
            self.logger.info(
                f"Successfully processed text file {file_upload.filename}: "
                f"{len(cleaned_content)} chars, encoding: {encoding}"
            )
            
            return cleaned_content
            
        except TextProcessingError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error processing text file {file_upload.filename}: {e}")
            raise TextProcessingError(
                f"Failed to process text file: {str(e)}",
                file_upload.id
            )
    
    async def _get_file_bytes(self, file_upload: FileUpload) -> bytes:
        """Get file content as bytes."""
        if hasattr(file_upload, 'file_path') and file_upload.file_path:
            # File stored on disk
            file_path = Path(file_upload.file_path)
            if not file_path.exists():
                raise TextProcessingError(
                    f"Text file not found: {file_path}",
                    file_upload.id
                )
            return file_path.read_bytes()
        
        elif hasattr(file_upload, 'file_data') and file_upload.file_data:
            # File stored as binary data in database
            return file_upload.file_data
        
        elif hasattr(file_upload, 'text_content') and file_upload.text_content:
            # File already stored as text in database
            return file_upload.text_content.encode('utf-8')
        
        else:
            raise TextProcessingError(
                f"No accessible content for text file {file_upload.filename}",
                file_upload.id
            )
    
    async def _detect_encoding(self, file_bytes: bytes, filename: str) -> str:
        """
        Detect file encoding using multiple strategies.
        
        🎓 LEARNING: Encoding Detection Strategies
        ========================================
        Encoding detection is tricky. We use multiple approaches:
        1. chardet library (if available) for statistical detection
        2. Try UTF-8 first (most common for modern files)
        3. Fall back to common encodings based on confidence
        4. Use system locale encoding as last resort
        """
        # Strategy 1: Use chardet for statistical detection
        if HAS_CHARDET and len(file_bytes) > 0:
            try:
                detection = chardet.detect(file_bytes)
                if detection and detection.get('confidence', 0) > self.config.limits.encoding_confidence_threshold:
                    detected_encoding = detection['encoding']
                    self.logger.debug(
                        f"chardet detected {detected_encoding} with "
                        f"{detection['confidence']:.2f} confidence for {filename}"
                    )
                    return detected_encoding
            except Exception as e:
                self.logger.warning(f"chardet detection failed for {filename}: {e}")
        
        # Strategy 2: Try common encodings in order of preference
        encodings_to_try = ['utf-8'] + self.config.limits.fallback_encodings
        
        for encoding in encodings_to_try:
            try:
                # Try to decode a sample of the file
                sample_size = min(len(file_bytes), 1024)  # Check first 1KB
                file_bytes[:sample_size].decode(encoding)
                self.logger.debug(f"Successfully detected {encoding} for {filename}")
                return encoding
            except (UnicodeDecodeError, LookupError):
                continue
        
        # Strategy 3: If all else fails, use UTF-8 with error handling
        self.logger.warning(
            f"Could not reliably detect encoding for {filename}, "
            f"defaulting to UTF-8 with error replacement"
        )
        return 'utf-8'
    
    async def _decode_content(self, file_bytes: bytes, encoding: str, file_upload: FileUpload) -> str:
        """Decode bytes to text using the detected encoding."""
        try:
            # Try to decode with the detected encoding
            return file_bytes.decode(encoding)
        
        except UnicodeDecodeError as e:
            # If decoding fails, try with error handling
            self.logger.warning(
                f"Encoding {encoding} failed for {file_upload.filename}, "
                f"using error replacement: {e}"
            )
            try:
                return file_bytes.decode(encoding, errors='replace')
            except Exception:
                # Last resort: force UTF-8 with replacement
                return file_bytes.decode('utf-8', errors='replace')
        
        except LookupError as e:
            # Unknown encoding, fall back to UTF-8
            raise EncodingError(
                f"Unknown encoding '{encoding}' for file {file_upload.filename}",
                file_upload.id
            )
    
    async def _validate_text_content(self, content: str, file_upload: FileUpload) -> None:
        """
        Validate that the content is actually text (not binary disguised as text).
        
        🎓 LEARNING: Binary Content Detection
        ===================================
        Sometimes binary files get misidentified as text. We check for:
        - Excessive null bytes (common in binary files)
        - Very high percentage of control characters
        - Completely unprintable content
        """
        if not content:
            raise TextProcessingError(
                f"Text file {file_upload.filename} is empty or contains no readable content",
                file_upload.id
            )
        
        # Check for excessive null bytes (binary indicator)
        null_count = content.count('\\0')
        if null_count > len(content) * 0.01:  # More than 1% null bytes
            raise ContentFormatError(
                f"File {file_upload.filename} appears to contain binary content "
                f"({null_count} null bytes in {len(content)} characters)",
                file_upload.id
            )
        
        # Check for reasonable printable content
        printable_chars = sum(1 for c in content if c.isprintable() or c.isspace())
        printable_ratio = printable_chars / len(content) if content else 0
        
        if printable_ratio < 0.7:  # Less than 70% printable
            self.logger.warning(
                f"File {file_upload.filename} has low printable ratio: {printable_ratio:.2f}"
            )
            # Don't fail here, but log the warning
    
    async def _clean_text_content(self, content: str, file_upload: FileUpload) -> str:
        """
        Clean and normalize text content for optimal AI processing.
        
        🎓 LEARNING: Text Normalization for AI
        ====================================
        AI models work better with normalized text:
        1. Consistent line endings
        2. Reduced excessive whitespace
        3. Removal of problematic characters
        4. Preservation of meaningful structure
        """
        # Normalize line endings to \\n
        content = content.replace('\\r\\n', '\\n').replace('\\r', '\\n')
        
        # Remove excessive consecutive empty lines (keep max 2)
        content = re.sub(r'\\n{3,}', '\\n\\n', content)
        
        # Remove trailing whitespace from lines but preserve line structure
        lines = content.split('\\n')
        cleaned_lines = [line.rstrip() for line in lines]
        content = '\\n'.join(cleaned_lines)
        
        # Remove null bytes if any remain
        content = content.replace('\\0', '')
        
        # Remove or replace problematic Unicode characters
        # Replace various Unicode spaces with regular spaces
        content = re.sub(r'[\\u00A0\\u2000-\\u200B\\u202F\\u205F\\u3000]', ' ', content)
        
        # Replace smart quotes with regular quotes
        content = content.replace('"', '"').replace('"', '"')
        content = content.replace(''', "'").replace(''', "'")
        
        # Replace em/en dashes with regular hyphens for consistency
        content = content.replace('—', '-').replace('–', '-')
        
        # Remove or replace other problematic characters
        content = re.sub(r'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', content)
        
        # Collapse multiple consecutive spaces (but preserve intentional formatting)
        # Only collapse if there are more than 4 consecutive spaces
        content = re.sub(r' {4,}', '    ', content)  # Max 4 spaces
        
        # Strip leading and trailing whitespace from the entire content
        content = content.strip()
        
        if not content:
            raise TextProcessingError(
                f"Text file {file_upload.filename} contains no usable content after cleaning",
                file_upload.id
            )
        
        return content
    
    async def create_format_metadata(
        self, 
        file_upload: FileUpload, 
        extracted_content: str
    ) -> Dict[str, Any]:
        """Create text file-specific metadata."""
        try:
            # Analyze content structure
            lines = extracted_content.split('\\n')
            words = extracted_content.split()
            
            # Character distribution analysis
            char_counts = {}
            for char in extracted_content:
                if char.isalpha():
                    char_counts['letters'] = char_counts.get('letters', 0) + 1
                elif char.isdigit():
                    char_counts['digits'] = char_counts.get('digits', 0) + 1
                elif char.isspace():
                    char_counts['whitespace'] = char_counts.get('whitespace', 0) + 1
                else:
                    char_counts['punctuation'] = char_counts.get('punctuation', 0) + 1
            
            # Detect potential content type based on patterns
            content_hints = self._analyze_content_patterns(extracted_content)
            
            metadata = {
                "format": self._get_format_description(file_upload.mime_type),
                "encoding_detected": "UTF-8",  # We normalize to UTF-8
                "line_count": len(lines),
                "word_count": len(words),
                "character_distribution": char_counts,
                "average_line_length": sum(len(line) for line in lines) / len(lines) if lines else 0,
                "empty_lines": sum(1 for line in lines if not line.strip()),
                "content_type_hints": content_hints
            }
            
            # Add file extension info if available
            if hasattr(file_upload, 'file_extension') and file_upload.file_extension:
                metadata["file_extension"] = file_upload.file_extension
            
            return metadata
            
        except Exception as e:
            self.logger.warning(f"Error creating text metadata: {e}")
            return {
                "format": "Text File",
                "metadata_error": str(e)
            }
    
    def _get_format_description(self, mime_type: str) -> str:
        """Get human-readable format description."""
        format_map = {
            'text/plain': 'Plain Text',
            'text/markdown': 'Markdown Document',
            'text/x-python': 'Python Source Code',
            'text/javascript': 'JavaScript Code',
            'text/css': 'CSS Stylesheet',
            'text/html': 'HTML Document',
            'text/xml': 'XML Document',
            'application/xml': 'XML Document',
            'text/csv': 'CSV Data File'
        }
        return format_map.get(mime_type, 'Text File')
    
    def _analyze_content_patterns(self, content: str) -> List[str]:
        """Analyze content patterns to detect file type hints."""
        hints = []
        
        # Code patterns
        if re.search(r'\\b(def|class|import|function|var|const|let)\\b', content):
            hints.append("programming_code")
        
        # Markdown patterns
        if re.search(r'^#{1,6}\\s', content, re.MULTILINE) or '```' in content:
            hints.append("markdown")
        
        # CSV/data patterns
        if re.search(r'^[^,\\n]+,[^,\\n]+', content, re.MULTILINE):
            hints.append("csv_data")
        
        # JSON patterns
        if re.search(r'^\\s*[{\\[]', content.strip()) and re.search(r'[}\\]]\\s*$', content.strip()):
            hints.append("json_data")
        
        # Configuration patterns
        if re.search(r'^\\w+\\s*=\\s*', content, re.MULTILINE) or '[' in content and ']' in content:
            hints.append("configuration")
        
        # Log patterns
        if re.search(r'\\d{4}-\\d{2}-\\d{2}|ERROR|WARNING|INFO|DEBUG', content):
            hints.append("log_file")
        
        # Documentation patterns
        if len(content.split('\\n')) > 10 and re.search(r'\\b(the|and|or|of|to|in|for|with)\\b', content):
            hints.append("documentation")
        
        return hints
