import type { ProofreadingIssue } from "../proofreading";

export type ReviewStatus = "open" | "accepted" | "rejected" | "ignored";

export const REVIEW_STATUSES: readonly ReviewStatus[] = ["open", "accepted", "rejected", "ignored"];

/** Review state lives outside the immutable engine result. */
export interface ReviewedIssue {
  issue: ProofreadingIssue;
  status: ReviewStatus;
}

export type ReviewCounts = Record<ReviewStatus, number> & { total: number };

export function countByStatus(reviewed: readonly ReviewedIssue[]): ReviewCounts {
  const counts: ReviewCounts = { total: reviewed.length, open: 0, accepted: 0, rejected: 0, ignored: 0 };
  for (const { status } of reviewed) counts[status]++;
  return counts;
}
