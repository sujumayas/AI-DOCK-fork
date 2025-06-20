# PROMPT 5: Word Document Support & Processing

## Task Overview
Add support for Microsoft Word documents (.docx and .doc) to the file upload system, including text extraction, formatting preservation, and AI chat integration.

## Project Context
- **Frontend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/`
- **Backend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/`
- **Current Status**: Text and PDF files working, now adding Word document support
- **File Processor**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_processor.py`

## Implementation Requirements

### 1. Add Word Processing Dependencies
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/requirements.txt`
- Add: `python-docx==0.8.11` for .docx files
- Add: `python-docx2txt==0.8` for simple text extraction
- Alternative: `mammoth==1.6.0` for better HTML conversion
- Optional: `olefile==0.46` for legacy .doc support

### 2. Update File Processing Service
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_processor.py`
- Add: `process_docx_file()` function
- Add: `extract_docx_text()` function
- Add: `extract_docx_structure()` function
- Add: `get_docx_metadata()` function
- Handle: Headers, footers, tables, lists, formatting

### 3. Update File Validation
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_service.py`
- Add: Word MIME types (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- Add: Legacy .doc MIME type (`application/msword`)
- Update: File size limits (20MB for Word docs)
- Add: Word-specific validation and error handling

### 4. Update Frontend File Types
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/types/file.ts`
- Add: Word document interfaces
- Add: Document metadata types (word count, page count, author)
- Add: Document structure types (headings, tables, etc.)
- Update: File type validation and processing states

### 5. Update File Upload UI
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/chat/FileUpload.tsx`
- Add: .docx and .doc to accepted formats
- Add: Word-specific validation messages
- Update: File type icons (📘 for .docx, 📗 for .doc)
- Add: Document processing progress with structure info

### 6. Update File Attachment Display
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/chat/FileAttachment.tsx`
- Add: Word document metadata display
- Add: Document structure preview (headings, sections)
- Add: Word count and readability info
- Update: Document-specific styling and actions

## Word Document Processing Specifications

### Text Extraction with Structure
```python
from docx import Document
import docx2txt

def extract_docx_text(file_path: str) -> dict:
    """
    Extract text and structure from Word document
    Returns:
    {
        'text': 'full document text',
        'structured_content': [
            {'type': 'heading', 'level': 1, 'text': 'Introduction'},
            {'type': 'paragraph', 'text': 'Document content...'},
            {'type': 'table', 'data': [['Row1Col1', 'Row1Col2']]},
            {'type': 'list', 'items': ['Item 1', 'Item 2']}
        ],
        'metadata': {
            'title': 'Document Title',
            'author': 'Author Name',
            'word_count': 1250,
            'page_count': 5,
            'creation_date': '2025-06-18',
            'modification_date': '2025-06-18'
        },
        'statistics': {
            'paragraphs': 25,
            'sentences': 120,
            'characters': 8500
        }
    }
    """
```

### Advanced Content Processing
```python
def process_docx_file(file_path: str) -> dict:
    """
    Process Word document for LLM consumption
    - Extract text while preserving logical structure
    - Handle tables, lists, and formatting
    - Extract headers, footers, and footnotes
    - Preserve document hierarchy (headings, subheadings)
    - Handle embedded images (describe placement)
    """
```

### Document Structure Preservation
```python
def format_structured_content(structured_content: list) -> str:
    """
    Convert structured content to readable format for AI:
    
    # Heading 1
    
    Paragraph content here...
    
    ## Heading 2
    
    More content...
    
    **Table:**
    | Column 1 | Column 2 |
    |----------|----------|
    | Data 1   | Data 2   |
    
    **List:**
    - Item 1
    - Item 2
    """
```

## Frontend Integration

### Word Document File Types
```typescript
// Update file type support
const supportedFileTypes = {
  // ... existing types
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    icon: '📘',
    name: 'Word Document',
    maxSize: 20 * 1024 * 1024
  },
  'application/msword': {
    icon: '📗',
    name: 'Word Document (Legacy)',
    maxSize: 20 * 1024 * 1024
  }
};
```

### Document Processing UI
```tsx
// Word-specific processing feedback
const WordProcessingStatus = ({ document }: { document: WordDocument }) => (
  <div className="word-processing">
    <div className="progress">📘 Processing Word document...</div>
    <div className="details">
      Extracting text and structure from document
      <div className="stats">
        {document.pageCount} pages • {document.wordCount} words
      </div>
    </div>
  </div>
);
```

### Document Attachment Display
```tsx
// Enhanced Word document display
const WordAttachment = ({ file }: { file: WordFile }) => (
  <div className="word-attachment">
    <div className="word-icon">📘</div>
    <div className="word-info">
      <div className="filename">{file.name}</div>
      <div className="metadata">
        {file.wordCount} words • {file.pageCount} pages
      </div>
      <div className="structure-preview">
        {file.headings.slice(0, 3).map(heading => (
          <div key={heading.id} className={`heading-${heading.level}`}>
            {heading.text}
          </div>
        ))}
      </div>
      <div className="actions">
        <button>Preview Structure</button>
        <button>Download Document</button>
      </div>
    </div>
  </div>
);
```

## Error Handling

### Word-Specific Error Handling
```python
class WordProcessingError(Exception):
    """Custom exception for Word processing issues"""
    pass

