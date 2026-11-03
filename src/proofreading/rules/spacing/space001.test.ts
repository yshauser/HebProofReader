import { describe, expect, it } from "vitest";
import { expectRuleContract, fixAll, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { space001 } from "./space001";

describe("HEB-SPACE-001", () => {
  it.each([
    { input: "זהו  טקסט", ranges: [[3, 5]] },
    { input: "א  ב   ג", ranges: [[1, 3], [4, 7]] },
    { input: "א\t\tב", ranges: [[1, 3]] },
    { input: "א \t ב", ranges: [[1, 4]] },
    { input: "Hello  עולם", ranges: [[5, 7]] },
    { input: "א  \nב", ranges: [[1, 3]] },
    { input: "  א", ranges: [[0, 2]] },
    { input: "א  ", ranges: [[1, 3]] },
  ])("detects $input", ({ input, ranges }) => {
    const issues = runRule(space001, input);
    expect(rangesOf(issues)).toEqual(ranges);
    for (const issue of issues) {
      expect(issue.originalText).toBe(input.slice(issue.range.start, issue.range.end));
      expect(issue.suggestion).toBe(" ");
      expect(issue.autoFixable).toBe(true);
    }
  });

  it.each(["זהו טקסט", "", "א\nב", "א\tב", "א \n ב", " "])("does not flag %j", (input) => {
    expect(runRule(space001, input)).toHaveLength(0);
  });

  it("handles niqqud", () => {
    const input = "שָׁלוֹם  עוֹלָם";
    const start = input.indexOf("  ");
    expect(rangesOf(runRule(space001, input))).toEqual([[start, start + 2]]);
  });

  it("flags leading indentation by default and skips it when allowed", () => {
    const input = "א \n  ב  ג";
    expect(rangesOf(runRule(space001, input))).toEqual([[3, 5], [6, 8]]);
    expect(rangesOf(runRule(space001, input, { allowLeadingIndentation: true }))).toEqual([[6, 8]]);
  });

  it("rejects invalid options", () => {
    expect(() => runRule(space001, "א", { allowLeadingIndentation: "yes" })).toThrow();
  });

  it("fix produces a single space", () => {
    const input = "זהו  טקסט\t\tארוך";
    expect(fixAll(input, runRule(space001, input))).toBe("זהו טקסט ארוך");
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(space001, "א  ב");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
