import type { DocumentModel, DocumentSegment } from "../../domain/document";

export interface PlainTextOptions {
  id?: string;
  fileName?: string;
  createdAt?: string;
}

export const DEFAULT_DOCUMENT_ID = "plain-text-document";

/**
 * Plain text needs no normalization: the normalized text equals the source text, so
 * offsets map one-to-one. Segments are the lines (split on "\n"), excluding the separator.
 */
export function createPlainTextDocument(text: string, options: PlainTextOptions = {}): DocumentModel {
  const segments: DocumentSegment[] = [];
  let start = 0;
  text.split("\n").forEach((line, index) => {
    const range = { start, end: start + line.length };
    segments.push({
      id: `line-${index}`,
      text: line,
      normalizedRange: range,
      sourceLocation: { kind: "plain-text", range: { ...range } },
    });
    start = range.end + 1;
  });
  return {
    id: options.id ?? DEFAULT_DOCUMENT_ID,
    sourceType: "plain-text",
    text,
    segments,
    metadata: {
      language: "he",
      createdAt: options.createdAt ?? new Date().toISOString(),
      ...(options.fileName ? { fileName: options.fileName } : {}),
    },
  };
}
