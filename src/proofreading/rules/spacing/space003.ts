import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";
import { surroundingToken } from "../shared/matches";

const meta = {
  id: "HEB-SPACE-003",
  name: "חסר רווח אחרי פסיק",
  description: "פסיק שאחריו אות עברית, אות לטינית או ספרה ללא רווח",
  category: "spacing",
  defaultSeverity: "warning",
  enabledByDefault: true,
} as const;

const FOLLOWING = /[\u05D0-\u05EAA-Za-z0-9]/u;
const DIGIT = /[0-9]/u;

/** URLs, e-mail addresses and www hosts are machine identifiers: never touched. */
function isMachineIdentifier(token: string): boolean {
  return /:\/\/|@|^www\./iu.test(token);
}

/**
 * HEB-SPACE-003. Range: zero-length insertion point right after the comma. Fix: insert one space.
 * Exclusions: digit,digit (numeric grouping/decimal comma) and URL/e-mail tokens.
 */
export const space003: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const { text } = context;
    const issues: ProofreadingIssue[] = [];
    for (let i = 0; i < text.length - 1; i++) {
      if (text[i] !== ",") continue;
      const next = text[i + 1] ?? "";
      if (!FOLLOWING.test(next)) continue;
      if (DIGIT.test(text[i - 1] ?? "") && DIGIT.test(next)) continue;
      if (isMachineIdentifier(surroundingToken(text, i))) continue;
      const range = { start: i + 1, end: i + 1 };
      issues.push(
        createIssue({
          rule: meta,
          document: context.document,
          range,
          message: "חסר רווח אחרי פסיק",
          explanation: "יש להוסיף רווח אחרי פסיק.",
          suggestion: " ",
          fix: { range, replacement: " " },
          autoFixable: true,
        }),
      );
    }
    return issues;
  },
};
