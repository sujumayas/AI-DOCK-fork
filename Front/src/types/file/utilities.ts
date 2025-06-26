// File utilities and helper functions for AI Dock

import { 
  FileUpload, 
  FileMetadata,
  PDFMetadata,
  WordMetadata,
  PDFTextQuality,
  WordTextQuality,
  WordStructureComplexity
} from './core';
import { FileValidationResult } from './validation';
import { 
  MAX_FILE_SIZE,
  MAX_PDF_FILE_SIZE,
  MAX_WORD_FILE_SIZE,
  MAX_FILENAME_LENGTH,
  MAX_PDF_PAGES,
  MAX_WORD_PAGES,
  SUPPORTED_FILE_TYPES,
  SUPPORTED_FILE_EXTENSIONS,
  FILE_TYPE_ICONS,
  FILE_EXTENSION_ICONS
} from './constants';

/**
 * Generate unique file ID
 */
export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new file upload instance
 */
export function createFileUpload(file: File): FileUpload {
  const validation = validateFileDetailed(file);
  
  return {
    id: generateFileId(),
    file,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
    metadata: {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified),
      isValid: validation.isValid && isSupportedFileType(file) && isValidFileSize(file),
      validationErrors: validation.blockingErrors // Only store blocking errors in metadata
    }
  };
}

/**
 * Validate a file and return separate blocking errors and warnings
 */
export function validateFileDetailed(file: File): FileValidationResult {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  
  // Check file type support
  if (!isSupportedFileType(file)) {
    blockingErrors.push(`File type "${file.type}" is not supported`);
  }
  
  // Check file size
  if (!isValidFileSize(file)) {
    if (file.size === 0) {
      blockingErrors.push('File is empty');
    } else {
      let maxSize = MAX_FILE_SIZE;
      let maxSizeLabel = '10MB';
      
      if (isPDFFile(file)) {
        maxSize = MAX_PDF_FILE_SIZE;
        maxSizeLabel = '25MB';
      } else if (isWordFile(file)) {
        maxSize = MAX_WORD_FILE_SIZE;
        maxSizeLabel = '20MB';
      }
      
      blockingErrors.push(`File size ${formatFileSize(file.size)} exceeds limit of ${maxSizeLabel}`);
    }
  }
  
  // Check filename length
  if (file.name.length > MAX_FILENAME_LENGTH) {
    blockingErrors.push(`Filename is too long (max ${MAX_FILENAME_LENGTH} characters)`);
  }
  
  // PDF-specific validation warnings (non-blocking)
  if (isPDFFile(file)) {
    if (file.size > 20 * 1024 * 1024) { // Warn for files > 20MB
      warnings.push('Large PDF files may take longer to process');
    }
  }
  
  // Word document-specific validation warnings (non-blocking)
  if (isWordFile(file)) {
    if (file.size > 15 * 1024 * 1024) { // Warn for files > 15MB
      warnings.push('Large Word documents may take longer to process');
    }
    
    // Check for legacy .doc format - this is a WARNING, not a blocking error
    if (file.name.toLowerCase().endsWith('.doc')) {
      warnings.push('Legacy .doc format detected. Consider converting to .docx for better processing.');
    }
  }
  
  return {
    blockingErrors,
    warnings,
    isValid: blockingErrors.length === 0
  };
}

/**
 * Legacy function for backward compatibility - only returns blocking errors
 */
export function validateFile(file: File): string[] {
  const result = validateFileDetailed(file);
  return result.blockingErrors;
}

/**
 * Check if a file type is supported
 */
export function isSupportedFileType(file: File): boolean {
  return SUPPORTED_FILE_TYPES.includes(file.type) || 
         SUPPORTED_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
}

/**
 * Check if a file size is within limits
 */
export function isValidFileSize(file: File): boolean {
  let maxSize = MAX_FILE_SIZE;
  
  if (isPDFFile(file)) {
    maxSize = MAX_PDF_FILE_SIZE;
  } else if (isWordFile(file)) {
    maxSize = MAX_WORD_FILE_SIZE;
  }
  
  return file.size <= maxSize && file.size > 0;
}

