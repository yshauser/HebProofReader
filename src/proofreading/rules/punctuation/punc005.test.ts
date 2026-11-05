import { describe, expect, it } from "vitest";
import { expectRuleContract, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { punc005 } from "./punc005";

describe("HEB-PUNC-005", () => {
  it.each([
    { input: "{א", ranges: [[0, 1]], text: "{" },
    { input: "א}", ranges: [[1, 2]], text: "}" },
    { input: "{{א}", ranges: [[0, 1]], text: "{" },
    { input: "{א}}", ranges: [[3, 4]], text: "}" },
    { input: "1}", ranges: [[1, 2]], text: "}" },
    { input: "(א}", ranges: [[2, 3]], text: "}" },
    { input: "Hello {עולם", ranges: [[6, 7]], text: "{" },
    { input: "} {", ranges: [[0, 1], [2, 3]], text: "}" },
  ])("detects $input", ({ input, ranges, text }) => {
    const issues = runRule(punc005, input);
    expect(rangesOf(issues)).toEqual(ranges);
    expect(issues[0]?.originalText).toBe(text);
    for (const issue of issues) {
      expect(issue.autoFixable).toBe(false);
      expect(issue.fix).toBeUndefined();
    }
  });

  it.each(["{א}", "", "{}", "{א\nב}", "(א)", "{א} ו{ב}"])("does not flag %j", (input) => {
    expect(runRule(punc005, input)).toHaveLength(0);
  });

  it("handles niqqud", () => {
    expect(rangesOf(runRule(punc005, "{שָׁלוֹם"))).toEqual([[0, 1]]);
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(punc005, "{א}}");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
