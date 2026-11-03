import { describe, expect, it } from "vitest";
import { expectRuleContract, fixAll, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { space004 } from "./space004";

describe("HEB-SPACE-004", () => {
  it.each([
    { input: "שלום .", ranges: [[4, 5]] },
    { input: "מה ? כן", ranges: [[2, 3]] },
    { input: "כן !", ranges: [[2, 3]] },
    { input: "א ; ב", ranges: [[1, 2]] },
    { input: "x : y", ranges: [[1, 2]] },
    { input: "שלום  .", ranges: [[4, 6]] },
    { input: "ל\t.", ranges: [[1, 2]] },
    { input: "א ...", ranges: [[1, 2]] },
    { input: "א .\nב ?", ranges: [[1, 2], [5, 6]] },
  ])("detects $input", ({ input, ranges }) => {
    const issues = runRule(space004, input);
    expect(rangesOf(issues)).toEqual(ranges);
    for (const issue of issues) {
      expect(issue.suggestion).toBe("");
      expect(issue.autoFixable).toBe(true);
    }
  });

  it.each(["שלום.", "", "א ב", "קובץ .env", "א .5", "א\n .", ".", "Hello world!"])(
    "does not flag %j",
    (input) => {
      expect(runRule(space004, input)).toHaveLength(0);
    },
  );

  it("handles niqqud", () => {
    const input = "שָׁלוֹם ?";
    const start = input.indexOf(" ");
    expect(rangesOf(runRule(space004, input))).toEqual([[start, start + 1]]);
  });

  it("fix removes the whitespace", () => {
    const input = "מה שלומך ? טוב .";
    expect(fixAll(input, runRule(space004, input))).toBe("מה שלומך? טוב.");
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(space004, "א .");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
