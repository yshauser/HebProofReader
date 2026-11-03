import { describe, expect, it } from "vitest";
import { expectRuleContract, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { punc003 } from "./punc003";

describe("HEB-PUNC-003", () => {
  it.each([
    { input: "(שלום", ranges: [[0, 1]], text: "(" },
    { input: "שלום)", ranges: [[4, 5]], text: ")" },
    { input: "(א))", ranges: [[3, 4]], text: ")" },
    { input: "((א)", ranges: [[0, 1]], text: "(" },
    { input: "Hello (עולם", ranges: [[6, 7]], text: "(" },
    { input: ") (", ranges: [[0, 1], [2, 3]], text: undefined },
    { input: "1234)", ranges: [[4, 5]], text: ")" },
    { input: "(א\nב", ranges: [[0, 1]], text: "(" },
  ])("detects $input", ({ input, ranges, text }) => {
    const issues = runRule(punc003, input);
    expect(rangesOf(issues)).toEqual(ranges);
    if (text) expect(issues[0]?.originalText).toBe(text);
    for (const issue of issues) {
      expect(issue.autoFixable).toBe(false);
      expect(issue.fix).toBeUndefined();
    }
  });

  it.each([
    "(שלום)",
    "",
    "()",
    "(א\nב)",
    "1) א\n2) ב",
    "א) טקסט",
    "a) one",
    "שלום :)",
    "(שלום :)",
    "[א]",
  ])("does not flag %j", (input) => {
    expect(runRule(punc003, input)).toHaveLength(0);
  });

  it("handles niqqud", () => {
    const input = "(שָׁלוֹם";
    expect(rangesOf(runRule(punc003, input))).toEqual([[0, 1]]);
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(punc003, "(א))");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
