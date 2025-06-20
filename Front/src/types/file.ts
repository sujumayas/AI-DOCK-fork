// AI Dock File Upload Types
// TypeScript interfaces for file upload and attachment functionality
// This file contains ONLY file-related types

// =============================================================================
// CORE FILE TYPES
// =============================================================================

export interface FileUpload {
  // File identification
  id: string;                    // Unique identifier for this upload
  file: File;                   // The actual browser File object
  
  // Upload state
  status: FileUploadStatus;
  progress: number;             // 0-100 percentage
  
  // Server response data (after successful upload)
  uploadedFileId?: string;      // Server-assigned file ID
  serverPath?: string;          // Server file path
  downloadUrl?: string;         // URL to download the file
  
  // Error information
  error?: FileError;
  
  // Timestamps
  createdAt: Date;
  startedAt?: Date;             // When upload began
  completedAt?: Date;           // When upload finished
  
  // Metadata
  metadata?: FileMetadata;
}

export interface FileMetadata {
  // Basic file info
  name: string;
  size: number;                 // Size in bytes
  type: string;                 // MIME type
  lastModified: Date;
  
  // File processing info
  isValid: boolean;             // Passed validation
  validationErrors?: string[];   // Specific validation issues
  
  // Content analysis (populated after upload)
  encoding?: string;            // File encoding (e.g., 'utf-8')
  lineCount?: number;           // For text files
  characterCount?: number;      // For text files
  previewContent?: string;      // First few lines for preview
  
  // PDF-specific metadata (populated for PDF files)
  pdfMetadata?: PDFMetadata;    // PDF-specific information
  
  // Word-specific metadata (populated for Word documents)
  wordMetadata?: WordMetadata;  // Word document-specific information
  
  // Security and processing
  scannedAt?: Date;            // When file was security scanned
  processedAt?: Date;          // When file was processed for content
  contentType?: FileContentType; // Categorized content type
  
  // User context
  uploadedBy?: string;         // User who uploaded (usually from auth)
  uploadedFromIp?: string;     // IP address of uploader
  uploadSession?: string;      // Session/request ID for tracking
}

// =============================================================================
// PDF-SPECIFIC TYPES
// =============================================================================

export interface PDFMetadata {
  // Document information
  title?: string;              // PDF document title
  author?: string;             // PDF document author
  subject?: string;            // PDF document subject
  creator?: string;            // Application that created the PDF
  producer?: string;           // PDF producer/converter
  keywords?: string[];         // PDF keywords/tags
  
  // Document structure
  pageCount: number;           // Total number of pages
  hasText: boolean;            // Whether PDF contains extractable text
  hasImages: boolean;          // Whether PDF contains images
  hasFormFields: boolean;      // Whether PDF has form fields
  
  // Content analysis
  extractedTextLength: number; // Length of extracted text
  totalWords: number;          // Total word count across all pages
  averageWordsPerPage: number; // Average words per page
  textExtractionQuality: PDFTextQuality; // Quality of text extraction
  
  // Document dates
  creationDate?: Date;         // When PDF was created
  modificationDate?: Date;     // When PDF was last modified
  
  // Security and access
  isPasswordProtected: boolean; // Whether PDF requires password
  hasPermissions: boolean;     // Whether PDF has usage restrictions
  allowsCopying: boolean;      // Whether text copying is allowed
  allowsPrinting: boolean;     // Whether printing is allowed
  
  // Processing information
  processingTime: number;      // Time taken to process PDF (ms)
  extractionMethod: 'PyPDF2' | 'pdfplumber' | 'other'; // Tool used for extraction
  processingWarnings?: string[]; // Non-fatal processing issues
  
  // Content preview
  firstPagePreview?: string;   // Text from first page for preview
  tableOfContents?: PDFTOCEntry[]; // Table of contents if available
}

export interface PDFTOCEntry {
  title: string;               // TOC entry title
  pageNumber: number;          // Page number for this entry
  level: number;               // Heading level (1-6)
  children?: PDFTOCEntry[];    // Nested TOC entries
}

export interface PDFPage {
  pageNumber: number;          // Page number (1-indexed)
  text: string;                // Extracted text from this page
  wordCount: number;           // Number of words on this page
  hasImages: boolean;          // Whether this page contains images
  extractionQuality: PDFTextQuality; // Quality of text extraction for this page
}

export interface PDFProcessingResult {
  // Overall result
  success: boolean;            // Whether processing was successful
  metadata: PDFMetadata;       // PDF metadata and analysis
  
