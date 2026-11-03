import { createPlainTextDocument } from "../../src/adapters/plain-text";
import type { ProofreadingIssue, ProofreadingRule } from "../../src/domain/proofreading";
import { applySafeFixes } from "../../src/proofreading/engine";
import { findIssueViolation } from "../../src/proofreading/engine/validate";

export const FIXED_CREATED_AT = "2020-01-01T00:00:00.000Z";

export function makeDocument(text: string, id = "test-doc") {
  return createPlainTextDocument(text, { id, createdAt: FIXED_CREATED_AT });
}

export function runRule(
  rule: ProofreadingRule,
  text: string,
  options: Record<string, unknown> = {},
): readonly ProofreadingIssue[] {
  return rule.check({ document: makeDocument(text), text, options });
}

/** Ranges as `[start, end]` tuples, for exact range assertions. */
export function rangesOf(issues: readonly ProofreadingIssue[]): Array<[number, number]> {
  return issues.map((issue) => [issue.range.start, issue.range.end]);
}

export function fixAll(text: string, issues: readonly ProofreadingIssue[]): string {
  return applySafeFixes(text, issues).text;
}

/** Contract checks every rule must satisfy; used by each rule's test file. */
export function expectRuleContract(rule: ProofreadingRule, sample: string) {
  const issues = runRule(rule, sample);
  const again = runRule(rule, sample);
  return {
    issues,
    deterministic: JSON.stringify(issues) === JSON.stringify(again),
    violations: issues.map((issue) => findIssueViolation(issue, rule, sample)).filter(Boolean),
    emptyInput: runRule(rule, ""),
  };
}
