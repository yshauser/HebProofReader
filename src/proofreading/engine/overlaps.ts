import { rangesOverlap } from "../../domain/document";
import type { IssueOverlap, ProofreadingIssue } from "../../domain/proofreading";

/** Expects issues already sorted by (start, end). Returns overlapping pairs in sorted order. */
export function findOverlaps(sorted: readonly ProofreadingIssue[]): IssueOverlap[] {
  const overlaps: IssueOverlap[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (!a) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (!b) continue;
      if (b.range.start > a.range.end || (b.range.start === a.range.end && a.range.start !== a.range.end)) break;
      if (rangesOverlap(a.range, b.range)) overlaps.push({ firstId: a.id, secondId: b.id });
    }
  }
  return overlaps;
}
