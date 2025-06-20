# PROMPT 2: Frontend File Upload UI Component

## Task Overview
Create the frontend file upload UI component that integrates with the existing chat interface. This adds drag-and-drop file upload capability to the message input area.

## Project Context
- **Frontend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/`
- **Backend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/` (already has file upload infrastructure)
- **Current Status**: Backend file upload ready, now adding frontend UI
- **Chat Interface**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/pages/ChatInterface.tsx`

## Implementation Requirements

### 1. Create File Upload Service
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/services/fileService.ts`
- Functions: uploadFile(), getFileMetadata(), deleteFile()
- Integration: Use existing authentication patterns from other services
- Error handling: File size, type validation, network errors

### 2. Create File Upload Types
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/types/file.ts`
- Interfaces: FileUpload, FileMetadata, UploadProgress, FileError
- Export: Add to `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/types/index.ts`

### 3. Create File Upload Component
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/chat/FileUpload.tsx`
- Features: Drag-and-drop zone, file selection button, upload progress
- Styling: Match existing blue glassmorphism theme
- Validation: File type and size validation on frontend

### 4. Create File Attachment Display
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/chat/FileAttachment.tsx`
- Features: File icon, name, size, download/remove buttons
- Types: Show different icons for different file types
- Actions: Remove before sending, download after upload

### 5. Update Message Input Component
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/chat/MessageInput.tsx`
- Add: File upload integration
- Add: Attached files display
- Add: File attachment in message sending
- Preserve: All existing functionality (streaming, cancel, etc.)

### 6. Update Chat Types
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/types/chat.ts`
- Add: File attachment fields to message types
- Update: Message sending interfaces
- Maintain: Backward compatibility with existing messages

## UI/UX Specifications

### File Upload Zone
```tsx
// Drag-and-drop area with glassmorphism styling
// Shows: "Drop files here or click to browse"
// Visual feedback during drag operations
// File type and size info
```

### File Attachment Display
```tsx
// Compact file cards showing:
// - File icon (📄 for text, 📊 for CSV, etc.)
// - Filename (truncated if long)
// - File size (KB/MB)
// - Remove button (❌)
// - Upload progress bar
```

### Integration with Message Input
```tsx
// File attachments appear above the text input
// Send button disabled during file uploads
// Clear attachments option
// Multiple file support
```

## Technical Specifications

### File Validation
- **Size limit**: 10MB per file
- **Type validation**: .txt, .md, .csv, .json
- **Count limit**: 5 files per message initially
- **Error display**: User-friendly validation messages

### Upload Progress
- Real-time progress bars
- Cancel upload capability
- Error states with retry options
- Success confirmation

### Accessibility
- Keyboard navigation support
- Screen reader compatibility
- ARIA labels for file operations
- Focus management

## Styling Requirements

### Theme Integration
- Use existing blue glassmorphism theme
- Match chat interface styling
- Responsive design (mobile-first)
- Smooth animations and transitions

### File Type Icons
```tsx
const fileIcons = {
  'text/plain': '📄',
  'text/markdown': '📝',
  'text/csv': '📊',
  'application/json': '🔧'
}
```

## Success Criteria
- [ ] File upload UI component created
- [ ] Drag-and-drop functionality working
- [ ] File validation on frontend
- [ ] Upload progress display
- [ ] File attachment display
- [ ] Integration with existing chat interface
- [ ] Mobile-responsive design
- [ ] Error handling and user feedback

## Testing Scenarios
1. **Basic Upload**: Select files via button click
2. **Drag & Drop**: Drag files into upload zone
3. **Validation**: Try invalid file types and sizes
4. **Multiple Files**: Upload several files at once
5. **Mobile**: Test touch interface on mobile
6. **Error Handling**: Test network errors and recovery

## Expected Outcome
After this task, users will be able to drag-and-drop or select files in the chat interface, see upload progress, and have files attached to their messages before sending.

---

**Note**: This is Phase 2 focusing on frontend UI. File processing and chat integration comes in the next prompt.
