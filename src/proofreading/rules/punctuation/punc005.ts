import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";
import { findUnbalancedBrackets } from "../shared/brackets";

const meta = {
  id: "HEB-PUNC-005",
  name: "סוגריים מסולסלים לא מאוזנים",
  description: "סוגר מסולסל פותח או סוגר ללא סוגר מתאים",
  category: "punctuation",
  defaultSeverity: "error",
  enabledByDefault: true,
} as const;

/** HEB-PUNC-005. Same convention as HEB-PUNC-003, for "{" and "}". Not auto-fixable. */
export const punc005: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const { document } = context;
    const { unmatchedClose, unmatchedOpen } = findUnbalancedBrackets(context.text, "{", "}");
    const build = (index: number, message: string, explanation: string) =>
      createIssue({ rule: meta, document, range: { start: index, end: index + 1 }, message, explanation });
    return [
      ...unmatchedClose.map((i) =>
        build(i, "סוגר מסולסל סוגר ללא סוגר פותח", "חסר סוגר מסולסל פותח מתאים, או שהסוגר מיותר."),
      ),
      ...unmatchedOpen.map((i) =>
        build(i, "סוגר מסולסל פותח ללא סוגר סוגר", "חסר סוגר מסולסל סוגר מתאים, או שהסוגר מיותר."),
      ),
    ];
  },
};
