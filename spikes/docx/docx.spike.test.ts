import { createHash } from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { createPlainTextDocument } from "../../src/adapters/plain-text";
import { runProofreading } from "../../src/proofreading/engine";
import { initialRules } from "../../src/proofreading/rules";
import { addComments } from "./comments";
import { buildDocx, existingCommentsBody, existingCommentsXml, fixtureBodies, p, r } from "./fixtures";
import {
  docxLocationToText,
  elementChildren,
  findUnsupportedContent,
  indexDocument,
  isW,
  parseXml,
  runUnits,
  toDocxLocation,
  W,
} from "./ooxml";

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const OPTIONS = { author: "Hebrew Proofreader", initials: "HP", date: "2020-01-01T00:00:00Z" };

async function readPart(bytes: Uint8Array, name: string): Promise<string> {
  const file = (await JSZip.loadAsync(bytes)).file(name);
  if (!file) throw new Error(`missing part ${name}`);
  return file.async("string");
}

const indexOf = async (bytes: Uint8Array) => indexDocument(parseXml(await readPart(bytes, "word/document.xml")));

/** Text covered by each comment id, in document order, from the comment markers. */
function anchoredTexts(bytes: Promise<string>) {
  return bytes.then((xml) => {
    const doc = parseXml(xml);
    const active = new Set<string>();
    const result = new Map<string, string>();
    const walk = (el: Element) => {
      for (const child of elementChildren(el)) {
        const id = child.getAttributeNS(W, "id") ?? "";
        if (isW(child, "commentRangeStart")) {
          active.add(id);
          result.set(id, "");
        } else if (isW(child, "commentRangeEnd")) active.delete(id);
        else if (isW(child, "p")) {
          if (active.size > 0) for (const a of active) result.set(a, `${result.get(a) ?? ""}\n`);
          walk(child);
        } else if (isW(child, "r")) {
          const text = runUnits(child).map((u) => u.text).join("");
          for (const a of active) result.set(a, (result.get(a) ?? "") + text);
        } else walk(child);
      }
    };
    walk(doc.documentElement);
    return result;
  });
}

const ALL = Object.keys(fixtureBodies).filter((name) => name !== "unsupported");
const issuesFor = (text: string) =>
  runProofreading({ document: createPlainTextDocument(text, { id: "spike" }), rules: initialRules }).issues;

describe("Q1: paragraphs and runs are indexed with stable anchors", () => {
  it("extracts paragraph text, joins with \\n, and tiles runs without gaps", async () => {
    const docx = await buildDocx(fixtureBodies["split-runs"] ?? "");
    const index = await indexOf(docx);
    expect(index.text).toBe("טוב  מאוד וגם ,עוד");
    expect(index.paragraphs[0]?.runs.map((x) => [x.start, x.end])).toEqual([[0, 4], [4, 9], [9, 15], [15, 18]]);
  });

  it("includes table cell paragraphs in document order", async () => {
    const index = await indexOf(await buildDocx(fixtureBodies.tables ?? ""));
    expect(index.paragraphs.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(index.text).toBe("תא ,ראשון\nתא  שני\nאחרי הטבלה ?");
  });

  it("maps w:tab and w:br to \\t and \\n and indexes hyperlink runs", async () => {
    expect((await indexOf(await buildDocx(fixtureBodies["tabs-and-breaks"] ?? ""))).text).toBe("א\tב  ג\nד");
    expect((await indexOf(await buildDocx(fixtureBodies.hyperlink ?? ""))).text).toBe("ראו קישור  כאן ,סוף");
  });

  it.each(ALL)("%s: every [start,end) range round-trips through DocxLocation exactly", async (name) => {
    const index = await indexOf(await buildDocx(fixtureBodies[name] ?? ""));
    const length = index.text.length;
    for (let start = 0; start <= length; start++) {
      for (let end = start; end <= length; end++) {
        const text = docxLocationToText(index, toDocxLocation(index, { start, end }));
        if (text !== index.text.slice(start, end)) throw new Error(`${name}: [${start},${end}) -> ${JSON.stringify(text)}`);
      }
    }
  });

  it("is deterministic", async () => {
    const docx = await buildDocx(fixtureBodies["split-runs"] ?? "");
    const a = toDocxLocation(await indexOf(docx), { start: 2, end: 6 });
    const b = toDocxLocation(await indexOf(docx), { start: 2, end: 6 });
    expect(a).toEqual(b);
    expect(a.start).toEqual({ paragraphIndex: 0, runIndex: 0, offsetInRun: 2 });
    expect(a.end).toEqual({ paragraphIndex: 0, runIndex: 1, offsetInRun: 2 });
  });

  it("distinguishes identical words in different paragraphs by position", async () => {
    const index = await indexOf(await buildDocx(fixtureBodies["repeated-words"] ?? ""));
    const issues = issuesFor(index.text).filter((i) => i.ruleId === "HEB-CONS-002");
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => toDocxLocation(index, i.range).start.paragraphIndex)).toEqual([0, 1]);
  });

  it("engine findings on extracted text map to anchors whose text equals originalText", async () => {
    for (const name of ALL) {
      const index = await indexOf(await buildDocx(fixtureBodies[name] ?? ""));
      for (const issue of issuesFor(index.text)) {
        expect(docxLocationToText(index, toDocxLocation(index, issue.range))).toBe(issue.originalText);
      }
    }
  });
});

