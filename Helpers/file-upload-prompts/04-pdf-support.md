# PROMPT 4: PDF File Support & Processing

## Task Overview
Extend the file upload system to support PDF files, including text extraction, content processing, and integration with the AI chat interface.

## Project Context
- **Frontend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/`
- **Backend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/`
- **Current Status**: Text file upload working, now adding PDF support
- **File Processor**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_processor.py`

## Implementation Requirements

### 1. Add PDF Processing Dependencies
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/requirements.txt`
- Add: `PyPDF2==3.0.1` for PDF text extraction
- Add: `python-magic==0.4.27` for file type detection
- Alternative: `pdfplumber==0.9.0` for better text extraction

### 2. Update File Processing Service
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_processor.py`
- Add: `process_pdf_file()` function
- Add: `extract_pdf_text()` function
- Add: `get_pdf_metadata()` function
- Handle: Multi-page PDFs, password-protected PDFs

### 3. Update File Validation
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_service.py`
- Add: PDF MIME type validation (`application/pdf`)
- Add: PDF file structure validation
- Update: File size limits (increase to 25MB for PDFs)
- Add: PDF-specific error handling

### 4. Update Frontend File Types
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/types/file.ts`
- Add: PDF-specific interfaces
- Add: PDF metadata types (page count, author, title)
- Update: File type enums and validation

### 5. Update File Upload UI
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/chat/FileUpload.tsx`
- Add: PDF file type to accepted formats
- Add: PDF-specific validation messages
- Update: File type icons (📕 for PDF)
- Add: PDF processing progress indicator

### 6. Update File Attachment Display
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/chat/FileAttachment.tsx`
- Add: PDF metadata display (page count, file info)
- Add: PDF preview capability (first page or text excerpt)
- Add: PDF-specific download options
- Update: File type styling and icons

## PDF Processing Specifications

### Text Extraction
```python
import PyPDF2
from io import BytesIO

def extract_pdf_text(file_path: str) -> dict:
    """
    Extract text from PDF file
    Returns:
    {
        'text': 'extracted text content',
        'page_count': 5,
        'metadata': {
            'title': 'Document Title',
            'author': 'Author Name',
            'creation_date': '2025-06-18'
        },
        'pages': [
            {'page_num': 1, 'text': 'page 1 content...'},
            {'page_num': 2, 'text': 'page 2 content...'}
        ]
    }
    """
```

### Content Processing
```python
def process_pdf_file(file_path: str) -> dict:
    """
    Process PDF for LLM consumption
    - Extract text from all pages
    - Handle large documents (>50KB text limit)
    - Create intelligent summaries for long documents
    - Preserve document structure where possible
    """
```

### PDF Content Limits
- **Max file size**: 25MB PDF file
- **Max text extraction**: 100KB extracted text
- **Page limit**: Process up to 50 pages
- **Truncation strategy**: Smart content sampling from beginning, middle, end

## Frontend Integration

### PDF File Type Support
```typescript
// Update file type validation
const supportedFileTypes = {
  'text/plain': { icon: '📄', maxSize: 10 * 1024 * 1024 },
  'text/markdown': { icon: '📝', maxSize: 10 * 1024 * 1024 },
  'text/csv': { icon: '📊', maxSize: 10 * 1024 * 1024 },
  'application/json': { icon: '🔧', maxSize: 10 * 1024 * 1024 },
  'application/pdf': { icon: '📕', maxSize: 25 * 1024 * 1024 }  // NEW
};
```

### PDF Upload Experience
```tsx
// PDF-specific upload feedback
const PDFUploadStatus = () => (
  <div className="pdf-processing">
    <div className="progress">📕 Processing PDF...</div>
    <div className="details">
      Extracting text from {pageCount} pages
    </div>
  </div>
);
```

### PDF Message Display
```tsx
// In chat messages, show PDF info
const PDFAttachment = ({ file }: { file: PDFFile }) => (
  <div className="pdf-attachment">
    <div className="pdf-icon">📕</div>
    <div className="pdf-info">
      <div className="filename">{file.name}</div>
      <div className="metadata">{file.pageCount} pages • {file.size}</div>
      <div className="actions">
        <button>Preview Text</button>
        <button>Download PDF</button>
      </div>
    </div>
  </div>
);
```

## Error Handling

### PDF-Specific Errors
```python
class PDFProcessingError(Exception):
    """Custom exception for PDF processing issues"""
    pass

# Handle common PDF issues:
# - Password-protected PDFs
# - Corrupted PDF files
# - PDFs with no extractable text (images only)
# - PDFs with unusual encoding
# - Very large PDFs
```

### User-Friendly Error Messages
```tsx
const pdfErrorMessages = {
  'password_protected': 'This PDF is password-protected. Please provide an unlocked version.',
  'no_text': 'This PDF appears to contain only images. Text extraction is not possible.',
  'too_large': 'PDF file is too large. Please use files smaller than 25MB.',
  'corrupted': 'PDF file appears to be corrupted. Please try uploading again.',
  'processing_failed': 'Unable to process PDF. Please try a different file.'
};
```

## LLM Context Integration

### PDF Content in LLM Context
```python
def format_pdf_for_llm(filename: str, extracted_data: dict) -> str:
    """
    Format PDF content for AI consumption:
    
    "User has attached a PDF: 'report.pdf' (15 pages)
    Document metadata:
    - Title: Quarterly Report Q2 2025
    - Author: Finance Team
    - Pages: 15
    
    Extracted content (first 10,000 characters):
    ---
    [extracted text here, intelligently truncated]
    ---
    
    [Additional context about document structure, if relevant]
    
    Please analyze this document and respond to the user's message."
    """
```

## Security Considerations

### PDF Security
- **File validation**: Verify PDF structure and headers
- **Content scanning**: Basic security scan of extracted text
- **Resource limits**: Prevent excessive memory usage during processing
- **Timeout handling**: Limit processing time for complex PDFs

### Performance Optimization
- **Async processing**: Process PDFs in background
- **Caching**: Cache extracted text for repeated access
- **Streaming**: Process large PDFs in chunks
- **Progress feedback**: Real-time processing updates

## Success Criteria
- [ ] PDF files upload successfully
- [ ] Text extraction from PDFs works
- [ ] PDF metadata displayed properly
- [ ] AI can read and respond to PDF content
- [ ] Error handling for problematic PDFs
- [ ] Performance optimized for large PDFs
- [ ] PDF attachments saved in conversation history
- [ ] Mobile-friendly PDF upload experience

## Testing Scenarios

### Basic PDF Processing
1. Upload simple text PDF (5 pages)
2. Ask AI: "Summarize this document"
3. Verify AI reads PDF content correctly

### Complex PDF Handling
1. Upload large PDF (20+ pages)
2. Upload PDF with images and text
3. Upload password-protected PDF (should error gracefully)
4. Upload corrupted PDF file

### Performance Testing
1. Upload multiple PDFs simultaneously
2. Upload maximum size PDF (25MB)
3. Test processing timeout handling
4. Verify memory usage during processing

## Expected Outcome
After this task, users will be able to upload PDF files to chat messages, and the AI will extract and read the text content to provide intelligent responses about the document content.

---

**Note**: This is Phase 4 focusing on PDF support. Word document support comes in the next prompt.
