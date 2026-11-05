import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { addCommentsToDocx, parseDocx } from "../src/adapters/docx";
import { runProofreading } from "../src/proofreading/engine";
import { initialRules } from "../src/proofreading/rules";
import { anchoredTexts, documentIndex, readFixture } from "./helpers/docx";
import { buildWordDocx, FIXTURE_NAMES, fixtureBuilders, paragraph, rtlParagraph, run } from "./helpers/docxFixtures";

type Golden = [ruleId: string, start: number, end: number, originalText: string, paragraph: number];

/** Reviewed by hand against the texts in the fixture builders. Do not update to make tests pass. */
const GOLDEN: Record<string, Golden[]> = {
  "simple-paragraphs": [
    ["HEB-SPACE-002", 4, 5, " ", 0],
    ["HEB-SPACE-003", 6, 6, "", 0],
    ["HEB-SPACE-001", 14, 16, "  ", 1],
    ["HEB-CONS-002", 27, 34, "הוא הוא", 2],
  ],
  "split-runs": [
    ["HEB-SPACE-001", 3, 5, "  ", 0],
    ["HEB-SPACE-002", 13, 14, " ", 0],
    ["HEB-SPACE-003", 15, 15, "", 0],
    ["HEB-PUNC-003", 24, 25, "(", 1],
  ],
  tables: [
    ["HEB-SPACE-002", 13, 14, " ", 1],
    ["HEB-SPACE-003", 15, 15, "", 1],
    ["HEB-SPACE-001", 23, 25, "  ", 2],
    ["HEB-CONS-002", 29, 36, "הוא הוא", 3],
    ["HEB-SPACE-004", 46, 47, " ", 4],
  ],
  "rtl-mixed-content": [
    ["HEB-SPACE-001", 13, 15, "  ", 0],
    ["HEB-PUNC-003", 25, 26, "(", 0],
    ["HEB-SPACE-002", 30, 31, " ", 0],
    ["HEB-SPACE-003", 32, 32, "", 0],
    ["HEB-SPACE-002", 44, 45, " ", 1],
    ["HEB-SPACE-003", 46, 46, "", 1],
    ["HEB-SPACE-001", 81, 83, "  ", 2],
  ],
  "existing-comments": [
    ["HEB-SPACE-001", 17, 19, "  ", 0],
    ["HEB-SPACE-002", 23, 24, " ", 0],
  ],
  "tracked-changes": [
    ["HEB-SPACE-001", 4, 6, "  ", 0],
    ["HEB-SPACE-002", 30, 31, " ", 0],
  ],
};

describe("DOCX pipeline: parse -> engine -> source map", () => {
  it.each(FIXTURE_NAMES)("%s: findings, exact ranges and paragraph anchors match the golden file", async (name) => {
    const { document } = await parseDocx(readFixture(name));
    const { issues, errors } = runProofreading({ document, rules: initialRules });
    expect(errors).toEqual([]);
    const actual = issues.map((i) => [i.ruleId, i.range.start, i.range.end, i.originalText, i.sourceLocation.kind === "docx" ? i.sourceLocation.start.paragraphIndex : -1]);
    expect(actual).toEqual(GOLDEN[name]);
  });

  it.each(FIXTURE_NAMES)("%s: every finding's range slices the text and is stable across runs", async (name) => {
    const { document } = await parseDocx(readFixture(name));
    const first = runProofreading({ document, rules: initialRules });
    const second = runProofreading({ document, rules: initialRules });
    expect(second).toEqual(first);
    for (const issue of first.issues) expect(document.text.slice(issue.range.start, issue.range.end)).toBe(issue.originalText);
  });

  it("checked-in fixtures match the generator (compared part by part, not by ZIP bytes)", async () => {
    for (const name of FIXTURE_NAMES) {
      const committed = await JSZip.loadAsync(readFixture(name));
      const generated = await JSZip.loadAsync(await fixtureBuilders[name]());
      expect(Object.keys(committed.files).sort()).toEqual(Object.keys(generated.files).sort());
      for (const part of Object.keys(generated.files)) {
        expect(await committed.file(part)?.async("string"), `${name}:${part}`).toBe(await generated.file(part)?.async("string"));
      }
    }
  });
});

describe("DOCX pipeline: large document", () => {
  it("parses, checks and comments a 2,000-paragraph document with every finding commented within a practical time", async () => {
    const body = Array.from({ length: 2000 }, (_, i) => rtlParagraph(run(`פסקה ${i} ,עם  רווחים`) + run(" ועוד טקסט", "<w:b/>"))).join("");
    const bytes = await buildWordDocx({ body });
    const started = performance.now();
    const { document } = await parseDocx(bytes);
    const { issues } = runProofreading({ document, rules: initialRules });
    expect(issues.length).toBeGreaterThanOrEqual(6000);
    const sample = issues;
    const result = await addCommentsToDocx(
      bytes,
      sample.map((issue) => ({ location: issue.sourceLocation.kind === "docx" ? issue.sourceLocation : (() => { throw new Error("not docx"); })(), expectedText: issue.originalText, text: issue.message })),
      { author: "a", initials: "a", date: "2020-01-01T00:00:00Z" },
    );
    expect(result.applied).toBe(sample.length);
    expect((await documentIndex(result.bytes)).text).toBe(document.text);
    const anchored = await anchoredTexts(result.bytes);
    sample.forEach((issue, i) => expect(anchored.get(String(i))).toBe(issue.originalText));
    expect(performance.now() - started).toBeLessThan(60_000);
  }, 90_000);

  it("a document of plain paragraphs without runs still parses", async () => {
    const { document } = await parseDocx(await buildWordDocx({ body: paragraph("") + paragraph("") }));
    expect(document.text).toBe("\n");
  });
});
