import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";

const meta = {
  id: "HEB-SPACE-002",
  name: "רווח לפני פסיק",
  description: "רווח או טאב מיד לפני פסיק",
  category: "spacing",
  defaultSeverity: "warning",
  enabledByDefault: true,
} as const;

/**
 * HEB-SPACE-002. Range: the whitespace only (not the comma). Fix: remove it.
 * Whitespace at the start of a line (indentation) is not flagged.
 */
export const space002: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const issues: ProofreadingIssue[] = [];
    // group 1: the preceding non-space character; group 2: the whitespace run.
    for (const m of context.text.matchAll(/(\S)([ \t]+)(?=,)/gu)) {
      const start = m.index + (m[1]?.length ?? 0);
      const range = { start, end: start + (m[2]?.length ?? 0) };
      issues.push(
        createIssue({
          rule: meta,
          document: context.document,
          range,
          message: "רווח לפני פסיק",
          explanation: "אין להשאיר רווח בין מילה לבין הפסיק שאחריה.",
          suggestion: "",
          fix: { range, replacement: "" },
          autoFixable: true,
        }),
      );
    }
    return issues;
  },
};
