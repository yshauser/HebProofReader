import { describe, expect, it } from "vitest";
import { expectRuleContract, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { cons002 } from "./cons002";

describe("HEB-CONS-002", () => {
  it.each([
    { input: "הוא הוא הגיע", ranges: [[0, 7]], suggestion: "הוא" },
    { input: "כן כן כן", ranges: [[0, 8]], suggestion: "כן" },
    { input: "Word word", ranges: [[0, 9]], suggestion: "Word" },
    { input: "the the עולם", ranges: [[0, 7]], suggestion: "the" },
    { input: "הוא\tהוא", ranges: [[0, 7]], suggestion: "הוא" },
    { input: "הוא\u00A0הוא", ranges: [[0, 7]], suggestion: "הוא" },
    { input: "הוא   הוא", ranges: [[0, 9]], suggestion: "הוא" },
    { input: "א א ב ג ג", ranges: [[0, 3], [6, 9]], suggestion: "א" },
    { input: "x\nא א", ranges: [[2, 5]], suggestion: "א" },
    { input: "הוא הוא", ranges: [[0, 7]], suggestion: "הוא" },
  ])("detects $input", ({ input, ranges, suggestion }) => {
    const issues = runRule(cons002, input);
    expect(rangesOf(issues)).toEqual(ranges);
    expect(issues[0]?.suggestion).toBe(suggestion);
    for (const issue of issues) {
      expect(issue.autoFixable).toBe(false);
      expect(issue.fix).toBeUndefined();
    }
  });

  it.each(["הוא הגיע", "", "הוא", "הוא\nהוא", "1 1", "הוא, הוא", "הוא-הוא", "הוא ג הוא"])(
    "does not flag %j",
    (input) => {
      expect(runRule(cons002, input)).toHaveLength(0);
    },
  );

  it("treats niqqud as insignificant and keeps the first occurrence text", () => {
    const input = "הוּא הוא";
    const issues = runRule(cons002, input);
    expect(rangesOf(issues)).toEqual([[0, input.length]]);
    expect(issues[0]?.suggestion).toBe("הוּא");
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(cons002, "הוא הוא");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
