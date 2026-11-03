import { describe, expect, it } from "vitest";
import { makeDocument } from "../../../tests/helpers/rules";
import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../domain/proofreading";
import { createRuleRegistry } from "../registry/registry";
import { createIssue } from "./createIssue";
import { runProofreading } from "./engine";

type Finder = (context: RuleContext, rule: ProofreadingRule) => ProofreadingIssue[];

function mockRule(id: string, find: Finder, overrides: Partial<ProofreadingRule> = {}): ProofreadingRule {
  const rule: ProofreadingRule = {
    id,
    name: id,
    description: id,
    category: "spacing",
    defaultSeverity: "warning",
    enabledByDefault: true,
    check: (context) => find(context, rule),
    ...overrides,
  };
  return rule;
}

const flag =
  (start: number, end: number, extra: { message?: string } = {}): Finder =>
  (context, rule) => [
    createIssue({ rule, document: context.document, range: { start, end }, message: extra.message ?? "msg" }),
  ];

const TEXT = "אבגדהוזחט";

describe("runProofreading", () => {
  it("runs enabled rules only", () => {
    const a = mockRule("T-A", flag(0, 1));
    const b = mockRule("T-B", flag(2, 3));
    const document = makeDocument(TEXT);
    const result = runProofreading({ document, rules: [a, b], enabledRuleIds: new Set(["T-B"]) });
    expect(result.issues.map((i) => i.ruleId)).toEqual(["T-B"]);
    expect(result.executedRuleIds).toEqual(["T-B"]);
  });

  it("defaults to enabledByDefault rules", () => {
    const a = mockRule("T-A", flag(0, 1));
    const off = mockRule("T-OFF", flag(2, 3), { enabledByDefault: false });
    const result = runProofreading({ document: makeDocument(TEXT), rules: [a, off] });
    expect(result.executedRuleIds).toEqual(["T-A"]);
  });

  it("isolates a throwing rule and keeps other results", () => {
    const bad = mockRule("T-BAD", () => {
      throw new TypeError("secret document text");
    });
    const good = mockRule("T-GOOD", flag(0, 1));
    const result = runProofreading({ document: makeDocument(TEXT), rules: [bad, good] });
    expect(result.issues.map((i) => i.ruleId)).toEqual(["T-GOOD"]);
    expect(result.errors).toEqual([{ ruleId: "T-BAD", kind: "exception", message: "TypeError" }]);
    expect(JSON.stringify(result.errors)).not.toContain("secret");
  });

  it("excludes and reports invalid issues", () => {
    const valid = mockRule("T-VALID", flag(0, 1));
    const forged = mockRule("T-FORGED", (context, rule) => {
      const base = createIssue({ rule, document: context.document, range: { start: 0, end: 2 }, message: "m" });
      return [
        { ...base, originalText: "wrong" },
        { ...base, id: "x1", range: { start: 5, end: 99 } },
        { ...base, id: "x2", message: "  " },
        { ...base, id: "x3", ruleId: "OTHER" },
        { ...base, id: "x4", autoFixable: true },
        { ...base, id: "x5", range: { start: 3, end: 3 }, originalText: "" },
        { ...base, id: "x6", fix: { range: { start: 0, end: 99 }, replacement: "" } },
      ];
    });
    const result = runProofreading({ document: makeDocument(TEXT), rules: [valid, forged] });
    expect(result.issues.map((i) => i.ruleId)).toEqual(["T-VALID"]);
    expect(result.errors.map((e) => e.message)).toEqual([
      "original-text-mismatch",
      "range-out-of-bounds",
      "empty-message",
      "ruleId-mismatch",
      "auto-fixable-without-fix",
      "empty-range-without-suggestion",
      "fix-range-invalid",
    ]);
    expect(result.errors.every((e) => e.kind === "invalid-issue")).toBe(true);
  });

  it("deduplicates exact duplicates", () => {
    const twice = mockRule("T-DUP", (context, rule) => [
      ...flag(0, 1)(context, rule),
      ...flag(0, 1)(context, rule),
    ]);
    const result = runProofreading({ document: makeDocument(TEXT), rules: [twice] });
    expect(result.issues).toHaveLength(1);
  });

  it("keeps same-range findings from different rules", () => {
    const a = mockRule("T-A", flag(0, 1));
    const b = mockRule("T-B", flag(0, 1));
    const result = runProofreading({ document: makeDocument(TEXT), rules: [a, b] });
    expect(result.issues.map((i) => i.ruleId)).toEqual(["T-A", "T-B"]);
  });

  it("sorts by start, end, severity, then rule id regardless of rule order", () => {
    const late = mockRule("T-Z", flag(5, 6));
    const early = mockRule("T-Y", flag(1, 4));
    const shorter = mockRule("T-X", flag(1, 2));
    const infoSame = mockRule("T-A-INFO", flag(1, 4), { defaultSeverity: "info" });
    const errSame = mockRule("T-B-ERR", flag(1, 4), { defaultSeverity: "error" });
    const rules = [late, early, shorter, infoSame, errSame];
    const forward = runProofreading({ document: makeDocument(TEXT), rules });
    const backward = runProofreading({ document: makeDocument(TEXT), rules: [...rules].reverse() });
    expect(forward.issues.map((i) => i.ruleId)).toEqual(["T-X", "T-B-ERR", "T-Y", "T-A-INFO", "T-Z"]);
    expect(backward.issues).toEqual(forward.issues);
  });

  it("identifies overlaps but not adjacent ranges", () => {
    const rules = [
      mockRule("T-1", flag(0, 3)),
      mockRule("T-2", flag(2, 5)),
      mockRule("T-3", flag(5, 7)),
      mockRule("T-4", flag(8, 9)),
    ];
    const result = runProofreading({ document: makeDocument(TEXT), rules });
    const id = (ruleId: string) => result.issues.find((i) => i.ruleId === ruleId)?.id;
    expect(result.overlaps).toEqual([{ firstId: id("T-1"), secondId: id("T-2") }]);
  });

  it("treats insertions inside a range or at the same point as overlapping", () => {
    const insert = (position: number): Finder => (context, rule) => [
      createIssue({
        rule,
        document: context.document,
        range: { start: position, end: position },
        message: "m",
        suggestion: " ",
      }),
    ];
    const rules = [
      mockRule("T-RANGE", flag(1, 5)),
      mockRule("T-IN", insert(3)),
      mockRule("T-EDGE", insert(5)),
      mockRule("T-SAME-A", insert(7)),
      mockRule("T-SAME-B", insert(7)),
    ];
    const result = runProofreading({ document: makeDocument(TEXT), rules });
    const pairs = result.overlaps.map((o) => {
      const first = result.issues.find((i) => i.id === o.firstId)?.ruleId;
      const second = result.issues.find((i) => i.id === o.secondId)?.ruleId;
      return `${first}|${second}`;
    });
    expect(pairs).toEqual(["T-RANGE|T-IN", "T-SAME-A|T-SAME-B"]);
  });

  it("passes per-rule options and the document text to rules", () => {
    let seen: unknown;
    const rule = mockRule("T-OPT", (context) => {
      seen = [context.options, context.text];
      return [];
    });
    runProofreading({ document: makeDocument("abc"), rules: [rule], ruleOptions: { "T-OPT": { n: 1 } } });
    expect(seen).toEqual([{ n: 1 }, "abc"]);
  });

  it("is deterministic across runs and independent of document creation time", () => {
    const rules = [mockRule("T-A", flag(0, 1)), mockRule("T-B", flag(2, 3))];
    const first = runProofreading({ document: makeDocument(TEXT), rules });
    const second = runProofreading({ document: { ...makeDocument(TEXT), metadata: { language: "he", createdAt: "2030-01-01" } }, rules });
    expect(second).toEqual(first);
  });

  it("handles empty text", () => {
    const result = runProofreading({ document: makeDocument(""), rules: [mockRule("T-A", () => [])] });
    expect(result.issues).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("works with a registry", () => {
    const registry = createRuleRegistry([mockRule("T-B", flag(0, 1)), mockRule("T-A", flag(1, 2))]);
    expect(registry.list().map((r) => r.id)).toEqual(["T-A", "T-B"]);
    expect(registry.get("T-A")?.id).toBe("T-A");
    expect(registry.get("missing")).toBeUndefined();
    expect(() => createRuleRegistry([mockRule("D", () => []), mockRule("D", () => [])])).toThrow(/Duplicate/);
  });
});