# Handle common Word document issues:
# - Password-protected documents
# - Corrupted Word files
# - Unsupported Word formats
# - Documents with macros/embedded content
# - Very large documents with complex formatting
```

### User-Friendly Error Messages
```tsx
const wordErrorMessages = {
  'password_protected': 'This Word document is password-protected. Please provide an unlocked version.',
  'unsupported_format': 'This Word format is not supported. Please save as .docx format.',
  'corrupted': 'Word document appears to be corrupted. Please try uploading again.',
  'too_complex': 'Document structure is too complex to process. Please simplify formatting.',
  'macro_content': 'Document contains macros or embedded content that cannot be processed.',
  'processing_failed': 'Unable to process Word document. Please try a different file.'
};
```

## LLM Context Integration

### Structured Document Content for AI
```python
def format_word_for_llm(filename: str, extracted_data: dict) -> str:
    """
    Format Word document for AI with preserved structure:
    
    "User has attached a Word document: 'project_proposal.docx'
    Document metadata:
    - Title: Project Proposal 2025
    - Author: Project Team
    - Word count: 2,450
    - Pages: 8
    - Last modified: 2025-06-18
    
    Document structure and content:
    
    # Executive Summary
    [content here...]
    
    # Project Overview
    [content here...]
    
    ## Budget Analysis
    **Table: Budget Breakdown**
    | Category | Amount | Notes |
    |----------|---------|-------|
    | Personnel | $50,000 | Development team |
    | Equipment | $15,000 | Hardware costs |
    
    **Key Points:**
    - Timeline: 6 months
    - Team size: 5 people
    - Expected ROI: 150%
    
    Please analyze this document and respond to the user's message."
    """
```

## Advanced Features

### Document Analysis
```python
def analyze_document_content(extracted_data: dict) -> dict:
    """
    Provide intelligent document analysis:
    - Reading level assessment
    - Key topics identification
    - Document type classification (report, proposal, memo, etc.)
    - Important sections highlighting
    - Action items extraction
    """
```

### Formatting Preservation Options
```python
# Option 1: Plain text extraction (fastest)
def extract_plain_text(doc_path: str) -> str:
    return docx2txt.process(doc_path)

# Option 2: Structured extraction (recommended)
def extract_structured_content(doc_path: str) -> dict:
    # Full structure preservation with headings, tables, lists
    
# Option 3: HTML conversion (for complex formatting)
def extract_as_html(doc_path: str) -> str:
    # Convert to HTML for maximum formatting preservation
```

## Performance Considerations

### Document Processing Optimization
- **Streaming processing**: Handle large documents in chunks
- **Selective extraction**: Process only relevant sections for large docs
- **Caching**: Cache processed content for repeated access
- **Background processing**: Process documents asynchronously
- **Memory management**: Efficient handling of large documents

### Content Size Management
- **Smart truncation**: Preserve document structure while fitting size limits
- **Section prioritization**: Extract most important sections first
- **Summary generation**: Create intelligent summaries for very long documents
- **Progressive loading**: Load document sections on demand

## Success Criteria
- [ ] .docx and .doc files upload successfully
- [ ] Text extraction preserves document structure
- [ ] Tables, lists, and headings processed correctly
- [ ] Document metadata displayed accurately
- [ ] AI can understand and respond to document content
- [ ] Error handling for complex/problematic documents
- [ ] Performance optimized for large documents
- [ ] Document attachments saved with full structure

## Testing Scenarios

### Basic Word Processing
1. Upload simple .docx with text and headings
2. Ask AI: "What are the main points in this document?"
3. Verify AI understands document structure

### Complex Document Handling
1. Upload document with tables and lists
2. Upload document with complex formatting
3. Upload very large document (100+ pages)
4. Upload password-protected document

### Structure Preservation Testing
1. Upload document with multiple heading levels
2. Upload document with embedded tables
3. Upload document with numbered/bulleted lists
4. Verify structure is preserved in AI responses

### Error Handling Testing
1. Upload corrupted Word file
2. Upload unsupported Word format
3. Upload document with macros
4. Test processing timeout on complex documents

## Expected Outcome
After this task, users will be able to upload Word documents to chat messages, and the AI will extract structured content including headings, tables, and lists to provide intelligent analysis and responses about the document content.

---

**Note**: This is Phase 5 focusing on Word document support. The file upload system will now support text files, PDFs, and Word documents comprehensively.
