// File upload constants and configuration for AI Dock

// =============================================================================
// FILE SIZE LIMITS
// =============================================================================

// File size limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes for most files
export const MAX_PDF_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes for PDF files
export const MAX_WORD_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes for Word documents
export const MAX_FILES_PER_MESSAGE = 5;
export const MAX_FILENAME_LENGTH = 255;
export const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for large file uploads

// =============================================================================
// PDF-SPECIFIC LIMITS
// =============================================================================

export const MAX_PDF_PAGES = 50;        // Maximum pages to process
export const MAX_PDF_TEXT_LENGTH = 100 * 1024; // 100KB extracted text limit
export const PDF_PROCESSING_TIMEOUT = 30000;   // 30 seconds processing timeout

// =============================================================================
// WORD DOCUMENT-SPECIFIC LIMITS
// =============================================================================

export const MAX_WORD_PAGES = 100;      // Maximum pages to process for Word docs
export const MAX_WORD_TEXT_LENGTH = 150 * 1024; // 150KB extracted text limit
export const WORD_PROCESSING_TIMEOUT = 45000;   // 45 seconds processing timeout
export const MAX_WORD_TABLES = 50;      // Maximum tables to process
export const MAX_WORD_IMAGES = 100;     // Maximum images to analyze

// =============================================================================
// SUPPORTED FILE TYPES
// =============================================================================

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

// =============================================================================
// UPLOAD TIMEOUTS
// =============================================================================

export const UPLOAD_TIMEOUT = 60000; // 60 seconds
export const CHUNK_TIMEOUT = 30000;  // 30 seconds per chunk
export const RETRY_DELAYS = [1000, 2000, 4000, 8000]; // Exponential backoff

// =============================================================================
// FILE TYPE ICONS
// =============================================================================

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

// =============================================================================
// PROGRESS UPDATE INTERVALS
// =============================================================================

export const PROGRESS_UPDATE_INTERVAL = 100; // Update progress every 100ms
export const UI_UPDATE_DEBOUNCE = 16; // ~60fps for UI updates

// =============================================================================
// VALIDATION MESSAGES
// =============================================================================

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
