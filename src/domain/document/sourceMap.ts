import type { DocumentModel, SourceLocation, TextRange } from "./types";

/** Maps a range of the normalized text to its source location. Plain text is an identity mapping. */
export function toSourceLocation(document: DocumentModel, range: TextRange): SourceLocation {
  switch (document.sourceType) {
    case "plain-text":
      return { kind: "plain-text", range: { start: range.start, end: range.end } };
    default:
      throw new Error(`Source mapping for "${document.sourceType}" is not implemented`);
  }
}
