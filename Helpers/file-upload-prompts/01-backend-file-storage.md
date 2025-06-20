# PROMPT 1: Backend File Storage & Upload Infrastructure

## Task Overview
Create the backend infrastructure for file uploads in the AI Dock project. This includes file storage, upload endpoints, and database models for file metadata.

## Project Context
- **Frontend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/`
- **Backend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/`
- **Current Status**: Full AI Dock platform with chat interface, user management, LLM integration
- **Next Step**: Add file upload capability starting with backend infrastructure

## Implementation Requirements

### 1. Create File Upload Model
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/models/file_upload.py`
- Fields: id, filename, original_filename, file_path, file_size, mime_type, user_id, upload_date, file_hash
- Relationships: Link to User model
- Add to: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/models/__init__.py`

### 2. Create File Upload Schemas
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/schemas/file_upload.py`
- Schemas: FileUploadResponse, FileUploadCreate, FileMetadata
- Validation: File size limits, allowed file types
- Add to: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/schemas/__init__.py`

### 3. Create File Storage Service
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_service.py`
- Functions: save_uploaded_file(), get_file_metadata(), delete_file(), validate_file()
- Storage location: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/uploads/`
- Security: File type validation, size limits, sanitization

### 4. Create File Upload API Endpoint
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/api/files.py`
- Endpoints: POST /files/upload, GET /files/{file_id}, DELETE /files/{file_id}
- Authentication: Require valid JWT token
- Upload limits: 10MB max file size initially

### 5. Update Main Application
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/main.py`
- Add: File upload router
- Add: Static file serving for uploaded files
- Configure: File upload middleware

### 6. Create Upload Directory
- Create: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/uploads/` directory
- Add: `.gitkeep` file to track directory
- Security: Proper permissions and access controls

## Technical Specifications

### File Storage Structure
```
/Back/uploads/
├── 2025/
│   ├── 06/
│   │   ├── 18/
│   │   │   ├── user_123_abc123def456_document.txt
│   │   │   └── user_456_def789ghi012_report.pdf
```

### Security Requirements
- File type validation (text files only for now)
- File size limits (10MB maximum)
- Filename sanitization
- User authentication required
- File access control (users can only access their files)

### Supported File Types (Phase 1)
- `.txt` - Plain text files
- `.md` - Markdown files
- `.csv` - Comma-separated values
- `.json` - JSON files

## Success Criteria
- [ ] File upload model created and integrated
- [ ] File upload API endpoints working
- [ ] File storage service functional
- [ ] Files saved securely with proper naming
- [ ] Authentication and authorization working
- [ ] File metadata stored in database
- [ ] Error handling for invalid files

## Testing
Create a test script: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/test_file_upload.py`
- Test file upload endpoint
- Test file retrieval
- Test file deletion
- Test security validations

## Expected Outcome
After this task, the backend will be ready to accept file uploads from the frontend, store them securely, and provide metadata for the chat interface integration.

---

**Note**: This is Phase 1 focusing only on backend infrastructure. Frontend integration comes in the next prompt.