/**
 * Check if a file is a PDF
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || 
         file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Check if a file is a Word document
 */
export function isWordFile(file: File): boolean {
  return file.type === 'application/msword' || 
         file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.doc') ||
         file.name.toLowerCase().endsWith('.docx');
}

/**
 * Check if a file upload is in progress
 */
export function isUploadInProgress(upload: FileUpload): boolean {
  return ['uploading', 'processing'].includes(upload.status);
}

/**
 * Check if a file upload completed successfully
 */
export function isUploadCompleted(upload: FileUpload): boolean {
  return upload.status === 'completed' && !!upload.uploadedFileId;
}

/**
 * Check if a file upload has errors
 */
export function hasUploadError(upload: FileUpload): boolean {
  return upload.status === 'error' || !!upload.error;
}

/**
 * Check if file upload can be retried
 */
export function canRetryUpload(upload: FileUpload): boolean {
  return upload.status === 'error' && 
         (!upload.error || upload.error.isRetryable);
}

/**
 * Check if a file has PDF metadata
 */
export function hasPDFMetadata(metadata: FileMetadata): boolean {
  return !!metadata.pdfMetadata;
}

/**
 * Check if PDF text extraction was successful
 */
export function isPDFTextExtractionSuccessful(pdfMetadata: PDFMetadata): boolean {
  return pdfMetadata.hasText && 
         pdfMetadata.textExtractionQuality !== 'failed' &&
         pdfMetadata.extractedTextLength > 0;
}

/**
 * Check if PDF is suitable for AI processing
 */
export function isPDFSuitableForAI(pdfMetadata: PDFMetadata): boolean {
  return isPDFTextExtractionSuccessful(pdfMetadata) &&
         !pdfMetadata.isPasswordProtected &&
         pdfMetadata.pageCount <= MAX_PDF_PAGES;
}

/**
 * Check if a file has Word metadata
 */
export function hasWordMetadata(metadata: FileMetadata): boolean {
  return !!metadata.wordMetadata;
}

/**
 * Check if Word text extraction was successful
 */
export function isWordTextExtractionSuccessful(wordMetadata: WordMetadata): boolean {
  return wordMetadata.textExtractionQuality !== 'failed' &&
         wordMetadata.extractedTextLength > 0 &&
         wordMetadata.wordCount > 0;
}

/**
 * Check if Word document is suitable for AI processing
 */
export function isWordSuitableForAI(wordMetadata: WordMetadata): boolean {
  return isWordTextExtractionSuccessful(wordMetadata) &&
         !wordMetadata.isPasswordProtected &&
         !wordMetadata.hasMacros &&
         wordMetadata.pageCount <= MAX_WORD_PAGES &&
         wordMetadata.structureComplexity !== 'very_complex';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
}

/**
 * Get file icon based on type
 */
export function getFileIcon(file: File | FileMetadata): string {
  const type = 'type' in file ? file.type : file.file.type;
  const name = 'name' in file ? file.name : file.file.name;
  
  // Check by MIME type first
  if (FILE_TYPE_ICONS[type]) {
    return FILE_TYPE_ICONS[type];
  }
  
  // Check by file extension
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension && FILE_EXTENSION_ICONS[extension]) {
    return FILE_EXTENSION_ICONS[extension];
  }
  
  return '📄'; // Default file icon
}

/**
 * Calculate upload speed
 */
export function calculateUploadSpeed(loaded: number, elapsedTime: number): number {
  return elapsedTime > 0 ? Math.round(loaded / elapsedTime) : 0;
}

/**
 * Estimate remaining upload time
 */
export function estimateRemainingTime(loaded: number, total: number, speed: number): number {
  if (speed === 0) return Infinity;
  const remaining = total - loaded;
  return Math.round(remaining / speed);
}

/**
 * Format PDF metadata for display
 */