describe("Q2: comments can be inserted within one run and across runs/paragraphs", () => {
  async function commentAll(name: string, bodyOverride?: string) {
    const original = await buildDocx(bodyOverride ?? fixtureBodies[name] ?? "");
    const index = await indexOf(original);
    const issues = issuesFor(index.text);
    const output = await addComments(original, issues.map((i) => ({ range: i.range, text: `${i.ruleId}: ${i.message}` })), OPTIONS);
    return { original, output, index, issues };
  }

  it.each(ALL)("%s: text is unchanged and each comment is anchored to exactly originalText", async (name) => {
    const { output, index, issues } = await commentAll(name);
    expect(issues.length).toBeGreaterThan(0);
    expect((await indexOf(output)).text).toBe(index.text);
    const anchored = await anchoredTexts(readPart(output, "word/document.xml"));
    issues.forEach((issue, i) => expect(anchored.get(String(i))).toBe(issue.originalText));
  });

  it("splits a run that is crossed by a range and keeps run formatting on both halves", async () => {
    const original = await buildDocx(fixtureBodies["split-runs"] ?? "");
    const output = await addComments(original, [{ range: { start: 2, end: 6 }, text: "x" }], OPTIONS);
    const index = await indexOf(output);
    expect(index.text).toBe("טוב  מאוד וגם ,עוד");
    expect(index.paragraphs[0]?.runs.map((x) => x.text)).toEqual(["טו", "ב ", " מ", "", "אוד", " וגם ,", "עוד"]); // "" = the comment reference run: run indexes are only valid for one document state
    const xml = await readPart(output, "word/document.xml");
    expect((xml.match(/<w:b\/>/g) ?? []).length).toBe(3);
    expect((xml.match(/<w:i\/>/g) ?? []).length).toBe(2);
    expect((await anchoredTexts(Promise.resolve(xml))).get("0")).toBe("ב  מ");
  });

  it("anchors a range that spans paragraphs", async () => {
    const original = await buildDocx(fixtureBodies["simple-paragraphs"] ?? "");
    const text = (await indexOf(original)).text; // "שלום ,יוסף\nטוב  מאוד"
    const range = { start: 8, end: 15 };
    const output = await addComments(original, [{ range, text: "x" }], OPTIONS);
    expect((await anchoredTexts(readPart(output, "word/document.xml"))).get("0")).toBe(text.slice(8, 15));
  });

  it("handles insertion points, empty paragraphs and hyperlink runs", async () => {
    const original = await buildDocx(fixtureBodies["empty-paragraph"] ?? "");
    const index = await indexOf(original);
    const emptyStart = index.paragraphs[1]?.start ?? 0;
    const output = await addComments(original, [{ range: { start: emptyStart, end: emptyStart }, text: "empty" }, { range: { start: 3, end: 3 }, text: "mid" }], OPTIONS);
    const anchored = await anchoredTexts(readPart(output, "word/document.xml"));
    expect([anchored.get("0"), anchored.get("1")]).toEqual(["", ""]);
    expect((await indexOf(output)).text).toBe(index.text);
  });

  it("supports overlapping comments", async () => {
    const original = await buildDocx(p(r("אבגדהוזחט")));
    const output = await addComments(original, [{ range: { start: 1, end: 6 }, text: "a" }, { range: { start: 4, end: 8 }, text: "b" }], OPTIONS);
    const anchored = await anchoredTexts(readPart(output, "word/document.xml"));
    expect([anchored.get("0"), anchored.get("1")]).toEqual(["בגדהו", "הוזח"]);
  });
});

