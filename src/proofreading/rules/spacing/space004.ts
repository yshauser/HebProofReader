import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";

const meta = {
  id: "HEB-SPACE-004",
  name: "רווח לפני סימן סיום",
  description: "רווח או טאב לפני . ? ! : או ;",
  category: "spacing",
  defaultSeverity: "warning",
  enabledByDefault: true,
} as const;

/**
 * HEB-SPACE-004. Range: the whitespace only. Fix: remove it.
 * Exclusions: indentation at line start, and punctuation attached to a following letter or
 * digit (e.g. " .env", " :D"), which is not terminal punctuation.
 */
export const space004: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const issues: ProofreadingIssue[] = [];
    // group 1: preceding non-space character; group 2: whitespace; group 3: the punctuation mark.
    for (const m of context.text.matchAll(/(\S)([ \t]+)([.?!:;])/gu)) {
      const start = m.index + (m[1]?.length ?? 0);
      const range = { start, end: start + (m[2]?.length ?? 0) };
      const after = context.text[range.end + 1] ?? "";
      if (/[\p{L}\p{Nd}]/u.test(after)) continue;
      issues.push(
        createIssue({
          rule: meta,
          document: context.document,
          range,
          message: "רווח לפני סימן סיום",
          explanation: "אין להשאיר רווח לפני נקודה, סימן שאלה, סימן קריאה, נקודתיים או נקודה ופסיק.",
          suggestion: "",
          fix: { range, replacement: "" },
          autoFixable: true,
        }),
      );
    }
    return issues;
  },
};
