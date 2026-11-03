import { z } from "zod";
import type { ProofreadingIssue, ProofreadingRule, RuleContext } from "../../../domain/proofreading";
import { createIssue } from "../../engine/createIssue";

const optionsSchema = z.object({ autoFixSpaces: z.boolean().default(false) });

const meta = {
  id: "HEB-TYPO-003",
  name: "רווח קשיח או תו בלתי נראה",
  description: "רווחים קשיחים, רווחים מיוחדים ותווים בעלי רוחב אפס",
  category: "typography",
  defaultSeverity: "info",
  enabledByDefault: true,
} as const;

interface SpecialCharacter {
  name: string;
  /** "zero-width" characters have no visible effect; "space" characters render as spacing. */
  kind: "zero-width" | "space";
}

const SPECIAL_CHARACTERS = new Map<string, SpecialCharacter>([
  ["\u00A0", { name: "רווח קשיח (NO-BREAK SPACE)", kind: "space" }],
  ["\u1680", { name: "רווח אוגהם (OGHAM SPACE MARK)", kind: "space" }],
  ["\u2000", { name: "EN QUAD", kind: "space" }],
  ["\u2001", { name: "EM QUAD", kind: "space" }],
  ["\u2002", { name: "EN SPACE", kind: "space" }],
  ["\u2003", { name: "EM SPACE", kind: "space" }],
  ["\u2004", { name: "THREE-PER-EM SPACE", kind: "space" }],
  ["\u2005", { name: "FOUR-PER-EM SPACE", kind: "space" }],
  ["\u2006", { name: "SIX-PER-EM SPACE", kind: "space" }],
  ["\u2007", { name: "FIGURE SPACE", kind: "space" }],
  ["\u2008", { name: "PUNCTUATION SPACE", kind: "space" }],
  ["\u2009", { name: "THIN SPACE", kind: "space" }],
  ["\u200A", { name: "HAIR SPACE", kind: "space" }],
  ["\u202F", { name: "רווח קשיח צר (NARROW NO-BREAK SPACE)", kind: "space" }],
  ["\u205F", { name: "MEDIUM MATHEMATICAL SPACE", kind: "space" }],
  ["\u3000", { name: "IDEOGRAPHIC SPACE", kind: "space" }],
  ["\u200B", { name: "ZERO WIDTH SPACE", kind: "zero-width" }],
  ["\u2060", { name: "WORD JOINER", kind: "zero-width" }],
  ["\uFEFF", { name: "ZERO WIDTH NO-BREAK SPACE (BOM)", kind: "zero-width" }],
]);

/**
 * HEB-TYPO-003. One finding per character; the message names the Unicode code point.
 * Directional marks (LRM/RLM/embedding controls), ZWJ/ZWNJ and soft hyphen are legitimate in
 * Hebrew/bidi text and are NOT flagged.
 * Auto-fix: zero-width characters are removed. Spaces are replaced by a regular space only when
 * `autoFixSpaces` is true (default false, since non-breaking spaces are sometimes intentional).
 */
export const typo003: ProofreadingRule = {
  ...meta,
  check(context: RuleContext): readonly ProofreadingIssue[] {
    const { autoFixSpaces } = optionsSchema.parse(context.options);
    const issues: ProofreadingIssue[] = [];
    for (let i = 0; i < context.text.length; i++) {
      const char = context.text[i] ?? "";
      const special = SPECIAL_CHARACTERS.get(char);
      if (!special) continue;
      const range = { start: i, end: i + 1 };
      const replacement = special.kind === "zero-width" ? "" : " ";
      const fixable = special.kind === "zero-width" || autoFixSpaces;
      const code = `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
      issues.push(
        createIssue({
          rule: meta,
          document: context.document,
          range,
          message: `תו מיוחד: ${special.name} (${code})`,
          explanation:
            special.kind === "zero-width"
              ? "תו בעל רוחב אפס אינו נראה לעין ועלול לפגוע בחיפוש ובהעתקה."
              : "תו רווח שאינו רווח רגיל. אם השימוש בו מכוון, אפשר להתעלם מהממצא.",
          suggestion: replacement,
          ...(fixable ? { fix: { range, replacement }, autoFixable: true } : {}),
          tags: [code],
        }),
      );
    }
    return issues;
  },
};