describe("Q3: what is preserved", () => {
  it("never modifies the source bytes and produces a different new file", async () => {
    const original = await buildDocx(fixtureBodies["simple-paragraphs"] ?? "");
    const before = sha(original);
    const output = await addComments(original, [{ range: { start: 0, end: 4 }, text: "x" }], OPTIONS);
    expect(sha(original)).toBe(before);
    expect(sha(output)).not.toBe(before);
  });

  it("preserves untouched parts byte-for-byte and keeps other XML (tables, bidi) intact", async () => {
    const original = await buildDocx(fixtureBodies.tables ?? "");
    const output = await addComments(original, [{ range: { start: 0, end: 3 }, text: "x" }], OPTIONS);
    expect(await readPart(output, "_rels/.rels")).toBe(await readPart(original, "_rels/.rels"));
    const xml = await readPart(output, "word/document.xml");
    expect(xml).toContain("<w:tbl>");
    expect((await indexOf(output)).paragraphs).toHaveLength(3);
    const rtl = await addComments(await buildDocx(fixtureBodies["rtl-mixed"] ?? ""), [{ range: { start: 0, end: 5 }, text: "x" }], OPTIONS);
    expect(await readPart(rtl, "word/document.xml")).toContain("<w:bidi/>");
    expect(await readPart(rtl, "word/document.xml")).toContain("<w:rtl/>");
  });

  it("registers the comments part exactly once, with valid XML in every changed part", async () => {
    const original = await buildDocx(fixtureBodies["simple-paragraphs"] ?? "");
    const output = await addComments(original, [{ range: { start: 0, end: 2 }, text: "a" }, { range: { start: 3, end: 5 }, text: "b" }], OPTIONS);
    const types = await readPart(output, "[Content_Types].xml");
    expect(types.match(/\/word\/comments\.xml/g)).toHaveLength(1);
    expect((await readPart(output, "word/_rels/document.xml.rels")).match(/Target="comments\.xml"/g)).toHaveLength(1);
    for (const part of ["word/document.xml", "word/comments.xml", "[Content_Types].xml", "word/_rels/document.xml.rels"]) {
      expect(parseXml(await readPart(output, part)).documentElement).toBeTruthy();
    }
    const comments = parseXml(await readPart(output, "word/comments.xml"));
    expect(comments.getElementsByTagNameNS(W, "comment")).toHaveLength(2);
  });
});

describe("Q4: existing comments", () => {
  it("keeps existing comments and allocates fresh ids", async () => {
    const original = await buildDocx(existingCommentsBody, { commentsXml: existingCommentsXml });
    const index = await indexOf(original);
    expect(index.text).toBe("לפני טקסט עם הערה  אחרי");
    const issues = issuesFor(index.text);
    expect(issues.map((i) => i.ruleId)).toContain("HEB-SPACE-001");
    const output = await addComments(original, issues.map((i) => ({ range: i.range, text: i.message })), OPTIONS);
    const comments = parseXml(await readPart(output, "word/comments.xml"));
    const ids = Array.from(comments.getElementsByTagNameNS(W, "comment")).map((c) => c.getAttributeNS(W, "id"));
    expect(ids[0]).toBe("0");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(1 + issues.length);
    expect(comments.documentElement.textContent).toContain("הערה קיימת");
    expect((await readPart(output, "[Content_Types].xml")).match(/comments\.xml/g)).toHaveLength(1);
    const anchored = await anchoredTexts(readPart(output, "word/document.xml"));
    expect(anchored.get("0")).toBe("טקסט עם הערה");
    expect(anchored.get("1")).toBe(issues[0]?.originalText);
  });

  it("works when the package has no document relationships part", async () => {
    const original = await buildDocx(fixtureBodies["simple-paragraphs"] ?? "", { withDocumentRels: false });
    const output = await addComments(original, [{ range: { start: 0, end: 4 }, text: "x" }], OPTIONS);
    expect(await readPart(output, "word/_rels/document.xml.rels")).toContain("comments.xml");
  });
});

describe("Q5: limitations that must be disclosed", () => {
  it("detects content the spike cannot see (tracked changes etc.)", async () => {
    const xml = await readPart(await buildDocx(fixtureBodies.unsupported ?? ""), "word/document.xml");
    expect(findUnsupportedContent(parseXml(xml))).toEqual(["ins"]);
    expect((await indexOf(await buildDocx(fixtureBodies.unsupported ?? ""))).text).toBe("רגיל\n");
  });

  it("rejects packages that are not WordprocessingML", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "x");
    await expect(addComments(await zip.generateAsync({ type: "uint8array" }), [], OPTIONS)).rejects.toThrow(/WordprocessingML/);
    await expect(addComments(new Uint8Array([1, 2, 3]), [], OPTIONS)).rejects.toThrow();
  });
});
