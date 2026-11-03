import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { normalizeWordForComparison } from "../../normalization";
import { createIssue } from "../../engine/createIssue";
import { isHorizontalWhitespace, tokenize } from "../../tokenizer";

const meta = {
  id: "HEB-CONS-002",
  name: "מילה חוזרת",
  description: "אותה מילה פעמיים ברצף, מופרדת ברווחים בלבד",
  category: "consistency",
  defaultSeverity: "warning",
  enabledByDefault: true,
} as const;

/**
 * HEB-CONS-002. Niqqud and cantillation are NOT significant for comparison; Latin is case-folded.
 * Only horizontal whitespace may separate the words (a line break ends the sequence).
 * Range: the whole run of repeated words. Suggestion-only: the first occurrence.
 */
export const cons002: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const tokens = tokenize(context.text);
    const issues: ProofreadingIssue[] = [];
    let i = 0;
    while (i < tokens.length) {
      const first = tokens[i];
      const key = first?.kind === "word" ? normalizeWordForComparison(first.value) : "";
      if (!first || key === "") {
        i++;
        continue;
      }
      let last = first;
      let j = i;
      for (;;) {
        const gap = tokens[j + 1];
        const next = tokens[j + 2];
        if (
          gap?.kind === "whitespace" &&
          isHorizontalWhitespace(gap.value) &&
          next?.kind === "word" &&
          normalizeWordForComparison(next.value) === key
        ) {
          last = next;
          j += 2;
        } else break;
      }
      if (j > i) {
        issues.push(
          createIssue({
            rule: meta,
            document: context.document,
            range: { start: first.range.start, end: last.range.end },
            message: "מילה חוזרת ברצף",
            explanation: "אותה מילה מופיעה פעמיים ברצף. אם החזרה מכוונת, אפשר להתעלם מהממצא.",
            suggestion: first.value,
            autoFixable: false,
          }),
        );
      }
      i = j + 1;
    }
    return issues;
  },
};
