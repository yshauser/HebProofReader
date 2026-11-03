import { describe, expect, it } from "vitest";
import { expectRuleContract, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { punc002 } from "./punc002";

describe("HEB-PUNC-002", () => {
  it.each([
    { input: "מה??", ranges: [[2, 4]], suggestion: "?" },
    { input: "איזה יופי!!!", ranges: [[9, 12]], suggestion: "!" },
    { input: "??", ranges: [[0, 2]], suggestion: "?" },
    { input: "א??\nב!!", ranges: [[1, 3], [5, 7]], suggestion: undefined },
    { input: "What??", ranges: [[4, 6]], suggestion: "?" },
  ])("detects $input", ({ input, ranges, suggestion }) => {
    const issues = runRule(punc002, input);
    expect(rangesOf(issues)).toEqual(ranges);
    for (const issue of issues) expect(issue.autoFixable).toBe(false);
    if (suggestion) expect(issues[0]?.suggestion).toBe(suggestion);
  });

  it.each(["מה?", "", "!", "?!", "!?", "א? ב?", "?\n?"])("does not flag %j", (input) => {
    expect(runRule(punc002, input)).toHaveLength(0);
  });

  it("is never auto-fixable and has no fix", () => {
    const [issue] = runRule(punc002, "מה??");
    expect(issue?.fix).toBeUndefined();
  });

  it("respects configured limits", () => {
    expect(runRule(punc002, "??", { maxConsecutiveQuestionMarks: 2 })).toHaveLength(0);
    const issues = runRule(punc002, "???", { maxConsecutiveQuestionMarks: 2 });
    expect(rangesOf(issues)).toEqual([[0, 3]]);
    expect(issues[0]?.suggestion).toBe("??");
    expect(runRule(punc002, "!!", { maxConsecutiveQuestionMarks: 5 })).toHaveLength(1);
    expect(runRule(punc002, "!!", { maxConsecutiveExclamationMarks: 2 })).toHaveLength(0);
  });

  it("rejects invalid options", () => {
    expect(() => runRule(punc002, "??", { maxConsecutiveQuestionMarks: 0 })).toThrow();
  });

  it("handles niqqud", () => {
    const input = "שָׁלוֹם!!";
    const start = input.indexOf("!");
    expect(rangesOf(runRule(punc002, input))).toEqual([[start, start + 2]]);
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(punc002, "מה??");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
