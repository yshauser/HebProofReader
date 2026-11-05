import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildWordDocx, paragraph, run } from "../../../tests/helpers/docxFixtures";
import { readFixture, sha256 } from "../../../tests/helpers/docx";
import { DocxError } from "./errors";
import type { DocxErrorCode } from "./errors";
import { DEFAULT_DOCX_LIMITS } from "./limits";
import { parseDocx } from "./parse";

const CREATED_AT = "2020-01-01T00:00:00.000Z";

async function codeOf(promise: Promise<unknown>): Promise<DocxErrorCode | "other" | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof DocxError ? error.code : "other";
  }
  return undefined;
}

const zipOf = async (files: Record<string, string>) => {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
};

describe("parseDocx: fixtures", () => {
  const TEXTS: Record<string, string> = {
    "simple-paragraphs": "שלום ,יוסף\nזהו  טקסט פשוט.\nהוא הוא הגיע",
    "split-runs": "טוב  מאוד וגם ,עוד מילה\n(סוגר שלא נסגר",
    tables: "לפני הטבלה\nתא ,ראשון\nתא  שני\nהוא הוא\nסוף השורה ?\nאחרי הטבלה",
    "rtl-mixed-content": "השתמשו ב-Word  כדי לפתוח (קובץ ,DOCX\nשָׁלוֹם ,עולם: 3,5 ו-1,000 ש״ח.\nEnglish line  with double space, then עברית",
    "existing-comments": "לפני טקסט עם הערה  אחרי ,",
    "tracked-changes": "לפני  השינוי טקסט שהוכנס ואחרי ,\nפסקה רגילה",
  };

  it.each(Object.entries(TEXTS))("%s: extracts the expected text", async (name, text) => {
    const { document } = await parseDocx(readFixture(name), { createdAt: CREATED_AT });
    expect(document.text).toBe(text);
    expect(document.sourceType).toBe("docx");
    expect(document.metadata.language).toBe("he");
  });

  it.each(Object.keys(TEXTS))("%s: segments tile the text exactly (no gaps or overlaps besides separators)", async (name) => {
    const { document } = await parseDocx(readFixture(name));
    let cursor = 0;
    for (const segment of document.segments) {
      const { start, end } = segment.normalizedRange;
      expect(start).toBeGreaterThanOrEqual(cursor);
      expect(document.text.slice(start, end)).toBe(segment.text);
      if (start > cursor) expect(document.text.slice(cursor, start)).toMatch(/^\n+$/);
      cursor = end;
    }
    expect(document.text.slice(cursor)).toMatch(/^\n*$/);
  });

  it("indexes table cells in document order and counts paragraphs", async () => {
    const parsed = await parseDocx(readFixture("tables"));
    expect(parsed.paragraphCount).toBe(6);
  });

  it("includes tracked insertions and excludes tracked deletions and field results", async () => {
    const { document } = await parseDocx(readFixture("tracked-changes"));
    expect(document.text).toContain("טקסט שהוכנס");
    expect(document.text).not.toContain("טקסט שנמחק");
  });

  it("is deterministic and never modifies the input bytes", async () => {
    const bytes = readFixture("split-runs");
    const before = sha256(bytes);
    const a = await parseDocx(bytes, { createdAt: CREATED_AT, fileName: "x.docx" });
    const b = await parseDocx(bytes, { createdAt: CREATED_AT, fileName: "x.docx" });
    expect(a).toEqual(b);
    expect(sha256(bytes)).toBe(before);
  });

  it("derives the document id from the content", async () => {
    const a = await parseDocx(readFixture("simple-paragraphs"));
    const b = await parseDocx(readFixture("tables"));
    expect(a.document.id).toMatch(/^docx-/);
    expect(a.document.id).not.toBe(b.document.id);
  });
});

describe("parseDocx: warnings", () => {
  it("has no warnings for a plain document", async () => {
    expect((await parseDocx(readFixture("simple-paragraphs"))).warnings).toEqual([]);
  });

  it("reports existing comments", async () => {
    expect((await parseDocx(readFixture("existing-comments"))).warnings).toEqual([{ code: "existing-comments", count: 1 }]);
  });

  it("reports tracked changes, simple fields and unread parts", async () => {
    const { warnings } = await parseDocx(readFixture("tracked-changes"));
    expect(warnings).toEqual([
      { code: "unsupported-content", elements: ["fldSimple"] },
      { code: "tracked-changes" },
      { code: "unread-parts", parts: ["headers", "footnotes"] },
    ]);
  });

  it("reports a document without text", async () => {
    const bytes = await buildWordDocx({ body: paragraph("") });
    expect((await parseDocx(bytes)).warnings).toEqual([{ code: "no-text" }]);
  });
});

