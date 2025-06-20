// 📁 File Upload Service
// Handles file uploads, metadata retrieval, and file management
// Integrates with existing authentication and follows established patterns

import { 
  FileUpload, 
  FileMetadata, 
  FileError, 
  FileUploadError,
  UploadProgress,
  FileUploadStatus,
  FileErrorType,
  validateFile,
  formatFileSize,
  generateFileId,
  createFileUpload,
  MAX_FILE_SIZE,
  UPLOAD_TIMEOUT,
  CHUNK_TIMEOUT,
  RETRY_DELAYS
} from '../types/file';
import { authService } from './authService';

// Configuration - using same base URL as other services
const API_BASE_URL = 'http://localhost:8000';

/**
 * 🎓 LEARNING: File upload progress callback
 * This allows us to track upload progress in real-time and update the UI
 */
export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * 🎓 LEARNING: File upload completion callback  
 * Called when upload finishes successfully or fails
 */
export type UploadCompleteCallback = (
  result: FileUpload | FileError
) => void;

/**
 * Response from the backend when a file is successfully uploaded
 * 🔧 FIXED: Updated to match actual backend FileUploadResponse schema
 */
interface FileUploadResponse {
  id: number;                // Server-assigned unique file ID (integer from backend)
  original_filename: string; // Original filename
  filename: string;          // System filename
  file_size: number;         // File size in bytes
  file_size_human: string;   // Human-readable file size
  mime_type: string;         // MIME type detected by server
  file_extension?: string;   // File extension
  upload_status: string;     // Upload status
  upload_date: string;       // When upload completed (ISO format)
  file_hash: string;         // SHA-256 hash for integrity
  access_count: number;      // Number of times accessed
  
  // Content analysis (populated after processing)
  encoding?: string;         // File encoding (e.g., 'utf-8')
  line_count?: number;       // For text files
  character_count?: number;  // For text files
  preview_content?: string;  // First few lines for preview
  
  // Security scanning results
  is_safe: boolean;          // Passed security scan
  scan_timestamp?: string;   // When security scan completed
  processing_complete: boolean; // Whether content processing is done
}

/**
 * Request format for file uploads
 */
interface FileUploadRequest {
  file: File;                // The file to upload
  description?: string;      // Optional user description
  tags?: string[];           // Optional tags for organization
}

class FileService {
  
  // Track active uploads for cancellation and progress
  private activeUploads = new Map<string, AbortController>();
  
