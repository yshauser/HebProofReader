// Hebrew points and cantillation (U+0591–U+05C7) excluding maqaf (05BE), paseq (05C0),
// sof pasuq (05C3) and nun hafukha (05C6), which are punctuation rather than marks.
const HEBREW_MARKS = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/gu;

/** Removes niqqud and cantillation marks. Used only for comparison, never to alter source text. */
export function stripHebrewMarks(value: string): string {
  return value.replace(HEBREW_MARKS, "");
}

/** Comparison key: marks stripped, Latin case-folded. */
export function normalizeWordForComparison(value: string): string {
  return stripHebrewMarks(value).toLowerCase();
}
