// Word document-specific types for AI Dock

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

export interface WordTable {
  id: string;
  position: number;
  pageNumber?: number;
  rowCount: number;
  columnCount: number;
  headers?: string[];
  data: string[][];
  caption?: string;
  hasHeaders: boolean;
  tableStyle?: string;
}

export interface WordList {
  id: string;
  type: 'bulleted' | 'numbered' | 'outline';
  position: number;
  pageNumber?: number;
  items: WordListItem[];
  style?: string;
}

export interface WordListItem {
  text: string;
  level: number;
  number?: string;
  children?: WordListItem[];
}

export interface WordProcessingResult {
  success: boolean;
  metadata: WordMetadata;
  fullText: string;
  structuredContent: WordStructureElement[];
  tables: WordTable[];
  lists: WordList[];
  images: WordImageInfo[];
  hyperlinks: WordHyperlink[];
  processingTime: number;
  errors: string[];
  warnings: string[];
  summary?: string;
  keyTopics?: string[];
  headingOutline?: WordHeading[];
}

export interface WordImageInfo {
  id: string;
  position: number;
  pageNumber?: number;
  altText?: string;
  caption?: string;
  width?: number;
  height?: number;
  format?: string;
  description?: string;
}

export interface WordHyperlink {
  id: string;
  text: string;
  url: string;
  position: number;
  pageNumber?: number;
  isExternal: boolean;
  isEmail: boolean;
}

export interface WordHeading {
  id: string;
  level: number;
  text: string;
  position: number;
  pageNumber?: number;
  children?: WordHeading[];
  wordCount?: number;
}

export type WordTextQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
export type WordStructureComplexity = 'simple' | 'moderate' | 'complex' | 'very_complex';
export type WordElementType = 'heading' | 'paragraph' | 'table' | 'list' | 'image' | 'hyperlink' | 'pagebreak' | 'sectionbreak' | 'header' | 'footer' | 'footnote' | 'comment' | 'textbox' | 'equation' | 'other'; 