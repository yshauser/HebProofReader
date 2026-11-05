import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  anchoredTexts,
  canonicalDocument,
  documentIndex,
  partNames,
  readFixture,
  readPart,
  sha256,
} from "../../../tests/helpers/docx";
import { buildWordDocx, commentsXml, FIXTURE_NAMES, paragraph, run } from "../../../tests/helpers/docxFixtures";
import type { DocumentModel, DocxLocation, TextRange } from "../../domain/document";
import { toSourceLocation } from "../../domain/document";
import { runProofreading } from "../../proofreading/engine";
import { initialRules } from "../../proofreading/rules";
import { addCommentsToDocx } from "./comments";
import type { DocxCommentInput } from "./comments";
import { DocxError } from "./errors";
import { parseDocx } from "./parse";
import { W } from "./xml";
import { parseXml } from "./xml";

const OPTIONS = { author: "מגיה עברית", initials: "מע", date: "2020-01-01T00:00:00Z" };

const locationOf = (document: DocumentModel, range: TextRange): DocxLocation => {
  const location = toSourceLocation(document, range);
  if (location.kind !== "docx") throw new Error("expected docx location");
  return location;
};

async function proofread(bytes: Uint8Array) {
  const { document } = await parseDocx(bytes);
  const { issues } = runProofreading({ document, rules: initialRules });
  const comments: DocxCommentInput[] = issues.map((issue) => ({
    location: locationOf(document, issue.range),
    expectedText: issue.originalText,
    text: `${issue.ruleId}: ${issue.message}`,
  }));
  return { document, issues, comments };
}

const IDS = (xml: string) => Array.from(parseXml(xml).getElementsByTagNameNS(W, "comment")).map((c) => c.getAttributeNS(W, "id"));

describe("addCommentsToDocx: every fixture", () => {
  it.each(FIXTURE_NAMES)("%s: comments land exactly on the findings and nothing else changes", async (name) => {
    const source = readFixture(name);
    const before = sha256(source);
    const { document, issues, comments } = await proofread(source);
    expect(issues.length).toBeGreaterThan(0);

    const result = await addCommentsToDocx(source, comments, OPTIONS);

    expect(result.applied).toBe(issues.length);
    expect(result.skipped).toEqual([]);
    expect(sha256(source)).toBe(before);
    expect(sha256(result.bytes)).not.toBe(before);

    expect((await documentIndex(result.bytes)).text).toBe(document.text);

    const anchored = await anchoredTexts(result.bytes);
    const existing = IDS(await readPart(source, "word/comments.xml").catch(() => "<w:comments xmlns:w='x'/>"));
    const firstNewId = existing.length === 0 ? 0 : Math.max(...existing.map(Number)) + 1;
    issues.forEach((issue, i) => expect(anchored.get(String(firstNewId + i))).toBe(issue.originalText));

    expect(canonicalDocument(await readPart(result.bytes, "word/document.xml"))).toBe(canonicalDocument(await readPart(source, "word/document.xml")));
  });

  it.each(FIXTURE_NAMES)("%s: all untouched parts are byte-identical", async (name) => {
    const source = readFixture(name);
    const { comments } = await proofread(source);
    const { bytes } = await addCommentsToDocx(source, comments, OPTIONS);
    const changed = new Set(["word/document.xml", "word/comments.xml", "[Content_Types].xml", "word/_rels/document.xml.rels"]);
    const before = await JSZip.loadAsync(source);
    const after = await JSZip.loadAsync(bytes);
    for (const part of await partNames(source)) {
      if (changed.has(part) || before.files[part]?.dir) continue;
      expect(await after.file(part)?.async("string")).toBe(await before.file(part)?.async("string"));
    }
    const added = (await partNames(bytes)).filter((part) => !(part in before.files));
    expect(added.length).toBeLessThanOrEqual(1);
  });

  it("is deterministic", async () => {
    const source = readFixture("split-runs");
    const { comments } = await proofread(source);
    const a = await addCommentsToDocx(source, comments, OPTIONS);
    const b = await addCommentsToDocx(source, comments, OPTIONS);
    expect(await readPart(a.bytes, "word/document.xml")).toBe(await readPart(b.bytes, "word/document.xml"));
    expect(await readPart(a.bytes, "word/comments.xml")).toBe(await readPart(b.bytes, "word/comments.xml"));
  });
});

