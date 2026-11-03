import { describe, expect, it } from "vitest";
import { makeDocument, runRule } from "../../../tests/helpers/rules";
import { initialRules } from "../rules";
import { space001 } from "../rules/spacing/space001";
import { space002 } from "../rules/spacing/space002";
import { space003 } from "../rules/spacing/space003";
import { punc002 } from "../rules/punctuation/punc002";
import { runProofreading } from "./engine";
import { applyEdits, applyIssueFix, applySafeFixes, selectNonConflictingFixes } from "./fixes";

describe("applyEdits", () => {
  it("applies edits from highest to lowest offset without shifting", () => {
    const edits = [
      { range: { start: 1, end: 3 }, replacement: "X" },
      { range: { start: 5, end: 5 }, replacement: "--" },
      { range: { start: 0, end: 1 }, replacement: "" },
    ];
    expect(applyEdits("abcdefg", edits)).toBe("Xde--fg");
  });

  it("does not depend on input order and does not mutate the input array", () => {
    const edits = [
      { range: { start: 4, end: 5 }, replacement: "" },
      { range: { start: 0, end: 1 }, replacement: "Z" },
    ];
    const copy = structuredClone(edits);
    expect(applyEdits("abcdef", edits)).toBe("Zbcdf");
    expect(edits).toEqual(copy);
  });

  it("allows an insertion adjacent to a replacement", () => {
    const edits = [
      { range: { start: 2, end: 2 }, replacement: "+" },
      { range: { start: 2, end: 3 }, replacement: "X" },
    ];
    expect(applyEdits("abcd", edits)).toBe("ab+Xd");
  });

  it("rejects overlapping, duplicate-insertion and out-of-range edits", () => {
    expect(() =>
      applyEdits("abcdef", [
        { range: { start: 0, end: 3 }, replacement: "" },
        { range: { start: 2, end: 4 }, replacement: "" },
      ]),
    ).toThrow(/Overlapping/);
    expect(() =>
      applyEdits("abc", [
        { range: { start: 1, end: 1 }, replacement: "a" },
        { range: { start: 1, end: 1 }, replacement: "b" },
      ]),
    ).toThrow(/Overlapping/);
    expect(() => applyEdits("abc", [{ range: { start: 2, end: 9 }, replacement: "" }])).toThrow(RangeError);
  });

  it("keeps surrogate pairs and Hebrew intact", () => {
    expect(applyEdits("א😀  ב", [{ range: { start: 3, end: 5 }, replacement: " " }])).toBe("א😀 ב");
  });
});

describe("issue fixes", () => {
  it("applyIssueFix applies only auto-fixable issues", () => {
    const [fixable] = runRule(space001, "א  ב");
    const [suggestionOnly] = runRule(punc002, "מה??");
    expect(fixable && applyIssueFix("א  ב", fixable)).toBe("א ב");
    expect(() => suggestionOnly && applyIssueFix("מה??", suggestionOnly)).toThrow();
  });

  it("selects non-conflicting fixes greedily and reports skipped ones", () => {
    const text = "א  ,ב";
    const result = runProofreading({ document: makeDocument(text), rules: [space001, space002] });
    expect(result.overlaps).toHaveLength(1);
    const { selected, skipped } = selectNonConflictingFixes(result.issues);
    expect(selected).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(applySafeFixes(text, result.issues).text).toBe("א ,ב");
  });

  it("never applies suggestion-only issues in a batch", () => {
    const text = "מה?? כן";
    const result = runProofreading({ document: makeDocument(text), rules: [punc002] });
    expect(result.issues).toHaveLength(1);
    expect(applySafeFixes(text, result.issues)).toEqual({ text, appliedIds: [], skippedIds: [] });
  });

  it("insertion and adjacent replacement from different rules combine", () => {
    const text = "א,ב  ג";
    const result = runProofreading({ document: makeDocument(text), rules: [space001, space003] });
    expect(applySafeFixes(text, result.issues).text).toBe("א, ב ג");
  });

  it("rerunning the engine after a fix yields valid offsets for the new text", () => {
    const rules = initialRules;
    let text = "שלום ,יוסף  ,דוד,\tמה ?";
    for (let i = 0; i < 10; i++) {
      const { issues } = runProofreading({ document: makeDocument(text), rules });
      const target = issues.find((issue) => issue.autoFixable);
      if (!target) break;
      text = applyIssueFix(text, target);
      const next = runProofreading({ document: makeDocument(text), rules });
      for (const issue of next.issues) {
        expect(issue.originalText).toBe(text.slice(issue.range.start, issue.range.end));
      }
    }
    const final = runProofreading({ document: makeDocument(text), rules });
    expect(final.issues.filter((issue) => issue.autoFixable)).toEqual([]);
  });
});
