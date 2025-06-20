# PROMPT 3: Text File Processing & Chat Integration

## Task Overview
Integrate uploaded text files with the chat interface so users can send files along with messages to the AI, and the AI can read and respond to file contents.

## Project Context
- **Frontend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/`
- **Backend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/`
- **Current Status**: File upload UI working, now adding file processing and chat integration
- **Chat Service**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/services/chatService.ts`

## Implementation Requirements

### 1. Create File Processing Service
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_processor.py`
- Functions: process_text_file(), extract_content(), validate_content()
- Support: .txt, .md, .csv, .json files
- Safety: Content validation, encoding detection

### 2. Update Chat API for File Support
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/api/chat.py`
- Update: sendMessage endpoint to accept file attachments
- Add: File content processing before LLM call
- Maintain: All existing functionality (streaming, quotas, etc.)

### 3. Create File Content Schemas
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/schemas/chat.py` (update existing)
- Add: FileAttachment schema to ChatMessage
- Add: ProcessedFileContent schema
- Update: Message sending request/response schemas

### 4. Update Chat Message Model
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/models/conversation.py` (update existing)
- Add: file_attachments JSON field to ConversationMessage
- Add: Helper methods for file attachment handling
- Maintain: Backward compatibility

### 5. Update Frontend Chat Service
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/services/chatService.ts`
- Update: sendMessage() to include file attachments
- Add: File content preview functionality
- Maintain: Streaming and existing chat features

### 6. Update Message Display
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/chat/MessageList.tsx`
- Add: File attachment display in messages
- Add: File content preview/download options
- Styling: Integrate with existing message bubbles

## File Processing Specifications

### Text File Processing
```python
# Process different text file types
def process_text_file(file_path: str, mime_type: str) -> dict:
    """
    - .txt: Read as plain text
    - .md: Read as markdown, preserve formatting
    - .csv: Parse structure, show preview
    - .json: Parse and validate structure
    """
```

### Content Integration with LLM
```python
# Format file content for LLM context
def format_file_for_llm(filename: str, content: str, file_type: str) -> str:
    """
    Create clear context for AI:
    
    "User has attached a file: 'document.txt'
    File content:
    ---
    [file content here]
    ---
    
    Please analyze this file and respond to the user's message."
    """
```

### File Content Limits
- **Max content size**: 50KB per file for LLM processing
- **Truncation**: Show first/last portions if too long
- **Encoding**: UTF-8 with fallback detection
- **Sanitization**: Remove potentially harmful content

## Chat Integration Specifications

### Message with File Attachments
```typescript
interface ChatMessageWithFiles {
  content: string;           // User's text message
  fileAttachments: {
    fileId: string;
    filename: string;
    fileSize: number;
    contentPreview: string;  // First 200 chars
    processed: boolean;      // Whether AI can read it
  }[];
}
```

### LLM Context Building
```python
# Combine user message + file content
def build_llm_context(user_message: str, file_contents: list) -> str:
    """
    Format: 
    1. User message
    2. File contents with clear separators
    3. Instructions for AI on how to respond
    """
```

### File Display in Messages
```tsx
// In message bubbles, show:
// 📎 document.txt (2.3 KB) [View] [Download]
// 📊 data.csv (15.7 KB) [Preview] [Download]
// 📝 notes.md (5.1 KB) [View] [Download]
```

## Security & Validation

### Content Validation
- **Text encoding**: Validate UTF-8, handle other encodings
- **Content safety**: Basic scanning for malicious content
- **Size limits**: Prevent extremely large files from being processed
- **Rate limiting**: Limit file processing per user

### User Experience
- **Loading states**: Show processing during file analysis
- **Error handling**: Clear messages for unsupported files
- **Progress feedback**: File upload → processing → ready to send
- **File preview**: Show content preview before sending

## Success Criteria
- [ ] Text files (.txt, .md, .csv, .json) processed correctly
- [ ] File content integrated into LLM context
- [ ] Messages with files display properly
- [ ] AI can read and respond to file contents
- [ ] File attachments saved in conversation history
- [ ] Error handling for unsupported files
- [ ] Performance optimized for file processing
- [ ] Quota system includes file processing

## Testing Scenarios

### Basic File Chat
1. Upload a .txt file with project requirements
2. Ask AI: "Summarize this document"
3. Verify AI reads file content and provides summary

### Multiple File Types
1. Upload .csv with data
2. Ask AI: "What insights can you find in this data?"
3. Upload .md file with notes
4. Ask AI: "Compare the CSV data with these notes"

### Error Handling
1. Upload extremely large file (>50KB)
2. Upload corrupted text file
3. Upload file with special characters
4. Test network errors during processing

## Expected Outcome
After this task, users will be able to upload text files to chat messages, and the AI will read and respond to the file contents along with the user's message. All existing chat functionality (streaming, quotas, conversations) will work with file attachments.

---

**Note**: This is Phase 3 focusing on text file processing. PDF and Word doc support comes in later prompts.