describe("addCommentsToDocx: run splitting and formatting", () => {
  it("splits runs at bold/italic boundaries and keeps their formatting on both halves", async () => {
    const source = readFixture("split-runs");
    const { document } = await parseDocx(source);
    // "  " spans the end of the bold run "טוב " and the start of the italic run " מאוד".
    const range = { start: 3, end: 5 };
    const { bytes } = await addCommentsToDocx(source, [{ location: locationOf(document, range), expectedText: "  ", text: "x" }], OPTIONS);

    const xml = await readPart(bytes, "word/document.xml");
    const doc = parseXml(xml);
    const runs = Array.from(doc.getElementsByTagNameNS(W, "r")).map((r) => ({
      text: Array.from(r.getElementsByTagNameNS(W, "t")).map((t) => t.textContent).join(""),
      bold: r.getElementsByTagNameNS(W, "b").length > 0,
      italic: r.getElementsByTagNameNS(W, "i").length > 0,
    }));
    const paragraphRuns = runs.slice(0, 7).filter((r) => r.text !== "");
    expect(paragraphRuns.slice(0, 4)).toEqual([
      { text: "טוב", bold: true, italic: false },
      { text: " ", bold: true, italic: false },
      { text: " ", bold: false, italic: true },
      { text: "מאוד", bold: false, italic: true },
    ]);
    expect((await anchoredTexts(bytes)).get("0")).toBe("  ");
  });

  it("keeps run attributes (rsid) on the split halves", async () => {
    const source = readFixture("split-runs");
    const { document } = await parseDocx(source);
    const { bytes } = await addCommentsToDocx(source, [{ location: locationOf(document, { start: 1, end: 2 }), expectedText: "ו", text: "x" }], OPTIONS);
    const xml = await readPart(bytes, "word/document.xml");
    expect(xml.match(/w:rsidR="00A1B2C3"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("anchors a comment inside a tracked insertion without moving it out of w:ins", async () => {
    const source = readFixture("tracked-changes");
    const { document } = await parseDocx(source);
    const start = document.text.indexOf("שהוכנס");
    const range = { start, end: start + "שהוכנס".length };
    const { bytes } = await addCommentsToDocx(source, [{ location: locationOf(document, range), expectedText: "שהוכנס", text: "x" }], OPTIONS);
    expect((await anchoredTexts(bytes)).get("0")).toBe("שהוכנס");
    const doc = parseXml(await readPart(bytes, "word/document.xml"));
    const insertion = doc.getElementsByTagNameNS(W, "ins")[0];
    expect(insertion?.getElementsByTagNameNS(W, "commentRangeStart")).toHaveLength(1);
    expect((await documentIndex(bytes)).text).toBe(document.text);
  });

  it("anchors an insertion point and a comment at the very end of a paragraph", async () => {
    const source = readFixture("simple-paragraphs");
    const { document } = await parseDocx(source);
    const endOfFirst = document.text.indexOf("\n");
    const { bytes, applied } = await addCommentsToDocx(
      source,
      [
        { location: locationOf(document, { start: 6, end: 6 }), expectedText: "", text: "point" },
        { location: locationOf(document, { start: endOfFirst, end: endOfFirst }), expectedText: "", text: "end" },
        { location: locationOf(document, { start: endOfFirst - 4, end: endOfFirst }), expectedText: "יוסף", text: "tail" },
      ],
      OPTIONS,
    );
    expect(applied).toBe(3);
    const anchored = await anchoredTexts(bytes);
    expect([anchored.get("0"), anchored.get("1"), anchored.get("2")]).toEqual(["", "", "יוסף"]);
  });

  it("anchors a range spanning paragraphs and overlapping comments", async () => {
    const source = readFixture("simple-paragraphs");
    const { document } = await parseDocx(source);
    const spanning = { start: 8, end: 15 };
    const overlapping = { start: 12, end: 20 };
    const { bytes } = await addCommentsToDocx(
      source,
      [spanning, overlapping].map((range) => ({ location: locationOf(document, range), expectedText: document.text.slice(range.start, range.end), text: "x" })),
      OPTIONS,
    );
    const anchored = await anchoredTexts(bytes);
    expect(anchored.get("0")).toBe(document.text.slice(8, 15));
    expect(anchored.get("1")).toBe(document.text.slice(12, 20));
    expect((await documentIndex(bytes)).text).toBe(document.text);
  });

  it("comments an empty paragraph by insertion", async () => {
    const source = await buildWordDocx({ body: paragraph(run("ראשון")) + paragraph("") + paragraph(run("שלישי")) });
    const { document } = await parseDocx(source);
    const emptyAt = document.text.indexOf("\n") + 1;
    const { bytes } = await addCommentsToDocx(source, [{ location: locationOf(document, { start: emptyAt, end: emptyAt }), expectedText: "", text: "x" }], OPTIONS);
    const doc = parseXml(await readPart(bytes, "word/document.xml"));
    const paragraphs = Array.from(doc.getElementsByTagNameNS(W, "p"));
    expect(paragraphs[1]?.getElementsByTagNameNS(W, "commentRangeStart")).toHaveLength(1);
    expect(paragraphs[0]?.getElementsByTagNameNS(W, "commentRangeStart")).toHaveLength(0);
  });
});

describe("addCommentsToDocx: comments part", () => {
  it("registers a new comments part, content type and relationship exactly once", async () => {
    const source = readFixture("simple-paragraphs");
    const { comments } = await proofread(source);
    const { bytes } = await addCommentsToDocx(source, comments, OPTIONS);
    expect((await readPart(bytes, "[Content_Types].xml")).match(/\/word\/comments\.xml/g)).toHaveLength(1);
    expect((await readPart(bytes, "word/_rels/document.xml.rels")).match(/Target="comments\.xml"/g)).toHaveLength(1);
    expect(IDS(await readPart(bytes, "word/comments.xml"))).toEqual(comments.map((_, i) => String(i)));
  });

  it("writes author, initials, date and multi-line text as separate paragraphs", async () => {
    const source = readFixture("simple-paragraphs");
    const { document } = await parseDocx(source);
    const { bytes } = await addCommentsToDocx(source, [{ location: locationOf(document, { start: 0, end: 4 }), expectedText: "שלום", text: "שורה א\nשורה ב" }], OPTIONS);
    const comment = parseXml(await readPart(bytes, "word/comments.xml")).getElementsByTagNameNS(W, "comment")[0];
    expect(comment?.getAttributeNS(W, "author")).toBe("מגיה עברית");
    expect(comment?.getAttributeNS(W, "initials")).toBe("מע");
    expect(comment?.getAttributeNS(W, "date")).toBe("2020-01-01T00:00:00Z");
    expect(Array.from(comment?.getElementsByTagNameNS(W, "p") ?? []).map((p) => p.textContent)).toEqual(["שורה א", "שורה ב"]);
  });

  it("preserves existing comments and allocates ids after the highest existing id", async () => {
    const source = readFixture("existing-comments");
    const { comments } = await proofread(source);
    const { bytes } = await addCommentsToDocx(source, comments, OPTIONS);
    const xml = await readPart(bytes, "word/comments.xml");
    expect(IDS(xml)).toEqual(["0", "1", "2"]);
    expect(xml).toContain("הערה קיימת");
    expect((await anchoredTexts(bytes)).get("0")).toBe("טקסט עם הערה");
    expect((await readPart(bytes, "[Content_Types].xml")).match(/comments\+xml/g)).toHaveLength(1);
  });

  it("uses the comments part found through the relationships, not an assumed name", async () => {
    const source = await buildWordDocx({
      body: paragraph(run("שלום  עולם")),
      commentsXml: commentsXml([{ id: 7, author: "x", text: "קיים" }]),
      commentsPart: "word/customComments.xml",
    });
    const { document } = await parseDocx(source);
    const { bytes } = await addCommentsToDocx(source, [{ location: locationOf(document, { start: 4, end: 6 }), expectedText: "  ", text: "חדש" }], OPTIONS);
    const names = await partNames(bytes);
    expect(names).toContain("word/customComments.xml");
    expect(names).not.toContain("word/comments.xml");
    expect(IDS(await readPart(bytes, "word/customComments.xml"))).toEqual(["7", "8"]);
    expect((await readPart(bytes, "word/_rels/document.xml.rels")).match(/relationships\/comments"/g)).toHaveLength(1);
  });

  it("creates the relationships part when the package has none", async () => {
    const source = await buildWordDocx({ body: paragraph(run("שלום  עולם")) });
    const zip = await JSZip.loadAsync(source);
    zip.remove("word/_rels/document.xml.rels");
    const bare = await zip.generateAsync({ type: "uint8array" });
    const { document } = await parseDocx(bare);
    const { bytes } = await addCommentsToDocx(bare, [{ location: locationOf(document, { start: 4, end: 6 }), expectedText: "  ", text: "x" }], OPTIONS);
    expect(await readPart(bytes, "word/_rels/document.xml.rels")).toContain('Target="comments.xml"');
  });
});

describe("addCommentsToDocx: safety", () => {
  it("skips comments whose anchored text no longer matches instead of misplacing them", async () => {
    const source = readFixture("simple-paragraphs");
    const { document } = await parseDocx(source);
    const location = locationOf(document, { start: 0, end: 4 });
    const result = await addCommentsToDocx(
      source,
      [
        { location, expectedText: "אחר", text: "x" },
        { location, expectedText: "שלום", text: "ok" },
      ],
      OPTIONS,
    );
    expect(result.skipped).toEqual([{ index: 0, reason: "text-mismatch" }]);
    expect(result.applied).toBe(1);
    expect((await anchoredTexts(result.bytes)).get("0")).toBe("שלום");
  });

  it("skips unresolvable anchors", async () => {
    const source = readFixture("simple-paragraphs");
    const anchor = { paragraphIndex: 99, runIndex: 0, offsetInRun: 0 };
    const outOfRun = { paragraphIndex: 0, runIndex: 0, offsetInRun: 999 };
    const reversed = { paragraphIndex: 0, runIndex: 0, offsetInRun: 2 };
    const start = { paragraphIndex: 0, runIndex: 0, offsetInRun: 4 };
    const result = await addCommentsToDocx(
      source,
      [
        { location: { kind: "docx", start: anchor, end: anchor }, expectedText: "", text: "x" },
        { location: { kind: "docx", start: anchor, end: outOfRun }, expectedText: "", text: "x" },
        { location: { kind: "docx", start, end: reversed }, expectedText: "", text: "x" },
      ],
      OPTIONS,
    );
    expect(result.skipped.map((s) => s.reason)).toEqual(["invalid-anchor", "invalid-anchor", "invalid-anchor"]);
    expect(result.applied).toBe(0);
  });

  it("returns an unchanged copy (new array) when nothing can be written", async () => {
    const source = readFixture("simple-paragraphs");
    const result = await addCommentsToDocx(source, [], OPTIONS);
    expect(result.applied).toBe(0);
    expect(result.bytes).not.toBe(source);
    expect(sha256(result.bytes)).toBe(sha256(source));
  });

  it("rejects packages that are not WordprocessingML", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "x");
    const error = await addCommentsToDocx(await zip.generateAsync({ type: "uint8array" }), [], OPTIONS).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DocxError);
    expect((error as DocxError).code).toBe("missing-main-part");
  });
});
