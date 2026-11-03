import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPlainTextDocument } from "../src/adapters/plain-text";
import { applyIssueFix, applySafeFixes, runProofreading } from "../src/proofreading/engine";
import { defaultRegistry, initialRules } from "../src/proofreading/rules";
import { buildFindingsReport, findingsReportSchema } from "../src/features/export-results/exporters";
import { makeDocument } from "./helpers/rules";

const fixture = (name: string) => readFileSync(`tests/fixtures/text/${name}.txt`, "utf8");

const run = (text: string) => runProofreading({ document: makeDocument(text), rules: initialRules });
const summary = (text: string) =>
  run(text).issues.map((i) => [i.ruleId, i.range.start, i.range.end, i.originalText]);

/** Golden expectations reviewed by hand against the fixture text. */
const GOLDEN: Record<string, Array<[string, number, number, string]>> = {
  "basic-spacing": [
    ["HEB-SPACE-001", 3, 5, "  "],
    ["HEB-SPACE-004", 26, 27, " "],
    ["HEB-SPACE-002", 33, 34, " "],
    ["HEB-SPACE-003", 35, 35, ""],
    ["HEB-SPACE-003", 45, 45, ""],
    ["HEB-SPACE-006", 50, 51, " "],
    ["HEB-SPACE-006", 64, 65, " "],
    ["HEB-CONS-002", 67, 74, "הוא הוא"],
  ],
  "mixed-hebrew-english": [
    ["HEB-SPACE-001", 5, 7, "  "],
    ["HEB-SPACE-002", 11, 12, " "],
    ["HEB-SPACE-005", 29, 29, ""],
  ],
  niqqud: [
    ["HEB-SPACE-001", 7, 9, "  "],
    ["HEB-SPACE-002", 15, 16, " "],
    ["HEB-SPACE-003", 17, 17, ""],
    ["HEB-PUNC-002", 30, 32, "??"],
    ["HEB-CONS-002", 33, 41, "הוּא הוא"],
    ["HEB-PUNC-003", 46, 47, "("],
  ],
  punctuation: [
    ["HEB-PUNC-002", 7, 10, "???"],
    ["HEB-PUNC-004", 11, 12, "["],
    ["HEB-PUNC-003", 31, 32, ")"],
    ["HEB-SPACE-002", 36, 37, " "],
    ["HEB-PUNC-001", 37, 39, ",,"],
    ["HEB-TYPO-003", 77, 78, "\u200B"],
    ["HEB-TYPO-003", 85, 86, "\u00A0"],
  ],
};

describe("fixtures through the full engine (golden)", () => {
  it.each(Object.keys(GOLDEN))("%s", (name) => {
    expect(summary(fixture(name))).toEqual(GOLDEN[name]);
  });

  it.each(Object.keys(GOLDEN))("%s: engine invariants hold and the run is deterministic", (name) => {
    const text = fixture(name);
    const first = run(text);
    expect(first.errors).toEqual([]);
    expect(run(text)).toEqual(first);
    for (const issue of first.issues) {
      expect(issue.originalText).toBe(text.slice(issue.range.start, issue.range.end));
      expect(issue.confidence).toBe(1);
      if (issue.autoFixable) expect(issue.fix).toBeDefined();
    }
    const ids = first.issues.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("fix and rerun", () => {
  it("applying safe fixes repeatedly converges to text with no auto-fixable findings", () => {
    let text = fixture("basic-spacing");
    for (let i = 0; i < 5; i++) {
      const result = applySafeFixes(text, run(text).issues);
      if (result.appliedIds.length === 0) break;
      text = result.text;
    }
    expect(run(text).issues.filter((i) => i.autoFixable)).toEqual([]);
    expect(text).toBe(
      "זהו טקסט עם רווחים כפולים.\nשלום, יוסף והיי, דוד\n(טקסט בסוגריים)\nהוא הוא הגיע\n",
    );
  });

  it("a single fix followed by a rerun keeps ranges exact for every remaining finding", () => {
    const original = fixture("basic-spacing");
    const first = run(original).issues.find((i) => i.ruleId === "HEB-SPACE-001");
    expect(first).toBeDefined();
    if (!first) return;
    const text = applyIssueFix(original, first);
    for (const issue of run(text).issues) {
      expect(issue.originalText).toBe(text.slice(issue.range.start, issue.range.end));
    }
    expect(run(text).issues.some((i) => i.ruleId === "HEB-SPACE-001")).toBe(false);
  });
});

describe("JSON report", () => {
  it("validates against the schema and does not embed the whole document", () => {
    const text = fixture("punctuation");
    const document = createPlainTextDocument(text, { id: "doc" });
    const result = runProofreading({ document, rules: defaultRegistry.list() });
    const report = buildFindingsReport({ text, result, review: {} });
    expect(findingsReportSchema.parse(JSON.parse(JSON.stringify(report)))).toEqual(report);
    expect(JSON.stringify(report)).not.toContain("סעיף ראשון");
    expect(report.counts.total).toBe(result.issues.length);
  });
});

describe("performance", () => {
  it("checks 100,000 characters quickly", () => {
    const chunk = "שלום ,עולם  טוב.מה קורה?? (בסדר) הוא הוא\n";
    const text = chunk.repeat(Math.ceil(100_000 / chunk.length));
    const started = performance.now();
    const result = run(text);
    const elapsed = performance.now() - started;
    expect(result.errors).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(1000);
    expect(elapsed).toBeLessThan(5000);
  });
});
