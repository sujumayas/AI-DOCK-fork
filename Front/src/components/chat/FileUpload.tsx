// 📁 File Upload Component
// Drag-and-drop file upload zone with progress tracking
// Integrates with the chat interface using glassmorphism design

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, 
  X, 
  File, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  FolderOpen,
  Cloud,
  HardDrive
} from 'lucide-react';
import { 
  FileUpload as FileUploadType,
  FileError,
  UploadProgress,
  DragDropState,
  FileRejection,
  FileValidationError,
  FileValidationResult,
  FileUploadStatus,
  createFileUpload,
  validateFile,
  validateFileDetailed,
  validateWordDocumentSignature,
  formatFileSize,
  getFileIcon,
  isSupportedFileType,
  isValidFileSize,
  isWordFile,
  hasWordMetadata,
  formatWordMetadata,
  getWordProcessingStatus,
  extractWordOutline,
  MAX_FILE_SIZE,
  MAX_FILES_PER_MESSAGE,
  SUPPORTED_FILE_TYPES,
  SUPPORTED_FILE_EXTENSIONS,
  VALIDATION_MESSAGES
} from '../../types/file';
import { fileService } from '../../services/fileService';

interface FileUploadProps {
  // Component control
  isVisible: boolean;
  onFilesAdded: (files: FileUploadType[]) => void;
  onFileRemoved: (fileId: string) => void;
  onUploadComplete: (fileUpload: FileUploadType) => void;
  onUploadError: (error: FileError) => void;
  
  // Optional restrictions
  maxFiles?: number;
  maxFileSize?: number;
  acceptedTypes?: string[];
  
  // UI customization
  className?: string;
  compact?: boolean;        // Smaller version for mobile
  disabled?: boolean;       // Disable during chat loading
}

