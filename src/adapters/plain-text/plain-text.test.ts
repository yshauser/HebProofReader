import { describe, expect, it } from "vitest";
import { createPlainTextDocument, DEFAULT_DOCUMENT_ID } from "./index";

describe("createPlainTextDocument", () => {
  it("keeps the text unchanged and describes it as plain text", () => {
    const doc = createPlainTextDocument("שלום\nעולם", { createdAt: "2020-01-01T00:00:00.000Z" });
    expect(doc.text).toBe("שלום\nעולם");
    expect(doc.sourceType).toBe("plain-text");
    expect(doc.id).toBe(DEFAULT_DOCUMENT_ID);
    expect(doc.metadata).toEqual({ language: "he", createdAt: "2020-01-01T00:00:00.000Z" });
  });

  it("creates one segment per line with exact ranges", () => {
    const text = "אב\n\nגדה";
    const { segments } = createPlainTextDocument(text);
    expect(segments.map((s) => s.normalizedRange)).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 3 },
      { start: 4, end: 7 },
    ]);
    for (const segment of segments) {
      expect(text.slice(segment.normalizedRange.start, segment.normalizedRange.end)).toBe(segment.text);
      expect(segment.sourceLocation).toEqual({ kind: "plain-text", range: segment.normalizedRange });
    }
  });

  it("handles empty text and custom ids", () => {
    const doc = createPlainTextDocument("", { id: "x", fileName: "a.txt" });
    expect(doc.segments).toHaveLength(1);
    expect(doc.id).toBe("x");
    expect(doc.metadata.fileName).toBe("a.txt");
  });
});
