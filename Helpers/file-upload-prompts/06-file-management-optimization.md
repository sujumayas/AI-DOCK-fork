# PROMPT 6: File Management & System Optimization

## Task Overview
Complete the file upload system with advanced file management features, performance optimization, admin controls, and comprehensive file lifecycle management.

## Project Context
- **Frontend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/`
- **Backend**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/`
- **Current Status**: Full file upload working (text, PDF, Word), now adding management and optimization
- **Admin Panel**: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/pages/AdminSettings.tsx`

## Implementation Requirements

### 1. Create File Management Service
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_management_service.py`
- Functions: cleanup_old_files(), get_storage_stats(), compress_files()
- Features: Automatic cleanup, storage monitoring, file optimization
- Scheduling: Background tasks for maintenance

### 2. Create Admin File Management API
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/api/admin/files.py`
- Endpoints: GET /admin/files, DELETE /admin/files/{id}, POST /admin/files/cleanup
- Features: File listing, bulk operations, storage analytics
- Permissions: Admin-only file management

### 3. Create File Analytics Models
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/models/file_analytics.py`
- Track: Upload frequency, file types, storage usage, processing times
- Relationships: Link to users, departments, usage patterns
- Metrics: Performance monitoring and optimization insights

### 4. Create Admin File Management UI
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/admin/FileManagement.tsx`
- Features: File browser, storage analytics, cleanup controls
- UI: File grid, search/filter, bulk actions
- Integration: Add tab to AdminSettings.tsx

### 5. Create File Performance Optimization
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/file_optimization.py`
- Features: File compression, duplicate detection, cache management
- Processing: Optimize file storage and retrieval performance
- Background: Async optimization tasks

### 6. Update File Upload with Advanced Features
- File: `/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/src/components/chat/FileUpload.tsx`
- Add: File preview functionality
- Add: Drag-and-drop multiple files
- Add: Upload queue management
- Add: Retry mechanism for failed uploads

## File Management Specifications

### Storage Analytics
```python
def get_storage_analytics() -> dict:
    """
    Comprehensive storage statistics:
    {
        'total_files': 1250,
        'total_size_mb': 2450.5,
        'by_type': {
            'text': {'count': 400, 'size_mb': 125.0},
            'pdf': {'count': 500, 'size_mb': 1800.0},
            'docx': {'count': 350, 'size_mb': 525.5}
        },
        'by_user': [
            {'user_id': 1, 'username': 'john', 'file_count': 45, 'size_mb': 125.0},
            {'user_id': 2, 'username': 'jane', 'file_count': 67, 'size_mb': 200.5}
        ],
        'by_department': [
            {'dept': 'Engineering', 'file_count': 500, 'size_mb': 1200.0},
            {'dept': 'Marketing', 'file_count': 300, 'size_mb': 600.0}
        ],
        'upload_trends': {
            'daily_uploads': [12, 8, 15, 22, 18, 9, 5],  # Last 7 days
            'popular_types': ['pdf', 'docx', 'txt']
        }
    }
    """
```

### File Cleanup Policies
```python
def cleanup_old_files(policy: dict) -> dict:
    """
    Clean up files based on policies:
    - Delete files older than X days
    - Remove orphaned files (no conversation reference)
    - Clean up duplicate files
    - Remove temporary/failed uploads
    
    Returns cleanup summary with files removed and space freed
    """
```

### File Optimization
```python
def optimize_file_storage() -> dict:
    """
    Optimize file storage:
    - Compress large text files
    - Detect and remove duplicates
    - Archive old files to cold storage
    - Optimize file organization structure
    """
```

## Admin Interface Specifications

### File Management Dashboard
```tsx
const FileManagementDashboard = () => (
  <div className="file-management">
    {/* Storage Overview */}
    <div className="storage-overview">
      <div className="stat-card">
        <h3>Total Storage</h3>
        <div className="size">2.4 GB</div>
        <div className="files">1,250 files</div>
      </div>
      <div className="usage-chart">
        {/* Storage usage by type/department */}
      </div>
    </div>
    
    {/* File Browser */}
    <div className="file-browser">
      <div className="controls">
        <input placeholder="Search files..." />
        <select>Filter by type</select>
        <button>Bulk Actions</button>
      </div>
      <div className="file-grid">
        {/* File cards with preview, metadata, actions */}
      </div>
    </div>
    
    {/* Cleanup Tools */}
    <div className="cleanup-tools">
      <button>Clean Old Files</button>
      <button>Remove Duplicates</button>
      <button>Optimize Storage</button>
    </div>
  </div>
);
```

