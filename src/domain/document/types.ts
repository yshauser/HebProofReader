/** Half-open UTF-16 range [start, end): `text.slice(start, end)` is the covered text. */
export interface TextRange {
  start: number;
  end: number;
}

export interface PlainTextLocation {
  kind: "plain-text";
  range: TextRange;
}

export interface DocxAnchor {
  paragraphIndex: number;
  runIndex: number;
  offsetInRun: number;
}

export interface DocxLocation {
  kind: "docx";
  start: DocxAnchor;
  end: DocxAnchor;
}

export interface PdfLocation {
  kind: "pdf";
  pageNumber: number;
  boundingBoxes: Array<{ x: number; y: number; width: number; height: number }>;
}

export type SourceLocation = PlainTextLocation | DocxLocation | PdfLocation;

export interface DocumentSegment {
  id: string;
  text: string;
  normalizedRange: TextRange;
  sourceLocation: SourceLocation;
}

export interface DocumentMetadata {
  fileName?: string;
  mimeType?: string;
  language: "he";
  createdAt: string;
}

export interface DocumentModel {
  id: string;
  sourceType: "plain-text" | "docx" | "pdf";
  text: string;
  segments: DocumentSegment[];
  metadata: DocumentMetadata;
}
