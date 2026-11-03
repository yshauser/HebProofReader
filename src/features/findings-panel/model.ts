import type { IssueSeverity, RuleCategory } from "../../domain/proofreading";
import type { ReviewedIssue, ReviewStatus } from "../../domain/review";

export interface FindingFilters {
  category: RuleCategory | "all";
  severity: IssueSeverity | "all";
  ruleId: string | "all";
  status: ReviewStatus | "all";
}

export const DEFAULT_FILTERS: FindingFilters = { category: "all", severity: "all", ruleId: "all", status: "all" };

/** Pure view-model filter; preserves document order. */
export function filterReviewed(reviewed: readonly ReviewedIssue[], filters: FindingFilters): ReviewedIssue[] {
  return reviewed.filter(
    ({ issue, status }) =>
      (filters.category === "all" || issue.category === filters.category) &&
      (filters.severity === "all" || issue.severity === filters.severity) &&
      (filters.ruleId === "all" || issue.ruleId === filters.ruleId) &&
      (filters.status === "all" || status === filters.status),
  );
}
