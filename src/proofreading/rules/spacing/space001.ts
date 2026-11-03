import { z } from "zod";
import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";
import { findAll, isLineStart } from "../shared/matches";

const optionsSchema = z.object({ allowLeadingIndentation: z.boolean().default(false) });

const meta = {
  id: "HEB-SPACE-001",
  name: "רווחים רצופים",
  description: "שני רווחים או טאבים רצופים או יותר בתוך שורה",
  category: "spacing",
  defaultSeverity: "warning",
  enabledByDefault: true,
} as const;

/**
 * HEB-SPACE-001. Range: the whole run of spaces/tabs. Fix: one regular space.
 * Leading indentation is flagged unless `allowLeadingIndentation` is true.
 */
export const space001: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const { allowLeadingIndentation } = optionsSchema.parse(context.options);
    return findAll(context.text, /[ \t]{2,}/gu)
      .filter((m) => !(allowLeadingIndentation && isLineStart(context.text, m.range.start)))
      .map((m) =>
        createIssue({
          rule: meta,
          document: context.document,
          range: m.range,
          message: "רווחים או טאבים רצופים",
          explanation: "יש להשתמש ברווח יחיד בין מילים.",
          suggestion: " ",
          fix: { range: m.range, replacement: " " },
          autoFixable: true,
        }),
      );
  },
};
