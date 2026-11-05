import { describe, expect, it } from "vitest";
import { toSourceLocation } from "./sourceMap";
import type { DocumentModel, DocumentSegment, DocxAnchor } from "./types";

const anchor = (paragraphIndex: number, runIndex: number, offsetInRun: number): DocxAnchor => ({ paragraphIndex, runIndex, offsetInRun });

const segment = (id: string, text: string, start: number, p: number, r: number): DocumentSegment => ({
  id,
  text,
  normalizedRange: { start, end: start + text.length },
  sourceLocation: { kind: "docx", start: anchor(p, r, 0), end: anchor(p, r, text.length) },
});

/** "ab" + "cd" | "" (empty paragraph) | "ef"  ->  "abcd\n\nef" */
const document: DocumentModel = {
  id: "d",
  sourceType: "docx",
  text: "abcd\n\nef",
  segments: [
    segment("p0-r0", "ab", 0, 0, 0),
    segment("p0-r1", "cd", 2, 0, 1),
    { id: "p1", text: "", normalizedRange: { start: 5, end: 5 }, sourceLocation: { kind: "docx", start: anchor(1, -1, 0), end: anchor(1, -1, 0) } },
    segment("p2-r3", "ef", 6, 2, 3),
  ],
  metadata: { language: "he", createdAt: "2020-01-01T00:00:00Z" },
};

const map = (start: number, end: number) => {
  const location = toSourceLocation(document, { start, end });
  if (location.kind !== "docx") throw new Error("expected docx");
  return location;
};

describe("toSourceLocation (docx)", () => {
  it("maps a range inside one run", () => {
    expect(map(0, 2)).toEqual({ kind: "docx", start: anchor(0, 0, 0), end: anchor(0, 0, 2) });
    expect(map(1, 2)).toEqual({ kind: "docx", start: anchor(0, 0, 1), end: anchor(0, 0, 2) });
  });

  it("maps a range across two runs: start prefers the run beginning there, end the run ending there", () => {
    expect(map(1, 3)).toEqual({ kind: "docx", start: anchor(0, 0, 1), end: anchor(0, 1, 1) });
    expect(map(2, 4)).toEqual({ kind: "docx", start: anchor(0, 1, 0), end: anchor(0, 1, 2) });
    expect(map(0, 4)).toEqual({ kind: "docx", start: anchor(0, 0, 0), end: anchor(0, 1, 2) });
  });

  it("maps a range across paragraphs, including an empty one", () => {
    expect(map(3, 7)).toEqual({ kind: "docx", start: anchor(0, 1, 1), end: anchor(2, 3, 1) });
  });

  it("uses the start anchor for both ends of an insertion point", () => {
    expect(map(2, 2)).toEqual({ kind: "docx", start: anchor(0, 1, 0), end: anchor(0, 1, 0) });
    expect(map(1, 1)).toEqual({ kind: "docx", start: anchor(0, 0, 1), end: anchor(0, 0, 1) });
  });

  it("resolves the end of a paragraph (separator position) to the end of its last run", () => {
    expect(map(4, 4)).toEqual({ kind: "docx", start: anchor(0, 1, 2), end: anchor(0, 1, 2) });
  });

  it("anchors an insertion inside an empty paragraph to that paragraph", () => {
    expect(map(5, 5)).toEqual({ kind: "docx", start: anchor(1, -1, 0), end: anchor(1, -1, 0) });
  });

  it("an end at the start of the next paragraph anchors there, not at the previous paragraph", () => {
    expect(map(0, 6).end).toEqual(anchor(2, 3, 0));
  });

  it("throws for a document without segments instead of guessing", () => {
    expect(() => toSourceLocation({ ...document, segments: [] }, { start: 0, end: 0 })).toThrow();
  });

  it("keeps the plain-text mapping unchanged", () => {
    expect(toSourceLocation({ ...document, sourceType: "plain-text" }, { start: 1, end: 3 })).toEqual({ kind: "plain-text", range: { start: 1, end: 3 } });
  });
});
