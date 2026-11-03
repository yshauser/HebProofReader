import { z } from "zod";
import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";
import { findAll } from "../shared/matches";

const optionsSchema = z.object({
  maxConsecutiveQuestionMarks: z.number().int().min(1).default(1),
  maxConsecutiveExclamationMarks: z.number().int().min(1).default(1),
});

const meta = {
  id: "HEB-PUNC-002",
  name: "סימני שאלה או קריאה חוזרים",
  description: "חזרה על ? או ! מעבר למספר המותר (ברירת מחדל: מותר סימן אחד)",
  category: "punctuation",
  defaultSeverity: "info",
  enabledByDefault: true,
} as const;

/**
 * HEB-PUNC-002. Range: the whole run. Suggestion-only (never auto-fixable): repetition may be
 * intentional in expressive writing. Mixed runs such as "?!" are not flagged.
 */
export const punc002: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const options = optionsSchema.parse(context.options);
    const limits: Array<[RegExp, string, number]> = [
      [/\?{2,}/gu, "?", options.maxConsecutiveQuestionMarks],
      [/!{2,}/gu, "!", options.maxConsecutiveExclamationMarks],
    ];
    return limits.flatMap(([pattern, mark, max]) =>
      findAll(context.text, pattern)
        .filter((m) => m.value.length > max)
        .map((m) =>
          createIssue({
            rule: meta,
            document: context.document,
            range: m.range,
            message: mark === "?" ? "סימני שאלה חוזרים" : "סימני קריאה חוזרים",
            explanation: "בכתיבה תקנית מקובל סימן אחד. אם החזרה מכוונת, אפשר להתעלם מהממצא.",
            suggestion: mark.repeat(max),
            autoFixable: false,
          }),
        ),
    );
  },
};