  // Extracted content
  fullText: string;            // Complete extracted text
  pages: PDFPage[];            // Per-page extracted content
  
  // Processing details
  processingTime: number;      // Total processing time (ms)
  errors: string[];            // Processing errors
  warnings: string[];          // Processing warnings
  
  // Content summary
  summary?: string;            // AI-generated summary for large docs
  keyTopics?: string[];        // Extracted key topics/themes
}

// =============================================================================
// WORD DOCUMENT-SPECIFIC TYPES
// =============================================================================

export interface WordMetadata {
  // Document information
  title?: string;              // Word document title
  author?: string;             // Word document author
  subject?: string;            // Word document subject
  company?: string;            // Company/organization
  manager?: string;            // Document manager
  category?: string;           // Document category
  keywords?: string[];         // Document keywords/tags
  comments?: string;           // Document comments
  
  // Document structure
  pageCount: number;           // Total number of pages
  wordCount: number;           // Total word count
  characterCount: number;      // Total character count
  paragraphCount: number;      // Total paragraph count
  sectionCount: number;        // Number of sections/headings
  
  // Content analysis
  hasImages: boolean;          // Whether document contains images
  hasTableOfContents: boolean; // Whether document has TOC
  hasHeaders: boolean;         // Whether document has headers
  hasFooters: boolean;         // Whether document has footers
  hasFootnotes: boolean;       // Whether document has footnotes
  hasComments: boolean;        // Whether document has comments
  hasRevisions: boolean;       // Whether document has tracked changes
  hasHyperlinks: boolean;      // Whether document contains hyperlinks
  
  // Structure analysis
  headingLevels: number[];     // Heading levels present (1-6)
  tableCount: number;          // Number of tables
  listCount: number;           // Number of lists
  imageCount: number;          // Number of images
  hyperlinkCount: number;      // Number of hyperlinks
  
  // Content quality
  extractedTextLength: number; // Length of extracted text
  textExtractionQuality: WordTextQuality; // Quality of text extraction
  structureComplexity: WordStructureComplexity; // Document structure complexity
  
  // Document dates
  creationDate?: Date;         // When document was created
  modificationDate?: Date;     // When document was last modified
  lastPrintDate?: Date;        // When document was last printed
  
  // Security and access
  isPasswordProtected: boolean; // Whether document requires password
  hasRestrictedEditing: boolean; // Whether editing is restricted
  isReadOnly: boolean;         // Whether document is read-only
  hasMacros: boolean;          // Whether document contains macros
  
  // Processing information
  processingTime: number;      // Time taken to process document (ms)
  extractionMethod: 'python-docx' | 'docx2txt' | 'mammoth' | 'other'; // Tool used for extraction
  processingWarnings?: string[]; // Non-fatal processing issues
  
  // Content preview
  firstPagePreview?: string;   // Text from first page for preview
  documentStructure?: WordStructureElement[]; // Document structure outline
  
  // Language and readability
  language?: string;           // Document language
  readabilityScore?: number;   // Readability score (0-100)
  averageWordsPerSentence?: number; // Writing complexity metric
  averageSentencesPerParagraph?: number; // Document structure metric
}

export interface WordStructureElement {
  type: WordElementType;       // Type of document element
  level?: number;              // Heading level (1-6) for headings
  text: string;                // Element text content
  position: number;            // Position in document
  pageNumber?: number;         // Page number where element appears
  children?: WordStructureElement[]; // Nested elements
  
  // Additional properties for specific element types
  tableData?: string[][];      // Table cell data for tables
  listItems?: string[];        // List items for lists
  imageAlt?: string;           // Alt text for images
  hyperlinkUrl?: string;       // URL for hyperlinks
  styleInfo?: WordStyleInfo;   // Formatting information
}

export interface WordStyleInfo {
  isBold?: boolean;            // Text is bold
  isItalic?: boolean;          // Text is italic
  isUnderline?: boolean;       // Text is underlined
  fontSize?: number;           // Font size in points
  fontFamily?: string;         // Font family name
  color?: string;              // Text color
  backgroundColor?: string;    // Background color
  alignment?: 'left' | 'center' | 'right' | 'justify'; // Text alignment
}

