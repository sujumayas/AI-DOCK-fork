// Core file types for AI Dock

// Import validation types
import type { FileValidationError } from './validation';

export interface FileUpload {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  uploadedFileId?: string;
  serverPath?: string;
  downloadUrl?: string;
  error?: FileError;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  isValid: boolean;
  validationErrors?: string[];
  encoding?: string;
  lineCount?: number;
  characterCount?: number;
  previewContent?: string;
  pdfMetadata?: PDFMetadata;
  wordMetadata?: WordMetadata;
  scannedAt?: Date;
  processedAt?: Date;
  contentType?: FileContentType;
  uploadedBy?: string;
  uploadedFromIp?: string;
  uploadSession?: string;
}

export interface FileAttachment {
  id: string;
  messageId?: string;
  conversationId?: number;
  fileUpload: FileUpload;
  displayName?: string;
  description?: string;
  isVisible: boolean;
  isProcessed: boolean;
  processingError?: string;
  extractedText?: string;
  downloadCount: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  expiresAt?: Date;
}

export interface FileError {
  type: FileErrorType;
  code: string;
  message: string;
  fileId?: string;
  fileName?: string;
  httpStatus?: number;
  serverMessage?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  isRetryable: boolean;
  retryAfter?: number;
  userAction?: string;
  documentationUrl?: string;
}

export interface UploadProgress {
  fileId: string;
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  estimatedTimeRemaining: number;
  elapsedTime: number;
  chunkIndex?: number;
  totalChunks?: number;
  chunkSize?: number;
  retriesAttempted: number;
  lastError?: FileError;
}

export interface DragDropState {
  isDragActive: boolean;
  isDragAccept: boolean;
  isDragReject: boolean;
  draggedFiles: File[];
  acceptedFiles: File[];
  rejectedFiles: FileRejection[];
  dropZoneActive: boolean;
  showDropPreview: boolean;
}

export interface FileRejection {
  file: File;
  errors: FileValidationError[];
}

export interface FileUploadUIState {
  uploads: FileUpload[];
  attachments: FileAttachment[];
  isUploading: boolean;
  showUploadZone: boolean;
  showAttachments: boolean;
  dragDrop: DragDropState;
  overallProgress: number;
  successCount: number;
  errorCount: number;
  maxFiles: number;
  maxSize: number;
  acceptedTypes: string[];
  errors: FileError[];
  warnings: string[];
}

export type FileUploadStatus = 
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'paused';

export type FileErrorType =
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'TIMEOUT_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'SECURITY_ERROR'
  | 'PROCESSING_ERROR'
  | 'PERMISSION_ERROR'
  | 'FILE_EXISTS_ERROR'
  | 'STORAGE_ERROR';

export type FileContentType =
  | 'text/plain'
  | 'text/markdown'
  | 'text/csv'
  | 'application/json'
  | 'text/code'
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/other'
  | 'binary/unsupported';



// Forward declarations for PDF and Word types
export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  keywords?: string[];
  pageCount: number;
  hasText: boolean;
  hasImages: boolean;
  hasFormFields: boolean;
  extractedTextLength: number;
  totalWords: number;
  averageWordsPerPage: number;
  textExtractionQuality: PDFTextQuality;
  creationDate?: Date;
  modificationDate?: Date;
  isPasswordProtected: boolean;
  hasPermissions: boolean;
  allowsCopying: boolean;
  allowsPrinting: boolean;
  processingTime: number;
  extractionMethod: 'PyPDF2' | 'pdfplumber' | 'other';
  processingWarnings?: string[];
  firstPagePreview?: string;
  tableOfContents?: PDFTOCEntry[];
}

export interface WordMetadata {
  title?: string;
  author?: string;
  subject?: string;
  company?: string;
  manager?: string;
  category?: string;
  keywords?: string[];
  comments?: string;
  pageCount: number;
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  sectionCount: number;
  hasImages: boolean;
  hasTableOfContents: boolean;
  hasHeaders: boolean;
  hasFooters: boolean;
  hasFootnotes: boolean;
  hasComments: boolean;
  hasRevisions: boolean;
  hasHyperlinks: boolean;
  headingLevels: number[];
  tableCount: number;
  listCount: number;
  imageCount: number;
  hyperlinkCount: number;
  extractedTextLength: number;
  textExtractionQuality: WordTextQuality;
  structureComplexity: WordStructureComplexity;
  creationDate?: Date;
  modificationDate?: Date;
  lastPrintDate?: Date;
  isPasswordProtected: boolean;
  hasRestrictedEditing: boolean;
  isReadOnly: boolean;
  hasMacros: boolean;
  processingTime: number;
  extractionMethod: 'python-docx' | 'docx2txt' | 'mammoth' | 'other';
  processingWarnings?: string[];
  firstPagePreview?: string;
  documentStructure?: WordStructureElement[];
  language?: string;
  readabilityScore?: number;
  averageWordsPerSentence?: number;
  averageSentencesPerParagraph?: number;
}

export type PDFTextQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
export type WordTextQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
export type WordStructureComplexity = 'simple' | 'moderate' | 'complex' | 'very_complex';
export type WordElementType = 'heading' | 'paragraph' | 'table' | 'list' | 'image' | 'hyperlink' | 'pagebreak' | 'sectionbreak' | 'header' | 'footer' | 'footnote' | 'comment' | 'textbox' | 'equation' | 'other';

export interface PDFTOCEntry {
  title: string;
  pageNumber: number;
  level: number;
  children?: PDFTOCEntry[];
}

export interface WordStructureElement {
  type: WordElementType;
  level?: number;
  text: string;
  position: number;
  pageNumber?: number;
  children?: WordStructureElement[];
  tableData?: string[][];
  listItems?: string[];
  imageAlt?: string;
  hyperlinkUrl?: string;
  styleInfo?: WordStyleInfo;
}

export interface WordStyleInfo {
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
} 