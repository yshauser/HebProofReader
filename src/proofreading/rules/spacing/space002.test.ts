import { describe, expect, it } from "vitest";
import { expectRuleContract, fixAll, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { space002 } from "./space002";

describe("HEB-SPACE-002", () => {
  it.each([
    { input: "שלום ,יוסף", ranges: [[4, 5]], text: " " },
    { input: "א  ,ב", ranges: [[1, 3]], text: "  " },
    { input: "א\t,ב", ranges: [[1, 2]], text: "\t" },
    { input: "Hello ,world", ranges: [[5, 6]], text: " " },
    { input: "א ,", ranges: [[1, 2]], text: " " },
    { input: "א\nב ,ג", ranges: [[3, 4]], text: " " },
  ])("detects $input", ({ input, ranges, text }) => {
    const issues = runRule(space002, input);
    expect(rangesOf(issues)).toEqual(ranges);
    expect(issues[0]?.originalText).toBe(text);
    expect(issues[0]?.suggestion).toBe("");
    expect(issues[0]?.autoFixable).toBe(true);
  });

  it("detects multiple occurrences", () => {
    expect(rangesOf(runRule(space002, "א ,ב ,ג"))).toEqual([[1, 2], [4, 5]]);
  });

  it.each(["שלום, יוסף", "", "שלום", ",", " ,א", "א\n ,ב", "א ."])("does not flag %j", (input) => {
    expect(runRule(space002, input)).toHaveLength(0);
  });

  it("handles niqqud", () => {
    const input = "שָׁלוֹם ,יוֹסֵף";
    const start = input.indexOf(" ");
    expect(rangesOf(runRule(space002, input))).toEqual([[start, start + 1]]);
  });

  it("fix removes the whitespace", () => {
    const input = "שלום ,יוסף";
    expect(fixAll(input, runRule(space002, input))).toBe("שלום,יוסף");
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(space002, "א ,ב");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