describe("parseDocx: validation of untrusted packages", () => {
  const OLE = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);

  it.each<[string, () => Promise<Uint8Array>, DocxErrorCode]>([
    ["legacy .doc / encrypted container", async () => OLE, "legacy-or-encrypted"],
    ["plain text", async () => new TextEncoder().encode("שלום"), "not-a-zip"],
    ["truncated zip", async () => readFixture("simple-paragraphs").slice(0, 200), "corrupt-package"],
    ["zip without office parts", () => zipOf({ "hello.txt": "x" }), "missing-main-part"],
    [
      "zip without word/document.xml",
      () => zipOf({ "[Content_Types].xml": "<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'/>" }),
      "missing-main-part",
    ],
    [
      "macro-enabled document",
      () => buildWordDocx({ body: paragraph(run("x")), mainContentType: "application/vnd.ms-word.document.macroEnabled.main+xml" }),
      "unsupported-package",
    ],
    [
      "template",
      () => buildWordDocx({ body: paragraph(run("x")), mainContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml" }),
      "unsupported-package",
    ],
  ])("rejects %s", async (_name, make, code) => {
    expect(await codeOf(parseDocx(await make()))).toBe(code);
  });

  async function withDocumentXml(xml: string): Promise<Uint8Array> {
    const zip = await JSZip.loadAsync(await buildWordDocx({ body: paragraph(run("x")) }));
    zip.file("word/document.xml", xml);
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }

  it("rejects DTDs and entity declarations (entity expansion / XXE)", async () => {
    const bomb = `<?xml version="1.0"?><!DOCTYPE d [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>&b;</w:t></w:r></w:p></w:body></w:document>`;
    expect(await codeOf(parseDocx(await withDocumentXml(bomb)))).toBe("unsafe-xml");
    const xxe = `<!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>`;
    expect(await codeOf(parseDocx(await withDocumentXml(xxe)))).toBe("unsafe-xml");
  });

  it("rejects malformed XML and the wrong root element", async () => {
    expect(await codeOf(parseDocx(await withDocumentXml("<w:document><w:body>")))).toBe("invalid-xml");
    expect(await codeOf(parseDocx(await withDocumentXml(`<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>`)))).toBe("unsupported-package");
  });

  it("rejects XML that is not valid UTF-8", async () => {
    const zip = await JSZip.loadAsync(await buildWordDocx({ body: paragraph(run("x")) }));
    zip.file("word/document.xml", new Uint8Array([0x3c, 0xff, 0xfe, 0x3e]));
    expect(await codeOf(parseDocx(await zip.generateAsync({ type: "uint8array" })))).toBe("invalid-xml");
  });

  it("enforces the file size limit on the bytes", async () => {
    expect(await codeOf(parseDocx(readFixture("simple-paragraphs"), { limits: { ...DEFAULT_DOCX_LIMITS, maxFileBytes: 100 } }))).toBe("file-too-large");
  });

  it("enforces the entry-count limit", async () => {
    expect(await codeOf(parseDocx(readFixture("simple-paragraphs"), { limits: { ...DEFAULT_DOCX_LIMITS, maxEntries: 3 } }))).toBe("too-many-entries");
  });

  it("aborts a decompression bomb at the part-size limit", async () => {
    const root = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"`;
    const filler = " ".repeat(5 * 1024 * 1024);
    const bomb = await withDocumentXml(`<w:document ${root}><w:body><w:p><w:r><w:t>${filler}</w:t></w:r></w:p></w:body></w:document>`);
    expect(bomb.length).toBeLessThan(100 * 1024);
    expect(await codeOf(parseDocx(bomb, { limits: { ...DEFAULT_DOCX_LIMITS, maxPartBytes: 1024 * 1024 } }))).toBe("part-too-large");
  });

  it("errors carry a code only, never document content", async () => {
    const error = await parseDocx(await withDocumentXml("<w:document>שלום סודי")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DocxError);
    expect((error as Error).message).not.toContain("סודי");
  });
});

