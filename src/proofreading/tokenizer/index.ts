import type { TextRange } from "../../domain/document";

export interface Token {
  kind: "word" | "number" | "punctuation" | "whitespace" | "other";
  value: string;
  range: TextRange;
}

// word: letters/marks, optionally joined by geresh, gershayim or apostrophes (e.g. צה״ל, don't).
// number: digits with optional . or , separators between digit groups.
const TOKEN_PATTERN =
  /(?<word>[\p{L}\p{M}]+(?:[\u05F3\u05F4'’][\p{L}\p{M}]+)*)|(?<number>\p{Nd}+(?:[.,]\p{Nd}+)*)|(?<whitespace>\s+)|(?<punctuation>[\p{P}\p{S}])|(?<other>[\s\S])/gu;

/** Splits text into contiguous tokens whose ranges cover the whole input without gaps. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const { groups } = match;
    const kind: Token["kind"] = groups?.word
      ? "word"
      : groups?.number
        ? "number"
        : groups?.whitespace
          ? "whitespace"
          : groups?.punctuation
            ? "punctuation"
            : "other";
    tokens.push({ kind, value: match[0], range: { start: match.index, end: match.index + match[0].length } });
  }
  return tokens;
}

export function isHorizontalWhitespace(value: string): boolean {
  return /^[^\S\n\r\u2028\u2029]+$/u.test(value);
}
