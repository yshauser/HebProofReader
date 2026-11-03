import { describe, expect, it } from "vitest";
import { expectRuleContract, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { space005 } from "./space005";

describe("HEB-SPACE-005", () => {
  it.each([
    { input: "שלום.מה", ranges: [[5, 5]] },
    { input: "מה?כן", ranges: [[3, 3]] },
    { input: "שלום!מה", ranges: [[5, 5]] },
    { input: "שלום:מה", ranges: [[5, 5]] },
    { input: "שלום;מה", ranges: [[5, 5]] },
    { input: "אבג.דהו\nכן?לא", ranges: [[4, 4], [11, 11]] },
    { input: "Hello.עולם", ranges: [[6, 6]] },
  ])("detects $input as a zero-length insertion", ({ input, ranges }) => {
    const issues = runRule(space005, input);
    expect(rangesOf(issues)).toEqual(ranges);
    for (const issue of issues) {
      expect(issue.originalText).toBe("");
      expect(issue.suggestion).toBe(" ");
    }
  });

  it("is never auto-fixable", () => {
    const [issue] = runRule(space005, "שלום.מה");
    expect(issue?.autoFixable).toBe(false);
    expect(issue?.fix).toBeUndefined();
  });

  it.each([
    "שלום. מה",
    "",
    ".",
    "example.com",
    "e.g",
    "ת.ז",
    "ב.מה",
    "www.site.co.il",
    "http://x.y",
    "a@b.com",
    "3.14",
    "3.x",
    "...שלום",
    ":D",
    "א :D",
    "std::vector",
    "&amp;x",
    "שלום.\nמה",
    "שלום.",
  ])("does not flag %j", (input) => {
    expect(runRule(space005, input)).toHaveLength(0);
  });

  it("handles niqqud", () => {
    const input = "שָׁלוֹם.מה";
    const start = input.indexOf(".") + 1;
    expect(rangesOf(runRule(space005, input))).toEqual([[start, start]]);
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(space005, "שלום.מה");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
