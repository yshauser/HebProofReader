import { isValidRange } from "../../domain/document";
import type { ProofreadingIssue, ProofreadingRule } from "../../domain/proofreading";

/** Returns a reason string when the issue violates an invariant; otherwise undefined. */
export function findIssueViolation(
  issue: ProofreadingIssue,
  rule: Pick<ProofreadingRule, "id">,
  text: string,
): string | undefined {
  if (issue.ruleId !== rule.id) return "ruleId-mismatch";
  if (!issue.id) return "missing-id";
  if (issue.message.trim() === "") return "empty-message";
  if (!isValidRange(issue.range, text.length)) return "range-out-of-bounds";
  if (issue.originalText !== text.slice(issue.range.start, issue.range.end)) return "original-text-mismatch";
  if (issue.range.start === issue.range.end && !issue.suggestion) return "empty-range-without-suggestion";
  if (issue.fix && !isValidRange(issue.fix.range, text.length)) return "fix-range-invalid";
  if (issue.autoFixable && !issue.fix) return "auto-fixable-without-fix";
  return undefined;
}
