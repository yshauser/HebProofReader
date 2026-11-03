import { describe, expect, it } from "vitest";
import { expectRuleContract, fixAll, rangesOf, runRule } from "../../../../tests/helpers/rules";
import { typo003 } from "./typo003";

describe("HEB-TYPO-003", () => {
  it.each([
    { input: "א\u00A0ב", ranges: [[1, 2]], code: "U+00A0" },
    { input: "א\u200Bב", ranges: [[1, 2]], code: "U+200B" },
    { input: "\uFEFFא", ranges: [[0, 1]], code: "U+FEFF" },
    { input: "א\u00A0\nב", ranges: [[1, 2]], code: "U+00A0" },
    { input: "Hello\u00A0world", ranges: [[5, 6]], code: "U+00A0" },
    { input: "א\u2009ב", ranges: [[1, 2]], code: "U+2009" },
    { input: "א\u202Fב", ranges: [[1, 2]], code: "U+202F" },
    { input: "\u2060א", ranges: [[0, 1]], code: "U+2060" },
  ])("detects $code in $input", ({ input, ranges, code }) => {
    const issues = runRule(typo003, input);
    expect(rangesOf(issues)).toEqual(ranges);
    expect(issues[0]?.message).toContain(code);
    expect(issues[0]?.originalText).toBe(input.slice(ranges[0]?.[0], ranges[0]?.[1]));
  });

  it("reports each character separately", () => {
    expect(rangesOf(runRule(typo003, "\u00A0\u00A0א\u200B"))).toEqual([[0, 1], [1, 2], [3, 4]]);
  });

  it.each(["א ב", "", "א\u200Fב", "א\u200Eב", "א\u200Dב", "א\u200Cב", "\u00ADא", "שָׁלוֹם עוֹלָם"])(
    "does not flag %j",
    (input) => {
      expect(runRule(typo003, input)).toHaveLength(0);
    },
  );

  it("removes zero-width characters automatically", () => {
    const [issue] = runRule(typo003, "א\u200Bב");
    expect(issue?.autoFixable).toBe(true);
    expect(issue?.fix?.replacement).toBe("");
    expect(fixAll("א\u200Bב\uFEFF", runRule(typo003, "א\u200Bב\uFEFF"))).toBe("אב");
  });

  it("does not auto-fix spaces by default but suggests a regular space", () => {
    const [issue] = runRule(typo003, "א\u00A0ב");
    expect(issue?.autoFixable).toBe(false);
    expect(issue?.fix).toBeUndefined();
    expect(issue?.suggestion).toBe(" ");
  });

  it("auto-fixes spaces when configured", () => {
    const input = "א\u00A0ב";
    const issues = runRule(typo003, input, { autoFixSpaces: true });
    expect(issues[0]?.autoFixable).toBe(true);
    expect(fixAll(input, issues)).toBe("א ב");
  });

  it("rejects invalid options", () => {
    expect(() => runRule(typo003, "א", { autoFixSpaces: 1 })).toThrow();
  });

  it("satisfies the rule contract", () => {
    const c = expectRuleContract(typo003, "א\u00A0ב\u200B");
    expect(c.deterministic).toBe(true);
    expect(c.violations).toEqual([]);
    expect(c.emptyInput).toEqual([]);
  });
});
