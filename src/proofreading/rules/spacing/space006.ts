import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";

const meta = {
  id: "HEB-SPACE-006",
  name: "רווח בתוך סוגריים",
  description: "רווח אחרי סוגר פותח או לפני סוגר סוגר",
  category: "spacing",
  defaultSeverity: "warning",
  enabledByDefault: true,
} as const;

/**
 * HEB-SPACE-006. Range: the whitespace only. Fix: remove it. Round parentheses only.
 * Whitespace before ")" must follow a non-space character on the same line.
 */
export const space006: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const issues: ProofreadingIssue[] = [];
    // "( " (whitespace after opener) or "x )" (whitespace after a non-space char, before closer).
    for (const m of context.text.matchAll(/\([ \t]+|\S[ \t]+\)/gu)) {
      const opening = m[0].startsWith("(");
      const range = opening
        ? { start: m.index + 1, end: m.index + m[0].length }
        : { start: m.index + 1, end: m.index + m[0].length - 1 };
      issues.push(
        createIssue({
          rule: meta,
          document: context.document,
          range,
          message: opening ? "רווח אחרי סוגר פותח" : "רווח לפני סוגר סוגר",
          explanation: "אין להשאיר רווח בין הסוגריים לתוכנם.",
          suggestion: "",
          fix: { range, replacement: "" },
          autoFixable: true,
        }),
      );
    }
    return issues;
  },
};
