import type { TextRange } from "./types";

export function isValidRange(range: TextRange, textLength: number): boolean {
  const { start, end } = range;
  return Number.isInteger(start) && Number.isInteger(end) && 0 <= start && start <= end && end <= textLength;
}

/**
 * Half-open overlap. Adjacent ranges do not overlap. A zero-length range overlaps a
 * range only when strictly inside it; two zero-length ranges overlap when identical.
 */
export function rangesOverlap(a: TextRange, b: TextRange): boolean {
  if (a.start === a.end && b.start === b.end) return a.start === b.start;
  return a.start < b.end && b.start < a.end;
}

export function compareRanges(a: TextRange, b: TextRange): number {
  return a.start - b.start || a.end - b.end;
}
