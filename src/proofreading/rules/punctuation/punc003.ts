import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";
import { findUnbalancedBrackets } from "../shared/brackets";

const meta = {
  id: "HEB-PUNC-003",
  name: "סוגריים עגולים לא מאוזנים",
  description: "סוגר עגול פותח או סוגר ללא סוגר מתאים",
  category: "punctuation",
  defaultSeverity: "error",
  enabledByDefault: true,
} as const;

/**
 * Closers that are legitimately unpaired: list enumerators at line start ("1)", "א)", "a)")
 * and emoticons (":)", ";)").
 */
function isLegitimateUnpairedCloser(text: string, index: number): boolean {
  const previous = text[index - 1];
  if (previous === ":" || previous === ";") return true;
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  return /^[ \t]*(?:\d{1,3}|[\u05D0-\u05EA]|[A-Za-z])$/u.test(text.slice(lineStart, index));
}

/**
 * HEB-PUNC-003. Stack-based scan over the whole document. Range: the single offending
 * parenthesis. Not auto-fixable. Reported in logical (not visual) order, so RTL mirroring is irrelevant.
 */
export const punc003: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const { text, document } = context;
    const { unmatchedClose, unmatchedOpen } = findUnbalancedBrackets(text, "(", ")", (i) =>
      isLegitimateUnpairedCloser(text, i),
    );
    const build = (index: number, message: string, explanation: string) =>
      createIssue({ rule: meta, document, range: { start: index, end: index + 1 }, message, explanation });
    return [
      ...unmatchedClose.map((i) =>
        build(i, "סוגר סוגר ללא סוגר פותח", "חסר סוגר פותח מתאים, או שהסוגר מיותר."),
      ),
      ...unmatchedOpen.map((i) =>
        build(i, "סוגר פותח ללא סוגר סוגר", "חסר סוגר סוגר מתאים, או שהסוגר מיותר."),
      ),
    ];
  },
};
