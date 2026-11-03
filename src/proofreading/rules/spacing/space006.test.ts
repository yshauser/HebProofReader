import { describe, expect, it } from "vitest";
import { expectRuleContract, fixAll, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { space006 } from "./space006";

describe("HEB-SPACE-006", () => {
  it.each([
    { input: "( טקסט )", ranges: [[1, 2], [6, 7]] },
    { input: "( )", ranges: [[1, 2]] },
    { input: "(א )", ranges: [[2, 3]] },
    { input: "( א)", ranges: [[1, 2]] },
    { input: "(\tא)", ranges: [[1, 2]] },
    { input: "f( x )", ranges: [[2, 3], [4, 5]] },
    { input: "א ( ב ) ג", ranges: [[3, 4], [5, 6]] },
  ])("detects $input", ({ input, ranges }) => {
    const issues = runRule(space006, input);
    expect(rangesOf(issues)).toEqual(ranges);
    for (const issue of issues) {
      expect(issue.suggestion).toBe("");
      expect(issue.autoFixable).toBe(true);
    }
  });

  it.each(["(טקסט)", "", "()", "(\nא\n)", "א\n )", "א (ב) ג", "[ א ]"])("does not flag %j", (input) => {
    expect(runRule(space006, input)).toHaveLength(0);
  });

  it("handles niqqud", () => {
    const input = "( שָׁלוֹם )";
    expect(rangesOf(runRule(space006, input))).toEqual([[1, 2], [input.length - 2, input.length - 1]]);
  });

  it("fix removes the inner whitespace", () => {
    const input = "( טקסט ) ו( אחר )";
    expect(fixAll(input, runRule(space006, input))).toBe("(טקסט) ו(אחר)");
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(space006, "( א )");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
