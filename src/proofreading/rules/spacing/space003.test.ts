import { describe, expect, it } from "vitest";
import { expectRuleContract, fixAll, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { space003 } from "./space003";

describe("HEB-SPACE-003", () => {
  it.each([
    { input: "שלום,יוסף", ranges: [[5, 5]] },
    { input: "a,b", ranges: [[2, 2]] },
    { input: "1,a", ranges: [[2, 2]] },
    { input: "x,5", ranges: [[2, 2]] },
    { input: "א,ב,ג", ranges: [[2, 2], [4, 4]] },
    { input: "א,ב\nג,ד", ranges: [[2, 2], [6, 6]] },
    { input: "Hello,עולם", ranges: [[6, 6]] },
  ])("detects $input as a zero-length insertion", ({ input, ranges }) => {
    const issues = runRule(space003, input);
    expect(rangesOf(issues)).toEqual(ranges);
    for (const issue of issues) {
      expect(issue.originalText).toBe("");
      expect(issue.suggestion).toBe(" ");
      expect(issue.fix).toEqual({ range: issue.range, replacement: " " });
      expect(issue.autoFixable).toBe(true);
    }
  });

  it.each([
    "שלום, יוסף",
    "",
    ",",
    "שלום,",
    "1,000",
    "3,14",
    "א,\nב",
    "https://example.com/a,b",
    "me@a.com,b@c.com",
    "www.site.com/a,b",
  ])("does not flag %j", (input) => {
    expect(runRule(space003, input)).toHaveLength(0);
  });

  it("handles niqqud", () => {
    const input = "שָׁלוֹם,יוֹסֵף";
    const start = input.indexOf(",") + 1;
    expect(rangesOf(runRule(space003, input))).toEqual([[start, start]]);
  });

  it("fix inserts a space after the comma", () => {
    const input = "שלום,יוסף,דוד";
    expect(fixAll(input, runRule(space003, input))).toBe("שלום, יוסף, דוד");
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(space003, "א,ב");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
