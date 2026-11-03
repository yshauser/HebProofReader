import { isValidRange, rangesOverlap } from "../../domain/document";
import type { ProofreadingIssue, TextEdit } from "../../domain/proofreading";

function sortEdits(edits: readonly TextEdit[]): TextEdit[] {
  return [...edits].sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end);
}

/**
 * Applies non-overlapping edits from the highest start offset to the lowest so earlier
 * offsets stay valid. Throws on invalid or overlapping edits.
 */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  const sorted = sortEdits(edits);
  for (const [index, edit] of sorted.entries()) {
    if (!isValidRange(edit.range, text.length)) throw new RangeError("Invalid edit range");
    const previous = sorted[index - 1];
    if (previous && rangesOverlap(previous.range, edit.range)) throw new Error("Overlapping edits");
  }
  let result = text;
  for (const edit of sorted.reverse()) {
    result = result.slice(0, edit.range.start) + edit.replacement + result.slice(edit.range.end);
  }
  return result;
}

export function applyIssueFix(text: string, issue: ProofreadingIssue): string {
  if (!issue.autoFixable || !issue.fix) throw new Error("Issue is not auto-fixable");
  return applyEdits(text, [issue.fix]);
}

export interface FixSelection {
  selected: ProofreadingIssue[];
  skipped: ProofreadingIssue[];
}

/** Greedily picks auto-fixable issues (in the given order) whose edits do not conflict. */
export function selectNonConflictingFixes(issues: readonly ProofreadingIssue[]): FixSelection {
  const selected: ProofreadingIssue[] = [];
  const skipped: ProofreadingIssue[] = [];
  for (const issue of issues) {
    if (!issue.autoFixable || !issue.fix) continue;
    const { fix } = issue;
    const conflicts = selected.some((other) => other.fix && rangesOverlap(other.fix.range, fix.range));
    (conflicts ? skipped : selected).push(issue);
  }
  return { selected, skipped };
}

export function applySafeFixes(text: string, issues: readonly ProofreadingIssue[]) {
  const { selected, skipped } = selectNonConflictingFixes(issues);
  const edits = selected.flatMap((issue) => (issue.fix ? [issue.fix] : []));
  return {
    text: applyEdits(text, edits),
    appliedIds: selected.map((issue) => issue.id),
    skippedIds: skipped.map((issue) => issue.id),
  };
}