export function formatPDFMetadata(pdfMetadata: PDFMetadata): string {
  const parts = [];
  
  parts.push(`${pdfMetadata.pageCount} page${pdfMetadata.pageCount !== 1 ? 's' : ''}`);
  
  if (pdfMetadata.totalWords > 0) {
    parts.push(`${pdfMetadata.totalWords.toLocaleString()} words`);
  }
  
  if (pdfMetadata.author) {
    parts.push(`by ${pdfMetadata.author}`);
  }
  
  return parts.join(' • ');
}

/**
 * Get PDF text quality description
 */
export function getPDFQualityDescription(quality: PDFTextQuality): string {
  const descriptions = {
    'excellent': 'Excellent text quality',
    'good': 'Good text quality',
    'fair': 'Fair text quality',
    'poor': 'Poor text quality',
    'failed': 'Text extraction failed'
  };
  
  return descriptions[quality];
}

/**
 * Get PDF processing status message
 */
export function getPDFProcessingStatus(pdfMetadata: PDFMetadata): string {
  if (!pdfMetadata.hasText) {
    return 'No extractable text found';
  }
  
  if (pdfMetadata.isPasswordProtected) {
    return 'Password protected';
  }
  
  if (!isPDFTextExtractionSuccessful(pdfMetadata)) {
    return 'Text extraction failed';
  }
  
  if (pdfMetadata.pageCount > MAX_PDF_PAGES) {
    return `Too many pages (${pdfMetadata.pageCount}/${MAX_PDF_PAGES})`;
  }
  
  return 'Ready for AI analysis';
}

/**
 * Format Word metadata for display
 */
export function formatWordMetadata(wordMetadata: WordMetadata): string {
  const parts = [];
  
  parts.push(`${wordMetadata.pageCount} page${wordMetadata.pageCount !== 1 ? 's' : ''}`);
  
  if (wordMetadata.wordCount > 0) {
    parts.push(`${wordMetadata.wordCount.toLocaleString()} words`);
  }
  
  if (wordMetadata.author) {
    parts.push(`by ${wordMetadata.author}`);
  }
  
  return parts.join(' • ');
}

/**
 * Get Word text quality description
 */
export function getWordQualityDescription(quality: WordTextQuality): string {
  const descriptions = {
    'excellent': 'Excellent text quality',
    'good': 'Good text quality',
    'fair': 'Fair text quality',
    'poor': 'Poor text quality',
    'failed': 'Text extraction failed'
  };
  
  return descriptions[quality];
}

/**
 * Get Word structure complexity description
 */
export function getWordComplexityDescription(complexity: WordStructureComplexity): string {
  const descriptions = {
    'simple': 'Simple document structure',
    'moderate': 'Moderate document structure',
    'complex': 'Complex document structure',
    'very_complex': 'Very complex document structure'
  };
  
  return descriptions[complexity];
}

/**
 * Get Word processing status message
 */
export function getWordProcessingStatus(wordMetadata: WordMetadata): string {
  if (wordMetadata.isPasswordProtected) {
    return 'Password protected';
  }
  
  if (wordMetadata.hasMacros) {
    return 'Contains macros';
  }
  
  if (!isWordTextExtractionSuccessful(wordMetadata)) {
    return 'Text extraction failed';
  }
  
  if (wordMetadata.pageCount > MAX_WORD_PAGES) {
    return `Too many pages (${wordMetadata.pageCount}/${MAX_WORD_PAGES})`;
  }
  
  if (wordMetadata.structureComplexity === 'very_complex') {
    return 'Document too complex';
  }
  
  return 'Ready for AI analysis';
}

/**
 * Extract Word document outline for display
 */
export function extractWordOutline(wordMetadata: WordMetadata): string[] {
  if (!wordMetadata.documentStructure) {
    return [];
  }
  
  return wordMetadata.documentStructure
    .filter(element => element.type === 'heading')
    .slice(0, 5) // Show only first 5 headings for preview
    .map(heading => {
      const indent = '  '.repeat((heading.level || 1) - 1);
      return `${indent}${heading.text}`;
    });
}

