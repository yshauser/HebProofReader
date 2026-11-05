import type { DocumentModel, DocumentSegment, DocxAnchor, DocxLocation, SourceLocation, TextRange } from "./types";

const docxStartOf = (segment: DocumentSegment): DocxAnchor | undefined =>
  segment.sourceLocation.kind === "docx" ? segment.sourceLocation.start : undefined;

/**
 * Anchor of `offset` inside `segment`. "start" bias prefers the segment that begins at the offset,
 * "end" bias prefers the segment that ends there; offsets between segments (paragraph separators)
 * resolve to the closest preceding segment.
 */
function docxAnchorAt(segments: readonly DocumentSegment[], offset: number, bias: "start" | "end"): DocxAnchor {
  const containing = segments.find(({ normalizedRange: r }) => (bias === "start" ? r.start <= offset && offset < r.end : r.start < offset && offset <= r.end));
  const segment = containing ?? segments.filter(({ normalizedRange }) => normalizedRange.start <= offset).at(-1) ?? segments[0];
  const base = segment ? docxStartOf(segment) : undefined;
  if (!segment || !base) throw new Error("Document has no DOCX segments to map the range to");
  const length = segment.normalizedRange.end - segment.normalizedRange.start;
  const delta = Math.min(Math.max(offset - segment.normalizedRange.start, 0), length);
  return { paragraphIndex: base.paragraphIndex, runIndex: base.runIndex, offsetInRun: base.offsetInRun + delta };
}

/** Segment-based mapping: no DOCX library and no text search are involved. Zero-length ranges use the start anchor for both ends. */
function toDocxLocation(document: DocumentModel, range: TextRange): DocxLocation {
  const start = docxAnchorAt(document.segments, range.start, "start");
  const end = range.start === range.end ? { ...start } : docxAnchorAt(document.segments, range.end, "end");
  return { kind: "docx", start, end };
}

/** Maps a range of the normalized text to its source location. Plain text is an identity mapping. */
export function toSourceLocation(document: DocumentModel, range: TextRange): SourceLocation {
  switch (document.sourceType) {
    case "plain-text":
      return { kind: "plain-text", range: { start: range.start, end: range.end } };
    case "docx":
      return toDocxLocation(document, range);
    default:
      throw new Error(`Source mapping for "${document.sourceType}" is not implemented`);
  }
}