export interface WordTable {
  id: string;                  // Unique table identifier
  position: number;            // Position in document
  pageNumber?: number;         // Page number where table appears
  rowCount: number;            // Number of rows
  columnCount: number;         // Number of columns
  headers?: string[];          // Table headers (first row)
  data: string[][];            // Table cell data
  caption?: string;            // Table caption if present
  hasHeaders: boolean;         // Whether first row contains headers
  tableStyle?: string;         // Applied table style
}

export interface WordList {
  id: string;                  // Unique list identifier
  type: 'bulleted' | 'numbered' | 'outline'; // List type
  position: number;            // Position in document
  pageNumber?: number;         // Page number where list appears
  items: WordListItem[];       // List items with hierarchy
  style?: string;              // Applied list style
}

export interface WordListItem {
  text: string;                // Item text content
  level: number;               // Nesting level (0-based)
  number?: string;             // Item number/bullet character
  children?: WordListItem[];   // Nested list items
}

export interface WordProcessingResult {
  // Overall result
  success: boolean;            // Whether processing was successful
  metadata: WordMetadata;      // Word document metadata and analysis
  
  // Extracted content
  fullText: string;            // Complete extracted text
  structuredContent: WordStructureElement[]; // Structured content elements
  
  // Specific content types
  tables: WordTable[];         // Extracted tables
  lists: WordList[];           // Extracted lists
  images: WordImageInfo[];     // Image information
  hyperlinks: WordHyperlink[]; // Hyperlink information
  
  // Processing details
  processingTime: number;      // Total processing time (ms)
  errors: string[];            // Processing errors
  warnings: string[];          // Processing warnings
  
  // Content summary
  summary?: string;            // AI-generated summary for large docs
  keyTopics?: string[];        // Extracted key topics/themes
  headingOutline?: WordHeading[]; // Document outline based on headings
}

export interface WordImageInfo {
  id: string;                  // Unique image identifier
  position: number;            // Position in document
  pageNumber?: number;         // Page number where image appears
  altText?: string;            // Alternative text
  caption?: string;            // Image caption
  width?: number;              // Image width
  height?: number;             // Image height
  format?: string;             // Image format (png, jpg, etc.)
  description?: string;        // AI-generated description
}

export interface WordHyperlink {
  id: string;                  // Unique hyperlink identifier
  text: string;                // Display text
  url: string;                 // Target URL
  position: number;            // Position in document
  pageNumber?: number;         // Page number where link appears
  isExternal: boolean;         // Whether link points outside document
  isEmail: boolean;            // Whether link is an email address
}

export interface WordHeading {
  id: string;                  // Unique heading identifier
  level: number;               // Heading level (1-6)
  text: string;                // Heading text
  position: number;            // Position in document
  pageNumber?: number;         // Page number where heading appears
  children?: WordHeading[];    // Sub-headings
  wordCount?: number;          // Word count of content under this heading
}

export interface UploadProgress {
  // Progress tracking
  fileId: string;              // Reference to FileUpload.id
  loaded: number;              // Bytes uploaded so far
  total: number;               // Total bytes to upload
  percentage: number;          // Calculated percentage (0-100)
  
  // Speed and timing
  speed: number;               // Upload speed in bytes/second
  estimatedTimeRemaining: number; // Seconds remaining
  elapsedTime: number;         // Seconds elapsed since start
  
  // Chunked upload info (for large files)
  chunkIndex?: number;         // Current chunk being uploaded
  totalChunks?: number;        // Total chunks for this file
  chunkSize?: number;          // Size of each chunk
  
  // Network info
  retriesAttempted: number;    // Number of retry attempts
  lastError?: FileError;       // Last error encountered
}

export interface FileError {
  // Error classification
  type: FileErrorType;
  code: string;                // Machine-readable error code
  message: string;             // Human-readable error message
  
  // Context information
  fileId?: string;             // Which file caused the error
  fileName?: string;           // File name for user context
  
  // Technical details
  httpStatus?: number;         // HTTP status code if network error
  serverMessage?: string;      // Error message from server
  details?: Record<string, unknown>; // Additional error context
  
  // Timing and retry info
  timestamp: Date;             // When error occurred
  isRetryable: boolean;        // Whether this error can be retried
  retryAfter?: number;         // Seconds to wait before retry
  
  // User guidance
  userAction?: string;         // Suggested action for user
  documentationUrl?: string;   // Link to help documentation
}

// =============================================================================
// FILE ATTACHMENT TYPES
// =============================================================================

export interface FileAttachment {
  // Attachment identification
  id: string;                  // Unique attachment ID
  messageId?: string;          // Associated message ID
  conversationId?: number;     // Associated conversation ID
  