  /**
   * 📤 UPLOAD FILE: Main function to upload a file to the server
   * 🎓 LEARNING: This uses FormData for file uploads and XMLHttpRequest for progress tracking
   */
  async uploadFile(
    fileUpload: FileUpload,
    onProgress?: UploadProgressCallback,
    onComplete?: UploadCompleteCallback
  ): Promise<FileUpload> {
    try {
      console.log('📤 Starting file upload:', {
        fileId: fileUpload.id,
        fileName: fileUpload.file.name,
        fileSize: formatFileSize(fileUpload.file.size),
        endpoint: `${API_BASE_URL}/files/upload`
      });

      // Validate file before upload
      const validationErrors = validateFile(fileUpload.file);
      if (validationErrors.length > 0) {
        const error: FileError = {
          type: 'VALIDATION_ERROR',
          code: 'FILE_VALIDATION_FAILED',
          message: validationErrors.join('; '),
          fileId: fileUpload.id,
          fileName: fileUpload.file.name,
          timestamp: new Date(),
          isRetryable: false,
          userAction: 'Please select a different file that meets the requirements'
        };
        
        if (onComplete) onComplete(error);
        throw new FileUploadError(error.message, error.type, undefined, error.fileId);
      }

      // Update upload status
      fileUpload.status = 'uploading';
      fileUpload.startedAt = new Date();

      // Create AbortController for cancellation support
      const abortController = new AbortController();
      this.activeUploads.set(fileUpload.id, abortController);

      // 🎓 LEARNING: We use XMLHttpRequest instead of fetch for upload progress
      // fetch() doesn't support upload progress tracking yet
      const uploadResult = await this.performFileUpload(
        fileUpload,
        abortController.signal,
        onProgress
      );

      // Update file upload with server response
      fileUpload.status = 'completed';
      fileUpload.completedAt = new Date();
      // 🔧 FIXED: Backend returns 'id' field, not 'file_id'
      fileUpload.uploadedFileId = uploadResult.id.toString(); // Convert to string for consistency
      
      // 🔧 DEBUG: Log the file ID assignment for debugging
      console.log('✅ File upload completed with ID assignment:', {
        fileId: fileUpload.id,
        serverResponse: uploadResult,
        assignedUploadedFileId: fileUpload.uploadedFileId,
        serverIdType: typeof uploadResult.id
      });
      // 🔧 Note: serverPath and downloadUrl are not provided by backend in Phase 1
      // They would be constructed from file ID when needed
      
      // Update metadata with server information
      if (fileUpload.metadata) {
        fileUpload.metadata.encoding = uploadResult.encoding;
        fileUpload.metadata.lineCount = uploadResult.line_count;
        fileUpload.metadata.characterCount = uploadResult.character_count;
        fileUpload.metadata.previewContent = uploadResult.preview_content;
        fileUpload.metadata.scannedAt = uploadResult.scan_timestamp ? new Date(uploadResult.scan_timestamp) : undefined;
        fileUpload.metadata.processedAt = uploadResult.processing_complete ? new Date() : undefined;
      }

      // Clean up tracking
      this.activeUploads.delete(fileUpload.id);

      console.log('✅ File upload completed:', {
        fileId: fileUpload.id,
        serverId: uploadResult.id,
        filename: uploadResult.original_filename,
        status: uploadResult.upload_status,
        size: uploadResult.file_size_human
      });

      if (onComplete) onComplete(fileUpload);
      return fileUpload;

    } catch (error) {
      console.error('❌ File upload failed:', error);

      // Clean up tracking
      this.activeUploads.delete(fileUpload.id);

      // Update upload status
      fileUpload.status = 'error';
      
      // Create structured error
      const fileError = this.createFileError(error, fileUpload.id, fileUpload.file.name);
      fileUpload.error = fileError;

      if (onComplete) onComplete(fileError);
      throw new FileUploadError(fileError.message, fileError.type, undefined, fileUpload.id);
    }
  }

  /**
   * 🌐 PERFORM FILE UPLOAD: XMLHttpRequest implementation for progress tracking
   * 🎓 LEARNING: This shows how to use XMLHttpRequest for modern file uploads with progress
   */
  private async performFileUpload(
    fileUpload: FileUpload,
    signal: AbortSignal,
    onProgress?: UploadProgressCallback
  ): Promise<FileUploadResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      // 🎓 LEARNING: Progress tracking for uploads
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const elapsedTime = (Date.now() - startTime) / 1000; // seconds
          const speed = elapsedTime > 0 ? event.loaded / elapsedTime : 0;
          const estimatedTimeRemaining = speed > 0 ? (event.total - event.loaded) / speed : Infinity;

          const progress: UploadProgress = {
            fileId: fileUpload.id,
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
            speed: Math.round(speed),
            estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
            elapsedTime: Math.round(elapsedTime),
            retriesAttempted: 0
          };

