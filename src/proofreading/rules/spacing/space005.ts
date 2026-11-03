import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";
import { surroundingToken } from "../shared/matches";

const meta = {
  id: "HEB-SPACE-005",
  name: "חסר רווח אחרי סימן סיום",
  description: "סימן סיום (. ? ! : ;) שאחריו אות ללא רווח",
  category: "spacing",
  defaultSeverity: "warning",
  enabledByDefault: true,
} as const;

const LETTER = /\p{L}/u;
const LATIN = /[A-Za-z]/u;
const TERMINAL = new Set([".", "?", "!", ":", ";"]);

/** Length of the run of letters/marks that ends right before `index`. */
function precedingWordLength(text: string, index: number): number {
  let n = 0;
  while (index - n > 0 && /[\p{L}\p{M}]/u.test(text[index - n - 1] ?? "")) n++;
  return n;
}

function isExcluded(text: string, i: number): boolean {
  const mark = text[i] ?? "";
  const prev = text[i - 1] ?? "";
  const next = text[i + 1] ?? "";
  const token = surroundingToken(text, i);
  if (i === 0 || /\s/u.test(prev)) return true; // emoticons such as ":D", ";P"
  if (mark === "." && prev === ".") return true; // ellipsis
  if (mark === ":" && prev === ":") return true; // scope operator: std::vector
  if (/:\/\/|@|^www\./iu.test(token)) return true; // URLs, e-mail
  if (LATIN.test(prev) && LATIN.test(next)) return true; // example.com, std::vector, e.g
  if (mark === "." && precedingWordLength(text, i) === 1) return true; // single-letter abbreviation: ת.ז, U.S
  if (mark === "." && /\p{Nd}/u.test(prev)) return true; // version/section numbers: 3.x
  if (mark === ";" && /&[A-Za-z0-9#]+$/u.test(text.slice(0, i))) return true; // HTML entity
  return false;
}

/**
 * HEB-SPACE-005. Range: zero-length insertion point right after the mark. Suggestion: one space.
 * Never auto-fixable: abbreviation/identifier exclusions are heuristic, so the fix is left to the user.
 */
export const space005: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const { text } = context;
    const issues: ProofreadingIssue[] = [];
    for (let i = 0; i < text.length - 1; i++) {
      if (!TERMINAL.has(text[i] ?? "")) continue;
      if (!LETTER.test(text[i + 1] ?? "")) continue;
      if (isExcluded(text, i)) continue;
      issues.push(
        createIssue({
          rule: meta,
          document: context.document,
          range: { start: i + 1, end: i + 1 },
          message: "חסר רווח אחרי סימן סיום",
          explanation: "יש להוסיף רווח אחרי נקודה, סימן שאלה, סימן קריאה, נקודתיים או נקודה ופסיק.",
          suggestion: " ",
          autoFixable: false,
        }),
      );
    }
    return issues;
  },
};