  // File reference
  fileUpload: FileUpload;      // Reference to the uploaded file
  
  // Display preferences
  displayName?: string;        // Custom name for display
  description?: string;        // User-provided description
  isVisible: boolean;          // Whether to show in UI
  
  // Processing state
  isProcessed: boolean;        // Whether file content was processed
  processingError?: string;    // Error during content processing
  extractedText?: string;      // Extracted text content
  
  // Usage tracking
  downloadCount: number;       // How many times downloaded
  lastAccessedAt?: Date;       // Last time file was accessed
  
  // Lifecycle
  createdAt: Date;
  updatedAt?: Date;
  expiresAt?: Date;           // When attachment expires (if applicable)
}

// =============================================================================
// DRAG AND DROP TYPES
// =============================================================================

export interface DragDropState {
  // Current drag state
  isDragActive: boolean;       // Something is being dragged over
  isDragAccept: boolean;       // Dragged items are acceptable
  isDragReject: boolean;       // Dragged items are rejected
  
  // Files being dragged
  draggedFiles: File[];        // Files currently being dragged
  
  // Validation state
  acceptedFiles: File[];       // Files that passed validation
  rejectedFiles: FileRejection[]; // Files that failed validation
  
  // UI state
  dropZoneActive: boolean;     // Whether drop zone is highlighted
  showDropPreview: boolean;    // Whether to show file preview
}

export interface FileRejection {
  file: File;                  // The rejected file
  errors: FileValidationError[]; // Why it was rejected
}