          onProgress(progress);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response: FileUploadResponse = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (parseError) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.detail || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      // Handle timeout
      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timed out'));
      });

      // Handle cancellation
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Upload was cancelled'));
      });

      // Prepare form data
      const formData = new FormData();
      formData.append('file', fileUpload.file);
      
      // Optional metadata
      if (fileUpload.metadata?.uploadedBy) {
        formData.append('uploaded_by', fileUpload.metadata.uploadedBy);
      }

      // Configure and send request
      xhr.timeout = UPLOAD_TIMEOUT;
      xhr.open('POST', `${API_BASE_URL}/files/upload`);
      
      // 🎓 LEARNING: Add authentication headers
      // XMLHttpRequest requires setting headers individually
      const authHeaders = authService.getAuthHeaders();
      Object.entries(authHeaders).forEach(([key, value]) => {
        if (key !== 'Content-Type') { // Let browser set Content-Type for FormData
          xhr.setRequestHeader(key, value as string);
        }
      });

      xhr.send(formData);
    });
  }

  /**
   * 🔍 GET FILE METADATA: Retrieve information about an uploaded file
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    try {
      console.log('🔍 Fetching file metadata:', fileId);

      const response = await fetch(`${API_BASE_URL}/files/${fileId}/metadata`, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new FileUploadError(
          errorData.detail || 'Failed to fetch file metadata',
          'SERVER_ERROR',
          response.status,
          fileId
        );
      }

      const metadata: FileMetadata = await response.json();
      
      console.log('✅ File metadata retrieved:', {
        fileId,
        name: metadata.name,
        size: formatFileSize(metadata.size),
        type: metadata.type
      });

      return metadata;

    } catch (error) {
      console.error('❌ Error fetching file metadata:', error);
      
      if (error instanceof FileUploadError) {
        throw error;
      }
      
      throw new FileUploadError(
        error instanceof Error ? error.message : 'Failed to fetch file metadata',
        'NETWORK_ERROR',
        undefined,
        fileId
      );
    }
  }

  /**
   * 🗑️ DELETE FILE: Remove a file from the server
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting file:', fileId);

      const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new FileUploadError(
          errorData.detail || 'Failed to delete file',
          'SERVER_ERROR',
          response.status,
          fileId
        );
      }

      console.log('✅ File deleted successfully:', fileId);

    } catch (error) {
      console.error('❌ Error deleting file:', error);
      
      if (error instanceof FileUploadError) {
        throw error;
      }
      
      throw new FileUploadError(
        error instanceof Error ? error.message : 'Failed to delete file',
        'NETWORK_ERROR',
        undefined,
        fileId
      );
    }
  }

  /**
   * 📥 DOWNLOAD FILE: Get download URL or fetch file content
   */
  async downloadFile(fileId: string, asBlob: boolean = true): Promise<string | Blob> {
    try {
      console.log('📥 Downloading file:', fileId);

      const response = await fetch(`${API_BASE_URL}/files/${fileId}/download`, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new FileUploadError(
          errorData.detail || 'Failed to download file',
          'SERVER_ERROR',
          response.status,
          fileId
        );
      }

      if (asBlob) {
        const blob = await response.blob();
        console.log('✅ File downloaded as blob:', {
          fileId,
          size: formatFileSize(blob.size),
          type: blob.type
        });
        return blob;
      } else {
        const text = await response.text();
        console.log('✅ File downloaded as text:', {
          fileId,
          length: text.length
        });
        return text;
      }

    } catch (error) {
      console.error('❌ Error downloading file:', error);
      
      if (error instanceof FileUploadError) {
        throw error;
      }
      
      throw new FileUploadError(
        error instanceof Error ? error.message : 'Failed to download file',
        'NETWORK_ERROR',
        undefined,
        fileId
      );
    }
  }

  /**
   * ⛔ CANCEL UPLOAD: Cancel an active file upload
   */
  cancelUpload(fileId: string): boolean {
    const controller = this.activeUploads.get(fileId);
    if (controller) {
      console.log('⛔ Cancelling upload:', fileId);
      controller.abort();
      this.activeUploads.delete(fileId);
      return true;
    }
    return false;
  }

  /**
   * 📊 GET UPLOAD STATUS: Check if a file is currently being uploaded
   */
  isUploading(fileId: string): boolean {
    return this.activeUploads.has(fileId);
  }

  /**
   * 📋 LIST USER FILES: Get list of files uploaded by current user
   */
  async listUserFiles(limit: number = 50, offset: number = 0): Promise<{
    files: FileMetadata[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      console.log('📋 Fetching user files:', { limit, offset });

      const response = await fetch(
        `${API_BASE_URL}/files/list?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: authService.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new FileUploadError(
          errorData.detail || 'Failed to fetch file list',
          'SERVER_ERROR',
          response.status
        );
      }

      const result = await response.json();
      
      console.log('✅ User files retrieved:', {
        count: result.files.length,
        total: result.total,
        hasMore: result.hasMore
      });

      return result;

    } catch (error) {
      console.error('❌ Error fetching user files:', error);
      
      if (error instanceof FileUploadError) {
        throw error;
      }
      
      throw new FileUploadError(
        error instanceof Error ? error.message : 'Failed to fetch file list',
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * 🏥 HEALTH CHECK: Verify file service is working
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/files/health`, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('File service health check failed');
      }

      return await response.json();
      
    } catch (error) {
      console.error('❌ File service health check failed:', error);
      throw new FileUploadError(
        error instanceof Error ? error.message : 'File service health check failed',
        'SERVER_ERROR'
      );
    }
  }

  /**
   * 🛠️ CREATE FILE ERROR: Convert various error types to structured FileError
   * 🎓 LEARNING: Centralized error handling for consistent error reporting
   */
  private createFileError(
    error: unknown,
    fileId?: string,
    fileName?: string
  ): FileError {
    let errorType: FileErrorType = 'SERVER_ERROR';
    let message = 'An unknown error occurred';
    let isRetryable = false;
    let userAction = 'Please try again later';

    if (error instanceof Error) {
      message = error.message;
      
      // Determine error type from message content
      if (message.includes('cancelled') || message.includes('abort')) {
        errorType = 'NETWORK_ERROR';
        message = 'Upload was cancelled';
        isRetryable = false;
        userAction = 'You can try uploading again';
      } else if (message.includes('timeout')) {
        errorType = 'TIMEOUT_ERROR';
        isRetryable = true;
        userAction = 'Please check your connection and try again';
      } else if (message.includes('network') || message.includes('fetch')) {
        errorType = 'NETWORK_ERROR';
        isRetryable = true;
        userAction = 'Please check your internet connection';
      } else if (message.includes('size') || message.includes('type')) {
        errorType = 'VALIDATION_ERROR';
        isRetryable = false;
        userAction = 'Please select a valid file';
      } else if (message.includes('quota') || message.includes('limit')) {
        errorType = 'QUOTA_EXCEEDED';
        isRetryable = false;
        userAction = 'Please contact your administrator';
      }
    }

    return {
      type: errorType,
      code: errorType.toLowerCase().replace('_', '-'),
      message,
      fileId,
      fileName,
      timestamp: new Date(),
      isRetryable,
      userAction
    };
  }

  /**
   * 🔄 RETRY UPLOAD: Retry a failed upload with exponential backoff
   * 🎓 LEARNING: Implementing retry logic with exponential backoff
   */
  async retryUpload(
    fileUpload: FileUpload,
    maxRetries: number = 3,
    onProgress?: UploadProgressCallback,
    onComplete?: UploadCompleteCallback
  ): Promise<FileUpload> {
    let lastError: FileError | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Wait before retry (exponential backoff)
        if (attempt > 0) {
          const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
          console.log(`⏳ Waiting ${delay}ms before retry attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} for file:`, fileUpload.file.name);
        
        // Reset upload status
        fileUpload.status = 'pending';
        fileUpload.error = undefined;

        // Attempt upload
        return await this.uploadFile(fileUpload, onProgress, onComplete);

      } catch (error) {
        console.log(`❌ Retry attempt ${attempt + 1}/${maxRetries} failed:`, error);
        lastError = error instanceof FileUploadError 
          ? this.createFileError(error, fileUpload.id, fileUpload.file.name)
          : this.createFileError(error, fileUpload.id, fileUpload.file.name);

        // If not retryable, stop trying
        if (!lastError.isRetryable) {
          break;
        }
      }
    }

    // All retries failed
    if (lastError) {
      fileUpload.error = lastError;
      if (onComplete) onComplete(lastError);
      throw new FileUploadError(lastError.message, lastError.type, undefined, lastError.fileId);
    }

    throw new FileUploadError('Upload failed after all retries', 'SERVER_ERROR', undefined, fileUpload.id);
  }
}

// Export singleton instance following the same pattern as other services
export const fileService = new FileService();

// 🎯 File Service Features:
//
// 1. **Progress Tracking**: 
//    - Real-time upload progress with speed calculation
//    - Time remaining estimation
//    - Cancellation support via AbortController
//
// 2. **Error Handling**: 
//    - Structured error types with user-friendly messages
//    - Retry logic with exponential backoff
//    - Specific error types for different failure modes
//
// 3. **Authentication Integration**: 
//    - Uses existing authService for all requests
//    - Consistent header management
//    - Proper error handling for auth failures
//
// 4. **File Management**: 
//    - Upload, download, delete operations
//    - Metadata retrieval and caching
//    - User file listing with pagination
//
// 5. **Modern Web APIs**: 
//    - XMLHttpRequest for upload progress
//    - FormData for file upload
//    - AbortController for cancellation
//    - Blob/text response handling
//
// Usage Example:
// ```
// const fileUpload = createFileUpload(selectedFile);
// 
// await fileService.uploadFile(
//   fileUpload,
//   (progress) => console.log(`${progress.percentage}% complete`),
//   (result) => console.log('Upload finished:', result)
// );
// ```
