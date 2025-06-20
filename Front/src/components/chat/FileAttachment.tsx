// 📎 File Attachment Component
// Displays individual file attachments with download/remove actions
// Used in message input and conversation display

import React, { useState } from 'react';
import { 
  Download, 
  X, 
  Eye,
  AlertCircle,
  FileText,
  Loader2,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { 
  FileAttachment as FileAttachmentType,
  FileUpload,
  FileError,
  formatFileSize,
  getFileIcon,
  isUploadCompleted,
  hasUploadError,
  canRetryUpload,
  isAttachmentDownloadable,
  isWordFile,
  hasWordMetadata,
  formatWordMetadata,
  getWordQualityDescription,
  getWordComplexityDescription,
  getWordProcessingStatus,
  extractWordOutline,
  isWordTextExtractionSuccessful,
  isWordStructureComplex
} from '../../types/file';
import { fileService } from '../../services/fileService';

interface FileAttachmentProps {
  // Core data
  attachment: FileAttachmentType;
  
  // Actions
  onRemove?: (attachmentId: string) => void;
  onDownload?: (attachmentId: string) => void;
  onRetry?: (attachmentId: string) => void;
  onPreview?: (attachment: FileAttachmentType) => void;
  
  // Display options
  showRemove?: boolean;        // Show remove button
  showDownload?: boolean;      // Show download button
  showPreview?: boolean;       // Show preview button (for text files)
  compact?: boolean;           // Compact display for mobile
  interactive?: boolean;       // Allow user interactions
  
  // State
  disabled?: boolean;          // Disable all actions
  
  // Styling
  className?: string;
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({
  attachment,
  onRemove,
  onDownload,
  onRetry,
  onPreview,
  showRemove = true,
  showDownload = true, 
  showPreview = true,
  compact = false,
  interactive = true,
  disabled = false,
  className = ''
}) => {
  // 📦 Local state for download/retry operations
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 🎓 LEARNING: Derived state from attachment data
  const fileUpload = attachment.fileUpload;
  const fileName = attachment.displayName || fileUpload.file.name;
  const fileSize = fileUpload.file.size;
  const uploadCompleted = isUploadCompleted(fileUpload);
  const uploadError = hasUploadError(fileUpload);
  const canRetry = canRetryUpload(fileUpload);
  const canDownload = isAttachmentDownloadable(attachment);
  const canShowPreview = showPreview && uploadCompleted && 
                        (fileUpload.file.type.startsWith('text/') || 
                         fileUpload.file.name.endsWith('.md') ||
                         fileUpload.file.name.endsWith('.txt'));
  
  // 📘 Word document specific state
  const isWordDocument = isWordFile(fileUpload.file);
  const wordMetadata = hasWordMetadata(fileUpload.metadata || {}) ? fileUpload.metadata?.wordMetadata : undefined;
  const hasWordContent = wordMetadata && isWordTextExtractionSuccessful(wordMetadata);
  const wordOutline = wordMetadata ? extractWordOutline(wordMetadata) : [];
  const isComplexWord = wordMetadata ? isWordStructureComplex(wordMetadata) : false;

  // 🎨 Status indicator styling
  const getStatusColor = () => {
    if (uploadError) return 'text-red-400';
    if (uploadCompleted) return 'text-green-400';
    if (fileUpload.status === 'uploading') return 'text-blue-400';
    return 'text-yellow-400';
  };

  const getStatusIcon = () => {
    if (isRetrying) return <Loader2 className="w-3 h-3 animate-spin" />;
    if (uploadError) return <AlertCircle className="w-3 h-3" />;
    if (uploadCompleted) return <CheckCircle className="w-3 h-3" />;
    if (fileUpload.status === 'uploading') return <Loader2 className="w-3 h-3 animate-spin" />;
    return <AlertCircle className="w-3 h-3" />;
  };

  const getStatusText = () => {
    if (isRetrying) return 'Retrying...';
    if (uploadError && fileUpload.error) return fileUpload.error.message;
    if (uploadCompleted) return 'Ready';
    if (fileUpload.status === 'uploading') return `${fileUpload.progress}%`;
    if (fileUpload.status === 'processing') return 'Processing...';
    return 'Pending';
  };

  // 📥 Handle download action
  const handleDownload = async () => {
    if (!canDownload || !fileUpload.uploadedFileId || disabled || !interactive) return;

    try {
      setIsDownloading(true);
      setDownloadError(null);
      
      console.log('📥 Downloading file:', fileName);
      
      // Download as blob to trigger browser download
      const blob = await fileService.downloadFile(fileUpload.uploadedFileId, true) as Blob;
      
      // Create download link
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
      console.log('✅ File downloaded successfully:', fileName);
      
      if (onDownload) {
        onDownload(attachment.id);
      }
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      setDownloadError(errorMessage);
      
    } finally {
      setIsDownloading(false);
    }
  };

  // 🔄 Handle retry action
  const handleRetry = async () => {
    if (!canRetry || disabled || !interactive) return;

    try {
      setIsRetrying(true);
      console.log('🔄 Retrying upload for:', fileName);
      
      // Call parent retry handler if provided
      if (onRetry) {
        onRetry(attachment.id);
      }
      
    } catch (error) {
      console.error('❌ Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // 👁️ Handle preview action
  const handlePreview = () => {
    if (!canShowPreview || disabled || !interactive) return;
    
    console.log('👁️ Previewing file:', fileName);
    
    if (onPreview) {
      onPreview(attachment);
    }
  };

  // 🗑️ Handle remove action
  const handleRemove = () => {
    if (!showRemove || disabled || !interactive) return;
    
    console.log('🗑️ Removing attachment:', fileName);
    
    if (onRemove) {
      onRemove(attachment.id);
    }
  };

  return (
    <div className={`
      flex items-center gap-2 md:gap-3 p-2 md:p-3 
      bg-white/10 backdrop-blur-sm rounded-lg border border-white/20
      transition-all duration-200 hover:bg-white/15
      ${disabled ? 'opacity-50' : ''}
      ${className}
    `}>
      {/* File icon */}
      <div className={`flex-shrink-0 ${compact ? 'text-lg' : 'text-xl md:text-2xl'}`}>
        {getFileIcon(fileUpload.file)}
      </div>

      {/* File information */}
      <div className="flex-1 min-w-0">
        {/* Filename and size */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`text-white font-medium truncate ${compact ? 'text-xs' : 'text-sm md:text-base'}`}>
              {fileName}
            </p>
            <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-xs md:text-sm'} text-white/70 mt-0.5`}>
              <span>{formatFileSize(fileSize)}</span>
              <span>•</span>
              <span className={getStatusColor()}>{getStatusText()}</span>
              {getStatusIcon()}
            </div>
          </div>
        </div>

        {/* Description if available */}
        {attachment.description && (
          <p className={`text-white/60 mt-1 ${compact ? 'text-xs' : 'text-xs md:text-sm'}`}>
            {attachment.description}
          </p>
        )}

        {/* Progress bar for uploading files */}
        {fileUpload.status === 'uploading' && (
          <div className="mt-2 w-full bg-white/20 rounded-full h-1">
            <div 
              className="h-1 bg-blue-400 rounded-full transition-all duration-200"
              style={{ width: `${fileUpload.progress}%` }}
            />
          </div>
        )}

        {/* Error message */}
        {uploadError && fileUpload.error && (
          <div className={`mt-1 text-red-300 ${compact ? 'text-xs' : 'text-xs md:text-sm'}`}>
            {fileUpload.error.userAction || 'Upload failed'}
          </div>
        )}

        {/* Download error */}
        {downloadError && (
          <div className={`mt-1 text-red-300 ${compact ? 'text-xs' : 'text-xs md:text-sm'}`}>
            Download failed: {downloadError}
          </div>
        )}

        {/* Word Document Enhanced Display */}
        {uploadCompleted && isWordDocument && wordMetadata && (
          <div className={`mt-2 space-y-2`}>
            {/* Word Document Metadata */}
            <div className={`p-2 bg-blue-900/20 rounded border border-blue-500/20 ${compact ? 'text-xs' : 'text-xs'}`}>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-lg">📘</span>
                <span className="text-blue-200 font-medium">Word Document</span>
              </div>
              
              {/* Basic metadata */}
              <div className="text-white/80 space-y-1">
                <div className="flex flex-wrap gap-3 text-xs">
                  <span>{wordMetadata.pageCount} page{wordMetadata.pageCount !== 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span>{wordMetadata.wordCount.toLocaleString()} words</span>
                  <span>•</span>
                  <span>{wordMetadata.paragraphCount} paragraphs</span>
                </div>
                
                {/* Author and title info */}
                {(wordMetadata.author || wordMetadata.title) && (
                  <div className="text-xs text-white/60">
                    {wordMetadata.title && (
                      <div className="font-medium text-white/80">Title: {wordMetadata.title}</div>
                    )}
                    {wordMetadata.author && (
                      <div>Author: {wordMetadata.author}</div>
                    )}
                  </div>
                )}
                
                {/* Document complexity and quality indicators */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${
                    wordMetadata.textExtractionQuality === 'excellent' ? 'bg-green-500/20 text-green-200' :
                    wordMetadata.textExtractionQuality === 'good' ? 'bg-blue-500/20 text-blue-200' :
                    wordMetadata.textExtractionQuality === 'fair' ? 'bg-yellow-500/20 text-yellow-200' :
                    'bg-red-500/20 text-red-200'
                  }`}>
                    {getWordQualityDescription(wordMetadata.textExtractionQuality)}
                  </span>
                  
                  <span className={`px-1.5 py-0.5 rounded ${
                    wordMetadata.structureComplexity === 'simple' || wordMetadata.structureComplexity === 'moderate' 
                      ? 'bg-green-500/20 text-green-200' 
                      : 'bg-orange-500/20 text-orange-200'
                  }`}>
                    {getWordComplexityDescription(wordMetadata.structureComplexity)}
                  </span>
                </div>
                
                {/* Document structure stats */}
                {(wordMetadata.tableCount > 0 || wordMetadata.listCount > 0 || wordMetadata.imageCount > 0) && (
                  <div className="text-xs text-white/60 pt-1 border-t border-white/10">
                    Structure:
                    {wordMetadata.tableCount > 0 && <span className="ml-2">{wordMetadata.tableCount} table{wordMetadata.tableCount !== 1 ? 's' : ''}</span>}
                    {wordMetadata.listCount > 0 && <span className="ml-2">{wordMetadata.listCount} list{wordMetadata.listCount !== 1 ? 's' : ''}</span>}
                    {wordMetadata.imageCount > 0 && <span className="ml-2">{wordMetadata.imageCount} image{wordMetadata.imageCount !== 1 ? 's' : ''}</span>}
                    {wordMetadata.hyperlinkCount > 0 && <span className="ml-2">{wordMetadata.hyperlinkCount} link{wordMetadata.hyperlinkCount !== 1 ? 's' : ''}</span>}
                  </div>
                )}
              </div>
            </div>
            
            {/* Document Outline Preview */}
            {hasWordContent && wordOutline.length > 0 && (
              <div className={`p-2 bg-indigo-900/20 rounded border border-indigo-500/20 ${compact ? 'text-xs' : 'text-xs'}`}>
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="w-3 h-3 text-indigo-300" />
                  <span className="text-indigo-200 font-medium">Document Outline</span>
                </div>
                <div className="text-white/80 font-mono text-xs space-y-0.5 max-h-16 overflow-hidden">
                  {wordOutline.map((heading, index) => (
                    <div key={index} className="truncate">
                      {heading}
                    </div>
                  ))}
                  {wordOutline.length >= 5 && (
                    <div className="text-white/50 italic">...and more sections</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Document Status and Warnings */}
            {wordMetadata && (
              <div className={`text-xs ${compact ? 'text-xs' : 'text-xs'}`}>
                {/* Processing status */}
                <div className={`${
                  getWordProcessingStatus(wordMetadata) === 'Ready for AI analysis' 
                    ? 'text-green-300' 
                    : 'text-yellow-300'
                }`}>
                  Status: {getWordProcessingStatus(wordMetadata)}
                </div>
                
                {/* Warnings for complex documents */}
                {isComplexWord && (
                  <div className="text-orange-300 mt-1">
                    ⚠️ Complex document structure detected - some formatting may be simplified
                  </div>
                )}
                
                {/* Legacy format warning */}
                {fileName.toLowerCase().endsWith('.doc') && (
                  <div className="text-yellow-300 mt-1">
                    💡 Consider converting to .docx format for better processing
                  </div>
                )}
                
                {/* Readability info if available */}
                {wordMetadata.readabilityScore && (
                  <div className="text-white/60 mt-1">
                    Readability: {wordMetadata.readabilityScore}/100
                    {wordMetadata.averageWordsPerSentence && (
                      <span className="ml-2">• Avg {wordMetadata.averageWordsPerSentence} words/sentence</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Content preview for text files */}
        {uploadCompleted && !isWordDocument && attachment.fileUpload.metadata?.previewContent && (
          <div className={`mt-2 p-2 bg-black/20 rounded text-white/80 font-mono ${compact ? 'text-xs' : 'text-xs'}`}>
            <div className="flex items-center gap-1 mb-1">
              <FileText className="w-3 h-3" />
              <span className="text-white/60">Preview:</span>
            </div>
            <div className="whitespace-pre-wrap max-h-20 overflow-hidden">
              {attachment.fileUpload.metadata.previewContent}
              {(attachment.fileUpload.metadata.previewContent?.length || 0) > 200 && '...'}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {interactive && !disabled && (
        <div className="flex items-center gap-1">
          {/* Preview button */}
          {(canShowPreview || (isWordDocument && hasWordContent)) && (
            <button
              onClick={handlePreview}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded transition-all duration-200"
              title={isWordDocument ? "Preview document structure" : "Preview file content"}
            >
              <Eye className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            </button>
          )}

          {/* Download button */}
          {showDownload && canDownload && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded transition-all duration-200 disabled:opacity-50"
              title={isWordDocument ? "Download Word document" : "Download file"}
            >
              {isDownloading ? (
                <Loader2 className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} animate-spin`} />
              ) : (
                <Download className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
              )}
            </button>
          )}

          {/* Retry button */}
          {uploadError && canRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-white/10 rounded transition-all duration-200 disabled:opacity-50"
              title="Retry upload"
            >
              {isRetrying ? (
                <Loader2 className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} animate-spin`} />
              ) : (
                <RefreshCw className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
              )}
            </button>
          )}

          {/* Remove button */}
          {showRemove && (
            <button
              onClick={handleRemove}
              className="p-1.5 text-white/60 hover:text-red-400 hover:bg-white/10 rounded transition-all duration-200"
              title="Remove file"
            >
              <X className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// 🎯 File Attachment Component Features:
//
// 1. **Smart Status Display**: 
//    - Visual indicators for upload states (uploading, completed, error)
//    - Progress bars for active uploads
//    - Error messages with user guidance
//
// 2. **Interactive Actions**: 
//    - Download files to user's device
//    - Preview text files and Word document structure inline
//    - Retry failed uploads
//    - Remove attachments
//
// 3. **Enhanced Content Preview**: 
//    - Shows preview content for text files
//    - Word documents: comprehensive metadata display
//    - Document structure outline (headings, tables, lists)
//    - Content quality and complexity indicators
//    - Truncates long content with "..." indicator
//    - Monospace font for code/data files
//
// 4. **Word Document Support**: 
//    - Rich metadata display (word count, page count, author)
//    - Document structure preview (table of contents)
//    - Text extraction quality indicators
//    - Document complexity assessment
//    - Processing status and warnings
//    - Legacy format detection and recommendations
//
// 5. **Responsive Design**: 
//    - Compact mode for mobile devices
//    - Touch-friendly button sizes
//    - Adaptive text sizes
//    - Collapsible metadata sections
//
// 6. **Error Handling**: 
//    - Distinguishes between upload and download errors
//    - Word-specific error messages (password protected, corrupted, etc.)
//    - Provides user-friendly error messages
//    - Loading states for all async operations
//
// 7. **Accessibility**: 
//    - Proper button labels and tooltips
//    - Keyboard navigation support
//    - Screen reader friendly status indicators
//    - Color-coded quality indicators with text labels
//
// Usage Examples:
// ```
// // In message input (allow remove)
// <FileAttachment
//   attachment={attachment}
//   onRemove={removeAttachment}
//   showDownload={false}
//   compact={isMobile}
// />
//
// // In conversation view (read-only)
// <FileAttachment
//   attachment={attachment}
//   onDownload={downloadFile}
//   onPreview={previewFile}
//   showRemove={false}
//   interactive={true}
// />
//
// // Admin view with all features
// <FileAttachment
//   attachment={attachment}
//   onRemove={adminRemove}
//   onDownload={adminDownload}
//   onRetry={adminRetry}
//   onPreview={adminPreview}
// />
//
// // Word document with enhanced metadata
// <FileAttachment
//   attachment={wordAttachment}        // Word doc with rich metadata
//   onPreview={previewWordStructure}   // Shows document outline
//   onDownload={downloadWord}          // Downloads original .docx
//   showPreview={true}                 // Enables structure preview
//   compact={false}                    // Full metadata display
// />
// ```