export interface FileValidationError {
  code: FileValidationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export interface FileUploadUIState {
  // Upload management
  uploads: FileUpload[];       // All current uploads
  attachments: FileAttachment[]; // All current attachments
  
  // UI state
  isUploading: boolean;        // Any uploads in progress
  showUploadZone: boolean;     // Whether upload zone is visible
  showAttachments: boolean;    // Whether attachments are visible
  
  // Drag and drop
  dragDrop: DragDropState;
  
  // Progress and feedback
  overallProgress: number;     // Overall upload progress (0-100)
  successCount: number;        // Number of successful uploads
  errorCount: number;          // Number of failed uploads
  
  // Configuration
  maxFiles: number;            // Maximum files allowed
  maxSize: number;             // Maximum file size in bytes
  acceptedTypes: string[];     // Accepted MIME types
  
  // Error state
  errors: FileError[];         // Current errors
  warnings: string[];          // Non-critical warnings
}

// =============================================================================
// ENUMS AND UNIONS
// =============================================================================

export type FileUploadStatus = 
  | 'pending'      // File selected but not started
  | 'uploading'    // Upload in progress
  | 'processing'   // Upload complete, server processing
  | 'completed'    // Upload and processing complete
  | 'error'        // Upload failed
  | 'cancelled'    // Upload was cancelled
  | 'paused';      // Upload temporarily paused

export type FileErrorType =
  | 'VALIDATION_ERROR'    // File failed validation (size, type, etc.)
  | 'NETWORK_ERROR'       // Network/connection issues
  | 'SERVER_ERROR'        // Server-side error
  | 'TIMEOUT_ERROR'       // Upload timed out
  | 'QUOTA_EXCEEDED'      // User quota exceeded
  | 'SECURITY_ERROR'      // Security/malware scan failed
  | 'PROCESSING_ERROR'    // File processing failed
  | 'PERMISSION_ERROR'    // User lacks permission
  | 'FILE_EXISTS_ERROR'   // File already exists
  | 'STORAGE_ERROR';      // Server storage issues

export type FileContentType =
  | 'text/plain'          // Plain text files
  | 'text/markdown'       // Markdown files
  | 'text/csv'           // CSV data files
  | 'application/json'    // JSON data files
  | 'text/code'          // Source code files
  | 'application/pdf'     // PDF documents
  | 'application/msword'  // Word documents
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx documents
  | 'application/other'   // Other/unknown files
  | 'binary/unsupported'; // Binary files (not supported)

export type PDFTextQuality =
  | 'excellent'           // Clean, well-formatted text extraction
  | 'good'               // Mostly readable with minor formatting issues
  | 'fair'               // Readable but with formatting problems
  | 'poor'               // Difficult to read, significant extraction issues
  | 'failed';            // Text extraction failed or no text available

export type WordTextQuality =
  | 'excellent'           // Clean, well-formatted text extraction with full structure
  | 'good'               // Mostly readable with minor formatting issues
  | 'fair'               // Readable but with some structure loss
  | 'poor'               // Difficult to read, significant structure issues
  | 'failed';            // Text extraction failed or document corrupted

export type WordStructureComplexity =
  | 'simple'             // Basic document with minimal formatting
  | 'moderate'           // Standard document with headers, lists, tables
  | 'complex'            // Advanced formatting with multiple sections
  | 'very_complex';      // Highly complex with nested elements, macros, etc.

export type WordElementType =
  | 'heading'            // Document heading (h1-h6)
  | 'paragraph'          // Regular text paragraph
  | 'table'              // Data table
  | 'list'               // Bulleted or numbered list
  | 'image'              // Embedded image
  | 'hyperlink'          // Hyperlink or reference
  | 'pagebreak'          // Page break
  | 'sectionbreak'       // Section break
  | 'header'             // Page header
  | 'footer'             // Page footer
  | 'footnote'           // Footnote reference
  | 'comment'            // Document comment
  | 'textbox'            // Text box or shape
  | 'equation'           // Mathematical equation
  | 'other';             // Other/unknown element type

export type FileValidationErrorCode =
  | 'file-too-large'      // File exceeds size limit
  | 'file-invalid-type'   // File type not allowed
  | 'too-many-files'      // Too many files selected
  | 'file-empty'          // File is empty
  | 'file-corrupt'        // File appears corrupted
  | 'filename-invalid'    // Invalid filename
  | 'pdf-password-protected' // PDF requires password
  | 'pdf-no-text'        // PDF contains no extractable text
  | 'pdf-processing-failed' // PDF processing failed
  | 'pdf-too-many-pages' // PDF has too many pages
  | 'word-password-protected' // Word document requires password
  | 'word-no-text'       // Word document contains no extractable text
  | 'word-processing-failed' // Word document processing failed
  | 'word-too-complex'   // Word document structure too complex
  | 'word-unsupported-format' // Word document format not supported
  | 'word-corrupted'     // Word document appears corrupted
  | 'word-macro-content' // Word document contains macros
  | 'word-too-many-pages'; // Word document has too many pages

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class FileUploadError extends Error {
  constructor(
    message: string,
    public errorType: FileErrorType,
    public statusCode?: number,
    public fileId?: string
  ) {
    super(message);
    this.name = 'FileUploadError';
  }
}

export class FileValidationFailedError extends Error {
  constructor(
    message: string,
    public validationErrors: FileValidationError[],
    public file: File
  ) {
    super(message);
    this.name = 'FileValidationFailedError';
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

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
 * Check if file upload can be retried
 */
export function canRetryUpload(upload: FileUpload): boolean {
  return upload.status === 'error' && 
         (!upload.error || upload.error.isRetryable);
}

/**
 * Check if attachment is downloadable
 */
export function isAttachmentDownloadable(attachment: FileAttachment): boolean {
  return isUploadCompleted(attachment.fileUpload) && 
         !!attachment.fileUpload.downloadUrl;
}

/**
 * Check if a file is a PDF
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || 
         file.name.toLowerCase().endsWith('.pdf');
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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

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
 * Generate unique file ID
 */
export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validation result with separate blocking errors and warnings
 */
export interface FileValidationResult {
  blockingErrors: string[];  // Errors that prevent upload
  warnings: string[];        // Warnings that don't block upload
  isValid: boolean;          // Whether file can be uploaded
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
    
    // Validate Word document signature asynchronously
    // Note: This is a non-blocking validation that will be performed separately
    // to avoid making validateFileDetailed async
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
 * Check if a file is a Word document
 */
export function isWordFile(file: File): boolean {
  return file.type === 'application/msword' || 
         file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.doc') ||
         file.name.toLowerCase().endsWith('.docx');
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
 * Check if Word document has complex structure
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

// =============================================================================
// CONSTANTS
// =============================================================================

// File size limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes for most files
export const MAX_PDF_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes for PDF files
export const MAX_WORD_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes for Word documents
export const MAX_FILES_PER_MESSAGE = 5;
export const MAX_FILENAME_LENGTH = 255;
export const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for large file uploads

// PDF-specific limits
export const MAX_PDF_PAGES = 50;        // Maximum pages to process
export const MAX_PDF_TEXT_LENGTH = 100 * 1024; // 100KB extracted text limit
export const PDF_PROCESSING_TIMEOUT = 30000;   // 30 seconds processing timeout

// Word document-specific limits
export const MAX_WORD_PAGES = 100;      // Maximum pages to process for Word docs
export const MAX_WORD_TEXT_LENGTH = 150 * 1024; // 150KB extracted text limit
export const WORD_PROCESSING_TIMEOUT = 45000;   // 45 seconds processing timeout
export const MAX_WORD_TABLES = 50;      // Maximum tables to process
export const MAX_WORD_IMAGES = 100;     // Maximum images to analyze

// Supported file types
export const SUPPORTED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/pdf',           // PDF documents
  'application/msword',        // Word documents (.doc)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Word documents (.docx)
  'text/x-markdown',
  'application/x-csv',
  'text/comma-separated-values'
];

export const SUPPORTED_FILE_EXTENSIONS = [
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.pdf',                      // PDF documents
  '.doc',                      // Word documents (legacy)
  '.docx',                     // Word documents (modern)
  '.markdown'
];

// Upload timeouts
export const UPLOAD_TIMEOUT = 60000; // 60 seconds
export const CHUNK_TIMEOUT = 30000;  // 30 seconds per chunk
export const RETRY_DELAYS = [1000, 2000, 4000, 8000]; // Exponential backoff

// File type icons mapping
export const FILE_TYPE_ICONS: Record<string, string> = {
  'text/plain': '📄',
  'text/markdown': '📝',
  'text/csv': '📊',
  'application/json': '🔧',
  'application/pdf': '📕',      // PDF documents
  'application/msword': '📗',   // Word documents (.doc)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘', // Word documents (.docx)
  'text/x-markdown': '📝',
  'application/x-csv': '📊',
  'text/comma-separated-values': '📊'
};

export const FILE_EXTENSION_ICONS: Record<string, string> = {
  'txt': '📄',
  'md': '📝',
  'markdown': '📝',
  'csv': '📊',
  'json': '🔧',
  'pdf': '📕',                 // PDF documents
  'doc': '📗',                 // Word documents (legacy)
  'docx': '📘'                 // Word documents (modern)
};

// Progress update intervals
export const PROGRESS_UPDATE_INTERVAL = 100; // Update progress every 100ms
export const UI_UPDATE_DEBOUNCE = 16; // ~60fps for UI updates

// Validation messages
export const VALIDATION_MESSAGES = {
  FILE_TOO_LARGE: 'File is too large. Maximum size allowed is',
  INVALID_FILE_TYPE: 'File type is not supported. Supported types are:',
  TOO_MANY_FILES: 'Too many files selected. Maximum allowed is',
  FILE_EMPTY: 'File is empty and cannot be uploaded',
  FILENAME_TOO_LONG: 'Filename is too long. Maximum length is',
  GENERIC_ERROR: 'An error occurred while processing the file',
  
  // PDF-specific validation messages
  PDF_PASSWORD_PROTECTED: 'This PDF is password-protected. Please provide an unlocked version.',
  PDF_NO_TEXT: 'This PDF appears to contain only images. Text extraction is not possible.',
  PDF_TOO_LARGE: 'PDF file is too large. Please use files smaller than 25MB.',
  PDF_PROCESSING_FAILED: 'Unable to process PDF. Please try a different file.',
  PDF_TOO_MANY_PAGES: 'PDF has too many pages. Maximum allowed is 50 pages.',
  PDF_CORRUPTED: 'PDF file appears to be corrupted. Please try uploading again.',
  
  // Word document-specific validation messages
  WORD_PASSWORD_PROTECTED: 'This Word document is password-protected. Please provide an unlocked version.',
  WORD_NO_TEXT: 'This Word document appears to contain no extractable text.',
  WORD_TOO_LARGE: 'Word document is too large. Please use files smaller than 20MB.',
  WORD_PROCESSING_FAILED: 'Unable to process Word document. Please try a different file.',
  WORD_TOO_MANY_PAGES: 'Word document has too many pages. Maximum allowed is 100 pages.',
  WORD_CORRUPTED: 'Word document appears to be corrupted. Please try uploading again.',
  WORD_UNSUPPORTED_FORMAT: 'This Word format is not supported. Please save as .docx format.',
  WORD_TOO_COMPLEX: 'Document structure is too complex to process. Please simplify formatting.',
  WORD_MACRO_CONTENT: 'Document contains macros or embedded content that cannot be processed.'
};
