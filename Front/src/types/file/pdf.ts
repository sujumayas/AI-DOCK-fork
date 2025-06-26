// PDF-specific types for AI Dock

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

export interface PDFTOCEntry {
  title: string;
  pageNumber: number;
  level: number;
  children?: PDFTOCEntry[];
}

export interface PDFPage {
  pageNumber: number;
  text: string;
  wordCount: number;
  hasImages: boolean;
  extractionQuality: PDFTextQuality;
}

export interface PDFProcessingResult {
  success: boolean;
  metadata: PDFMetadata;
  fullText: string;
  pages: PDFPage[];
  processingTime: number;
  errors: string[];
  warnings: string[];
  summary?: string;
  keyTopics?: string[];
}

export type PDFTextQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'failed'; 