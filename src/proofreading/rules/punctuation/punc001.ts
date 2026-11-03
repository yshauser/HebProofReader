import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";
import { findAll } from "../shared/matches";

const meta = {
  id: "HEB-PUNC-001",
  name: "פסיק כפול",
  description: "שני פסיקים רצופים או יותר, אפשר עם רווחים ביניהם",
  category: "punctuation",
  defaultSeverity: "warning",
  enabledByDefault: true,
} as const;

/** HEB-PUNC-001. Range: the whole sequence including spaces between commas. Fix: a single comma. */
export const punc001: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    return findAll(context.text, /,(?:[ \t]*,)+/gu).map((m) =>
      createIssue({
        rule: meta,
        document: context.document,
        range: m.range,
        message: "פסיקים כפולים",
        explanation: "יש להשאיר פסיק אחד בלבד.",
        suggestion: ",",
        fix: { range: m.range, replacement: "," },
        autoFixable: true,
      }),
    );
  },
};