### File Analytics
```tsx
const FileAnalytics = () => (
  <div className="file-analytics">
    <div className="charts">
      <div className="upload-trends">
        {/* Line chart of uploads over time */}
      </div>
      <div className="type-distribution">
        {/* Pie chart of file types */}
      </div>
      <div className="department-usage">
        {/* Bar chart of usage by department */}
      </div>
    </div>
    
    <div className="performance-metrics">
      <div className="processing-times">
        Avg processing time: 2.3s
      </div>
      <div className="error-rates">
        Upload success rate: 98.5%
      </div>
    </div>
  </div>
);
```

## Performance Optimization

### File Processing Performance
```python
# Async file processing with queue
import asyncio
from celery import Celery

app = Celery('file_processor')

@app.task
async def process_file_async(file_id: str):
    """
    Process files in background:
    - Text extraction
    - Content indexing
    - Thumbnail generation
    - Optimization
    """
```

### Caching Strategy
```python
# Cache frequently accessed files
from functools import lru_cache
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)

@lru_cache(maxsize=100)
def get_processed_file_content(file_id: str) -> str:
    """Cache processed file content for quick access"""
```

### File Storage Optimization
```python
# Intelligent file storage
def organize_file_storage(file: FileUpload) -> str:
    """
    Organize files by:
    - Date hierarchy (2025/06/18/)
    - User ID
    - File type
    - Department (optional)
    
    Example: /uploads/2025/06/18/user_123/pdf/document_abc123.pdf
    """
```

## Advanced Features

### File Preview System
```tsx
// File preview modal
const FilePreviewModal = ({ file }: { file: UploadedFile }) => {
  const [preview, setPreview] = useState<string>('');
  
  useEffect(() => {
    // Generate preview based on file type
    switch (file.type) {
      case 'text/plain':
        // Show first 500 characters
        break;
      case 'application/pdf':
        // Show first page as text
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // Show document structure
        break;
    }
  }, [file]);
  
  return (
    <div className="file-preview-modal">
      <div className="preview-content">
        {preview}
      </div>
    </div>
  );
};
```

### File Sharing & Collaboration
```python
# File sharing between users
def share_file(file_id: str, user_id: str, shared_with: list[str]) -> dict:
    """
    Share files between users:
    - Permission-based sharing
    - Department-level sharing
    - Time-limited access
    - Audit trail
    """
```

### File Versioning
```python
# File version management
def create_file_version(original_file_id: str, new_file_path: str) -> dict:
    """
    Handle file versions:
    - Track file updates
    - Maintain version history
    - Allow version rollback
    - Show version differences
    """
```

## Security & Compliance

### File Security Scanning
```python
def scan_file_security(file_path: str) -> dict:
    """
    Security scanning:
    - Virus/malware detection
    - Content scanning for sensitive data
    - File structure validation
    - Metadata analysis
    """
```

### Compliance & Audit
```python
def audit_file_access(file_id: str, user_id: str, action: str):
    """
    Audit file operations:
    - File uploads/downloads
    - Access attempts
    - Sharing activities
    - Deletion events
    """
```

### Data Retention Policies
```python
def apply_retention_policies():
    """
    Apply data retention:
    - Automatic file expiration
    - Legal hold management
    - Compliance reporting
    - Secure deletion
    """
```

## Success Criteria
- [ ] Admin file management interface complete
- [ ] File analytics and storage monitoring working
- [ ] Automatic cleanup and optimization running
- [ ] File preview system functional
- [ ] Performance optimized for large file volumes
- [ ] Security scanning and compliance features active
- [ ] File sharing and collaboration features available
- [ ] Comprehensive audit trail implemented

## Testing Scenarios

### Admin File Management
1. Upload 100+ files across different types
2. Use admin panel to browse and search files
3. Test bulk cleanup operations
4. Verify storage analytics accuracy

### Performance Testing
1. Upload multiple large files simultaneously
2. Test file processing queue performance
3. Verify caching improves response times
4. Test system under high file upload load

### Security Testing
1. Upload potentially malicious files
2. Test file access permissions
3. Verify audit trail captures all actions
4. Test file sharing security controls

### Optimization Testing
1. Run storage optimization tools
2. Test duplicate file detection
3. Verify automatic cleanup policies
4. Test file compression effectiveness

## Expected Outcome
After this task, the AI Dock platform will have a complete, enterprise-grade file upload and management system with:
- Support for text, PDF, and Word documents
- Advanced admin management tools
- Performance optimization and caching
- Security scanning and compliance features
- Comprehensive analytics and monitoring
- Automated maintenance and cleanup

---

**Note**: This completes the file upload system implementation. The platform now has full file support integrated with the AI chat interface.