/**
 * Check if a Word document has complex structure
 */
export function isWordStructureComplex(wordMetadata: WordMetadata): boolean {
  return wordMetadata.structureComplexity === 'complex' ||
         wordMetadata.structureComplexity === 'very_complex' ||
         wordMetadata.tableCount > 10 ||
         wordMetadata.imageCount > 20 ||
         wordMetadata.sectionCount > 15;
}

/**
 * Check if Word document processing should be attempted
 */
export function shouldProcessWordDocument(wordMetadata: WordMetadata): boolean {
  return !wordMetadata.isPasswordProtected &&
         !wordMetadata.hasMacros &&
         wordMetadata.pageCount <= MAX_WORD_PAGES;
}

/**
 * Check if a file attachment can be downloaded
 * Since we only store extracted text (not original files), this checks if processed content is available
 * 
 * @param attachment - The file attachment to check
 * @returns true if the attachment content can be downloaded, false otherwise
 * 
 * @example
 * ```typescript
 * const attachment = getFileAttachment();
 * if (isAttachmentDownloadable(attachment)) {
 *   // Show download button and allow download of extracted text
 *   enableDownloadButton();
 * }
 * ```
 */
export function isAttachmentDownloadable(attachment: import('./core').FileAttachment): boolean {
  // Must have a valid attachment object
  if (!attachment) {
    return false;
  }

  const { fileUpload, isProcessed, processingError, extractedText, expiresAt } = attachment;
  
  // Basic file upload must exist and be completed
  if (!fileUpload || !isUploadCompleted(fileUpload)) {
    return false;
  }
  
  // Must not have upload errors that prevent processing
  if (hasUploadError(fileUpload)) {
    return false;
  }
  
  // Must be processed successfully
  if (!isProcessed) {
    return false;
  }
  
  // Must not have processing errors
  if (processingError) {
    return false;
  }
  
  // Must have extracted text content available for download
  // (Since we only save text, not original files)
  if (!extractedText || extractedText.trim().length === 0) {
    return false;
  }
  
  // Must not be expired
  if (expiresAt && new Date() > expiresAt) {
    return false;
  }
  
  // Additional checks for specific file types
  const fileMetadata = fileUpload.metadata;
  if (fileMetadata) {
    // For PDF files, ensure text extraction was successful
    if (isPDFFile(fileUpload.file) && hasPDFMetadata(fileMetadata)) {
      const pdfMetadata = fileMetadata.pdfMetadata;
      if (pdfMetadata && !isPDFTextExtractionSuccessful(pdfMetadata)) {
        return false;
      }
    }
    
    // For Word files, ensure text extraction was successful
    if (isWordFile(fileUpload.file) && hasWordMetadata(fileMetadata)) {
      const wordMetadata = fileMetadata.wordMetadata;
      if (wordMetadata && !isWordTextExtractionSuccessful(wordMetadata)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Check if a Word document has a valid binary signature
 * This prevents uploading text files renamed as .doc/.docx
 */
export async function validateWordDocumentSignature(file: File): Promise<boolean> {
  try {
    // Read first 4 bytes to check signature
    const arrayBuffer = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    if (file.name.toLowerCase().endsWith('.docx')) {
      // .docx files should start with PK (ZIP signature)
      return bytes[0] === 0x50 && bytes[1] === 0x4B; // "PK"
    } else if (file.name.toLowerCase().endsWith('.doc')) {
      // .doc files should start with OLE signature
      return (
        (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) || // Standard OLE
        (bytes[0] === 0x0D && bytes[1] === 0x44 && bytes[2] === 0x4F && bytes[3] === 0x43) || // Some .doc variants
        (bytes[0] === 0xDB && bytes[1] === 0xA5 && bytes[2] === 0x2D && bytes[3] === 0x00)    // Other .doc variants
      );
    }
    
    return true; // For other file types or unknown extensions
  } catch (error) {
    console.warn('Error validating Word document signature:', error);
    return true; // Allow upload on validation error, let backend handle it
  }
}
