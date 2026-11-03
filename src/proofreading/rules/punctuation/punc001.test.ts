import { describe, expect, it } from "vitest";
import { expectRuleContract, fixAll, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { punc001 } from "./punc001";

describe("HEB-PUNC-001", () => {
  it.each([
    { input: "שלום,, יוסף", ranges: [[4, 6]], text: ",," },
    { input: "א, ,ב", ranges: [[1, 4]], text: ", ," },
    { input: ",,,", ranges: [[0, 3]], text: ",,," },
    { input: "א,,,ב", ranges: [[1, 4]], text: ",,," },
    { input: "a,\t,b", ranges: [[1, 4]], text: ",\t," },
    { input: "א,,ב\nג,,ד", ranges: [[1, 3], [6, 8]], text: ",," },
  ])("detects $input", ({ input, ranges, text }) => {
    const issues = runRule(punc001, input);
    expect(rangesOf(issues)).toEqual(ranges);
    for (const issue of issues) {
      expect(issue.originalText).toBe(text);
      expect(issue.suggestion).toBe(",");
      expect(issue.autoFixable).toBe(true);
    }
  });

  it.each(["א, ב", "", ",", "א,\n,ב", "א,"])("does not flag %j", (input) => {
    expect(runRule(punc001, input)).toHaveLength(0);
  });

  it("handles niqqud", () => {
    const input = "שָׁלוֹם,, עוֹלָם";
    const start = input.indexOf(",");
    expect(rangesOf(runRule(punc001, input))).toEqual([[start, start + 2]]);
  });

  it("fix leaves a single comma", () => {
    expect(fixAll("שלום,, יוסף , , דוד", runRule(punc001, "שלום,, יוסף , , דוד"))).toBe("שלום, יוסף , דוד");
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(punc001, "א,,ב");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
