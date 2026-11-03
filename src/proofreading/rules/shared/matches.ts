import type { TextRange } from "../../../domain/document";

export interface Match {
  range: TextRange;
  value: string;
}

/** All matches of a global regex as ranges. Throws if the regex is not global. */
export function findAll(text: string, pattern: RegExp): Match[] {
  if (!pattern.global) throw new Error("findAll requires a global regex");
  return [...text.matchAll(pattern)].map((m) => ({
    range: { start: m.index, end: m.index + m[0].length },
    value: m[0],
  }));
}

export function isLineStart(text: string, index: number): boolean {
  return index === 0 || text[index - 1] === "\n";
}

/** The maximal run of non-whitespace characters containing `index`. */
export function surroundingToken(text: string, index: number): string {
  let start = index;
  let end = index;
  while (start > 0 && /\S/u.test(text[start - 1] ?? " ")) start--;
  while (end < text.length && /\S/u.test(text[end] ?? " ")) end++;
  return text.slice(start, end);
}