export const FileUpload: React.FC<FileUploadProps> = ({
  isVisible,
  onFilesAdded,
  onFileRemoved,
  onUploadComplete,
  onUploadError,
  maxFiles = MAX_FILES_PER_MESSAGE,
  maxFileSize = MAX_FILE_SIZE,
  acceptedTypes = SUPPORTED_FILE_TYPES,
  className = '',
  compact = false,
  disabled = false
}) => {
  // 📁 File upload state
  const [uploads, setUploads] = useState<FileUploadType[]>([]);
  const [fileWarnings, setFileWarnings] = useState<string[]>([]); // Store non-blocking warnings
  const [dragState, setDragState] = useState<DragDropState>({
    isDragActive: false,
    isDragAccept: false,
    isDragReject: false,
    draggedFiles: [],
    acceptedFiles: [],
    rejectedFiles: [],
    dropZoneActive: false,
    showDropPreview: false
  });
  
  // 🎯 References for file input and drop zone
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0); // Track drag enter/leave events

  // 🎓 LEARNING: Async validation for Word documents
  const validateWordDocumentAsync = useCallback(async (file: File): Promise<string[]> => {
    const errors: string[] = [];
    
    if (isWordFile(file)) {
      try {
        const hasValidSignature = await validateWordDocumentSignature(file);
        if (!hasValidSignature) {
          if (file.name.toLowerCase().endsWith('.docx')) {
            errors.push('This file does not appear to be a valid .docx document. It may be a text file renamed with a .docx extension.');
          } else if (file.name.toLowerCase().endsWith('.doc')) {
            errors.push('This file does not appear to be a valid .doc document. It may be a text file renamed with a .doc extension.');
          }
        }
      } catch (error) {
        console.warn('Failed to validate Word document signature:', error);
        // Don't block upload on signature validation error
      }
    }
    
    return errors;
  }, []);

  // 🎓 LEARNING: Starting file uploads with progress tracking
  const startUpload = useCallback(async (fileUpload: FileUploadType) => {
    try {
      console.log('🚀 Starting upload for:', fileUpload.file.name);

      await fileService.uploadFile(
        fileUpload,
        // Progress callback
        (progress: UploadProgress) => {
          setUploads(prev => prev.map(upload => 
            upload.id === fileUpload.id 
              ? { ...upload, progress: progress.percentage }
              : upload
          ));
        },
        // Completion callback
        (result) => {
          if ('type' in result) {
            // It's an error
            const error = result as FileError;
            console.error('❌ Upload failed:', error);
            
            setUploads(prev => prev.map(upload => 
              upload.id === fileUpload.id 
                ? { ...upload, status: 'error', error }
                : upload
            ));
            
            onUploadError(error);
          } else {
            // It's a successful upload
            const completedUpload = result as FileUploadType;
            console.log('✅ Upload completed:', completedUpload.file.name);
            
            setUploads(prev => prev.map(upload => 
              upload.id === fileUpload.id 
                ? completedUpload
                : upload
            ));
            
            onUploadComplete(completedUpload);
          }
        }
      );

    } catch (error) {
      console.error('❌ Upload failed:', error);
      
      const fileError: FileError = {
        type: 'NETWORK_ERROR',
        code: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Upload failed',
        fileId: fileUpload.id,
        fileName: fileUpload.file.name,
        timestamp: new Date(),
        isRetryable: true,
        userAction: 'Please try again'
      };
      
      setUploads(prev => prev.map(upload => 
        upload.id === fileUpload.id 
          ? { ...upload, status: 'error', error: fileError }
          : upload
      ));
      
      onUploadError(fileError);
    }
  }, [onUploadComplete, onUploadError]);

  // 🎓 LEARNING: File processing and validation (synchronous main flow)
  const handleFiles = useCallback((files: File[]) => {
    if (disabled) return;

    console.log('📁 Processing dropped/selected files:', files.length);

    const newUploads: FileUploadType[] = [];
    const rejectedFiles: FileRejection[] = [];

    // Check if adding these files would exceed the limit
    const totalFiles = uploads.length + files.length;
    if (totalFiles > maxFiles) {
      const error: FileValidationError = {
        code: 'too-many-files',
        message: `Cannot upload more than ${maxFiles} files at once`,
        details: { limit: maxFiles, attempted: totalFiles }
      };
      rejectedFiles.push(...files.map(file => ({ file, errors: [error] })));
    } else {
      // Process each file with detailed validation (synchronous first pass)
      files.forEach(file => {
        const validation = validateFileDetailed(file);
        const additionalBlockingErrors: string[] = [];
        
        // Check custom restrictions (blocking errors only)
        if (file.size > maxFileSize) {
          if (isWordFile(file)) {
            additionalBlockingErrors.push(VALIDATION_MESSAGES.WORD_TOO_LARGE);
          } else {
            additionalBlockingErrors.push(`File size ${formatFileSize(file.size)} exceeds limit of ${formatFileSize(maxFileSize)}`);
          }
        }
        
        if (!acceptedTypes.includes(file.type) && 
            !SUPPORTED_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))) {
          if (isWordFile(file)) {
            additionalBlockingErrors.push(VALIDATION_MESSAGES.WORD_UNSUPPORTED_FORMAT);
          } else {
            additionalBlockingErrors.push(`File type "${file.type}" is not supported`);
          }
        }

        // Combine validation errors (without async Word validation for now)
        const allBlockingErrors = [...validation.blockingErrors, ...additionalBlockingErrors];

        if (allBlockingErrors.length > 0) {
          // File has blocking errors - reject it
          const errors: FileValidationError[] = allBlockingErrors.map(msg => ({
            code: 'file-invalid-type',
            message: msg
          }));
          rejectedFiles.push({ file, errors });
        } else {
          // File passes initial validation - create upload
          const fileUpload = createFileUpload(file);
          newUploads.push(fileUpload);
          
          // Store warnings for this file (non-blocking)
          if (validation.warnings.length > 0) {
            setFileWarnings(prev => [...prev, ...validation.warnings.map(warning => `${file.name}: ${warning}`)]);
          }
          
          // Perform async Word document validation after initial validation
          if (isWordFile(file)) {
            validateWordDocumentAsync(file).then(wordErrors => {
              if (wordErrors.length > 0) {
                // Word validation failed - update upload to error state
                setUploads(prev => prev.map(upload => {
                  if (upload.id === fileUpload.id) {
                    const error: FileError = {
                      type: 'VALIDATION_ERROR',
                      code: 'WORD_VALIDATION_FAILED',
                      message: wordErrors[0],
                      fileName: file.name,
                      timestamp: new Date(),
                      isRetryable: false,
                      userAction: 'Please upload a valid Word document'
                    };
                    return { ...upload, status: 'error' as const, error };
                  }
                  return upload;
                }));
                
                // Also notify parent of error
                const error: FileError = {
                  type: 'VALIDATION_ERROR',
                  code: 'WORD_VALIDATION_FAILED',
                  message: wordErrors[0],
                  fileName: file.name,
                  timestamp: new Date(),
                  isRetryable: false,
                  userAction: 'Please upload a valid Word document'
                };
                onUploadError(error);
              }
            }).catch(error => {
              console.warn('Word validation error:', error);
              // Don't fail the upload on validation error
            });
          }
        }
      });
    }

    // Update state and notify parent
    if (newUploads.length > 0) {
      setUploads(prev => [...prev, ...newUploads]);
      onFilesAdded(newUploads);
      
      // Start uploads automatically
      newUploads.forEach(fileUpload => {
        startUpload(fileUpload);
      });
    }

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      console.warn('❌ Some files were rejected:', rejectedFiles);
      // Show error for first rejected file (could be enhanced to show all)
      const firstRejection = rejectedFiles[0];
      const error: FileError = {
        type: 'VALIDATION_ERROR',
        code: 'FILE_VALIDATION_FAILED',
        message: firstRejection.errors[0].message,
        fileName: firstRejection.file.name,
        timestamp: new Date(),
        isRetryable: false,
        userAction: 'Please select a valid file'
      };
      onUploadError(error);
    }
  }, [uploads.length, maxFiles, maxFileSize, acceptedTypes, disabled, onFilesAdded, onUploadError, validateWordDocumentAsync, startUpload]);

  // 🎓 LEARNING: useCallback prevents unnecessary re-renders
  // when we pass these functions as props to child components
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📎 DEBUG - File input changed:', {
      filesLength: event.target.files?.length || 0,
      files: event.target.files ? Array.from(event.target.files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      })) : []
    });
    const files = Array.from(event.target.files || []);
    handleFiles(files);
    
    // Reset input so same file can be selected again
    if (event.target) {
      event.target.value = '';
    }
  }, [handleFiles]);

  const openFileDialog = useCallback(() => {
    console.log('📎 DEBUG - Opening file dialog:', {
      disabled,
      hasFileInputRef: !!fileInputRef.current
    });
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  // 🎓 LEARNING: Drag and drop event handlers
  // These handle the complex drag and drop interactions
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current++;
    
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setDragState(prev => ({
        ...prev,
        isDragActive: true,
        dropZoneActive: true
      }));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if dragged items are files we can accept
    const hasFiles = e.dataTransfer?.types.includes('Files');
    
    setDragState(prev => ({
      ...prev,
      isDragActive: true,
      isDragAccept: hasFiles && !disabled,
      isDragReject: !hasFiles || disabled
    }));
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current--;
    
    if (dragCounter.current === 0) {
      setDragState(prev => ({
        ...prev,
        isDragActive: false,
        isDragAccept: false,
        isDragReject: false,
        dropZoneActive: false
      }));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current = 0;
    
    setDragState(prev => ({
      ...prev,
      isDragActive: false,
      isDragAccept: false,
      isDragReject: false,
      dropZoneActive: false
    }));

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  // Remove file from upload list
  const removeFile = useCallback((fileId: string) => {
    console.log('🗑️ Removing file:', fileId);
    
    const uploadToRemove = uploads.find(upload => upload.id === fileId);
    
    // Cancel upload if in progress
    fileService.cancelUpload(fileId);
    
    // Remove from state
    setUploads(prev => prev.filter(upload => upload.id !== fileId));
    
    // Remove associated warnings
    if (uploadToRemove) {
      setFileWarnings(prev => prev.filter(warning => !warning.startsWith(uploadToRemove.file.name + ':')));
    }
    
    // Notify parent
    onFileRemoved(fileId);
  }, [onFileRemoved, uploads]);

  // 🎨 Dynamic styling based on drag state
  const getDropZoneClassName = () => {
    const baseClass = `
      relative border-2 border-dashed rounded-lg transition-all duration-200 
      ${compact ? 'p-3' : 'p-4 md:p-6'}
    `;
    
    if (disabled) {
      return `${baseClass} border-gray-400 bg-gray-100 cursor-not-allowed`;
    }
    
    if (dragState.isDragReject) {
      return `${baseClass} border-red-400 bg-red-50 border-solid`;
    }
    
    if (dragState.isDragAccept) {
      return `${baseClass} border-blue-400 bg-blue-50 border-solid shadow-md`;
    }
    
    return `${baseClass} border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20 cursor-pointer`;
  };

  if (!isVisible) return null;

  return (
    <div className={`${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={getDropZoneClassName()}
      >
        <div className="text-center">
          {/* Icon */}
          <div className="mb-2 md:mb-3">
            {dragState.isDragAccept ? (
              <Cloud className={`mx-auto text-blue-500 ${compact ? 'w-6 h-6' : 'w-8 h-8 md:w-10 md:h-10'}`} />
            ) : dragState.isDragReject ? (
              <AlertCircle className={`mx-auto text-red-500 ${compact ? 'w-6 h-6' : 'w-8 h-8 md:w-10 md:h-10'}`} />
            ) : (
              <Upload className={`mx-auto text-white/70 hover:text-white ${compact ? 'w-6 h-6' : 'w-8 h-8 md:w-10 md:h-10'}`} />
            )}
          </div>

          {/* Text */}
          <div className="text-white/90">
            {disabled ? (
              <p className={`text-gray-500 ${compact ? 'text-xs' : 'text-sm md:text-base'}`}>
                File upload disabled
              </p>
            ) : dragState.isDragAccept ? (
              <div>
                <p className={`font-medium text-blue-600 ${compact ? 'text-xs' : 'text-sm md:text-base'}`}>
                  Drop files here
                </p>
                <p className={`text-blue-500 ${compact ? 'text-xs' : 'text-xs md:text-sm'} mt-1`}>
                  Ready to upload {dragState.draggedFiles.length} file(s)
                </p>
              </div>
            ) : dragState.isDragReject ? (
              <div>
                <p className={`font-medium text-red-600 ${compact ? 'text-xs' : 'text-sm md:text-base'}`}>
                  Invalid files
                </p>
                <p className={`text-red-500 ${compact ? 'text-xs' : 'text-xs md:text-sm'} mt-1`}>
                  Check file type and size
                </p>
              </div>
            ) : (
              <div>
                <p className={`font-medium ${compact ? 'text-xs' : 'text-sm md:text-base'}`}>
                  <span className="hidden md:inline">Drop files here or click to browse</span>
                  <span className="md:hidden">Tap to select files</span>
                </p>
                <p className={`text-white/60 ${compact ? 'text-xs' : 'text-xs md:text-sm'} mt-1`}>
                  Text, PDF, Word docs (.txt, .pdf, .docx, .doc) • Max {formatFileSize(maxFileSize)} • Up to {maxFiles} files
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upload progress indicator overlay */}
        {uploads.some(upload => ['uploading', 'processing'].includes(upload.status)) && (
          <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className={`mx-auto animate-spin mb-2 ${compact ? 'w-4 h-4' : 'w-6 h-6'}`} />
              <p className={compact ? 'text-xs' : 'text-sm'}>
                {(() => {
                  const uploadingCount = uploads.filter(u => u.status === 'uploading').length;
                  const processingCount = uploads.filter(u => u.status === 'processing').length;
                  const wordProcessingCount = uploads.filter(u => u.status === 'processing' && isWordFile(u.file)).length;
                  
                  if (uploadingCount > 0) {
                    return `Uploading ${uploadingCount} file(s)...`;
                  } else if (wordProcessingCount > 0) {
                    return `📘 Processing ${wordProcessingCount} Word document(s)...`;
                  } else if (processingCount > 0) {
                    return `Processing ${processingCount} file(s)...`;
                  }
                  return 'Processing files...';
                })()}
              </p>
              {uploads.some(upload => upload.status === 'processing' && isWordFile(upload.file)) && (
                <p className={`${compact ? 'text-xs' : 'text-xs'} text-white/70 mt-1`}>
                  Extracting text and structure
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* File warnings */}
      {fileWarnings.length > 0 && (
        <div className={`${compact ? 'mt-2' : 'mt-3'} p-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg`}>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className={`text-yellow-100 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
                File Warnings
              </p>
              <ul className={`text-yellow-200/80 ${compact ? 'text-xs' : 'text-xs'} mt-1 space-y-1`}>
                {fileWarnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setFileWarnings([])}
              className="text-yellow-400 hover:text-yellow-300 p-1 rounded transition-colors flex-shrink-0"
              title="Dismiss warnings"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* File list */}
      {uploads.length > 0 && (
        <div className={`${compact ? 'mt-2 space-y-1' : 'mt-3 md:mt-4 space-y-2'}`}>
          {uploads.map(upload => (
            <div
              key={upload.id}
              className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20"
            >
              {/* File icon */}
              <div className={`flex-shrink-0 ${compact ? 'text-lg' : 'text-xl md:text-2xl'}`}>
                {getFileIcon(upload.file)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-white font-medium truncate ${compact ? 'text-xs' : 'text-sm md:text-base'}`}>
                    {upload.file.name}
                  </p>
                  <button
                    onClick={() => removeFile(upload.id)}
                    className="flex-shrink-0 text-white/60 hover:text-white p-1 rounded transition-colors"
                  >
                    <X className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                  </button>
                </div>
                
                <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-xs md:text-sm'} text-white/70`}>
                  <span>{formatFileSize(upload.file.size)}</span>
                  
                  {/* Word document metadata */}
                  {isWordFile(upload.file) && upload.metadata && hasWordMetadata(upload.metadata) && (
                    <>
                      <span>•</span>
                      <span>{formatWordMetadata(upload.metadata.wordMetadata!)}</span>
                    </>
                  )}
                  
                  {/* Status indicator */}
                  {upload.status === 'uploading' && (
                    <>
                      <span>•</span>
                      <span>Uploading {upload.progress}%</span>
                      <Loader2 className="w-3 h-3 animate-spin" />
                    </>
                  )}
                  
                  {upload.status === 'processing' && isWordFile(upload.file) && (
                    <>
                      <span>•</span>
                      <span className="text-blue-300">📘 Processing Word document...</span>
                      <Loader2 className="w-3 h-3 animate-spin" />
                    </>
                  )}
                  
                  {upload.status === 'processing' && !isWordFile(upload.file) && (
                    <>
                      <span>•</span>
                      <span className="text-blue-300">Processing...</span>
                      <Loader2 className="w-3 h-3 animate-spin" />
                    </>
                  )}
                  
                  {upload.status === 'completed' && (
                    <>
                      <span>•</span>
                      <span className="text-green-300">Uploaded</span>
                      <CheckCircle className="w-3 h-3 text-green-300" />
                    </>
                  )}
                  
                  {upload.status === 'error' && (
                    <>
                      <span>•</span>
                      <span className="text-red-300">Failed</span>
                      <AlertCircle className="w-3 h-3 text-red-300" />
                    </>
                  )}
                </div>

                {/* Progress bar */}
                {upload.status === 'uploading' && (
                  <div className="mt-1 w-full bg-white/20 rounded-full h-1">
                    <div 
                      className="h-1 bg-blue-400 rounded-full transition-all duration-200"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}
                
                {/* Word document structure preview */}
                {isWordFile(upload.file) && upload.status === 'completed' && upload.metadata && hasWordMetadata(upload.metadata) && (
                  <div className="mt-2 pl-2 border-l-2 border-white/20">
                    {/* Document processing status */}
                    <div className={`${compact ? 'text-xs' : 'text-xs'} text-white/60 mb-1`}>
                      Status: {getWordProcessingStatus(upload.metadata.wordMetadata!)}
                    </div>
                    
                    {/* Document outline preview */}
                    {extractWordOutline(upload.metadata.wordMetadata!).length > 0 && (
                      <div className={`${compact ? 'text-xs' : 'text-xs'} text-white/70`}>
                        <div className="text-white/60 mb-1">Document Structure:</div>
                        {extractWordOutline(upload.metadata.wordMetadata!).slice(0, 3).map((heading, index) => (
                          <div key={index} className="font-mono truncate">
                            {heading}
                          </div>
                        ))}
                        {extractWordOutline(upload.metadata.wordMetadata!).length > 3 && (
                          <div className="text-white/50 text-xs italic">
                            +{extractWordOutline(upload.metadata.wordMetadata!).length - 3} more sections...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 🎯 File Upload Component Features:
//
// 1. **Drag and Drop**: 
//    - Visual feedback during drag operations
//    - File validation during drag
//    - Proper drag counter to handle nested elements
//
// 2. **Progress Tracking**: 
//    - Real-time upload progress bars
//    - Visual status indicators (uploading, processing, completed, error)
//    - Multiple file upload support with individual progress
//
// 3. **File Validation**: 
//    - Client-side validation before upload
//    - File type and size checking
//    - Word-specific validation messages
//    - User-friendly error messages
//
// 4. **Word Document Support**: 
//    - Specialized processing indicators for .docx and .doc files
//    - Document structure preview with headings outline
//    - Word-specific metadata display (pages, word count, author)
//    - Processing status with structure extraction feedback
//    - Enhanced validation with Word-specific error messages
//
// 5. **Responsive Design**: 
//    - Compact mode for mobile
//    - Glassmorphism styling to match chat interface
//    - Touch-friendly interaction areas
//
// 6. **Accessibility**: 
//    - Proper ARIA labels
//    - Keyboard navigation support
//    - Screen reader friendly
//
// Usage Example:
// ```
// <FileUpload
//   isVisible={showUpload}
//   onFilesAdded={(files) => setAttachedFiles(files)}
//   onFileRemoved={(id) => removeAttachment(id)}
//   onUploadComplete={(upload) => {
//     // Word documents will have metadata populated after processing
//     if (isWordFile(upload.file) && hasWordMetadata(upload.metadata)) {
//       console.log('Word doc processed:', formatWordMetadata(upload.metadata.wordMetadata));
//       console.log('Document outline:', extractWordOutline(upload.metadata.wordMetadata));
//     }
//   }}
//   onUploadError={(error) => showError(error.message)}
//   compact={isMobile}
// />
// ```
//
// 📘 Word Document Features:
// - Supports both .docx (modern) and .doc (legacy) formats
// - Displays document metadata: page count, word count, author
// - Shows document structure with headings outline
// - Provides processing status and error handling
// - Validates document complexity and security features
// - Extracts text while preserving document structure
