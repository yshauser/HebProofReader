import { describe, expect, it } from "vitest";
import { createPlainTextDocument } from "../../adapters/plain-text";
import type { ReviewedIssue } from "../../domain/review";
import { countByStatus } from "../../domain/review";
import { runProofreading } from "../../proofreading/engine";
import { initialRules } from "../../proofreading/rules";
import { DEFAULT_FILTERS, filterReviewed } from "./model";

const text = "שלום ,יוסף  טוב?? (";
const issues = runProofreading({ document: createPlainTextDocument(text), rules: initialRules }).issues;
const reviewed: ReviewedIssue[] = issues.map((issue, index) => ({ issue, status: index === 0 ? "accepted" : "open" }));

describe("filterReviewed", () => {
  it("returns everything by default, in document order", () => {
    const all = filterReviewed(reviewed, DEFAULT_FILTERS);
    expect(all).toEqual(reviewed);
    const starts = all.map(({ issue }) => issue.range.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("filters by category, severity, rule and status", () => {
    expect(filterReviewed(reviewed, { ...DEFAULT_FILTERS, category: "punctuation" }).every(({ issue }) => issue.category === "punctuation")).toBe(true);
    expect(filterReviewed(reviewed, { ...DEFAULT_FILTERS, severity: "error" }).map(({ issue }) => issue.ruleId)).toEqual(["HEB-PUNC-003"]);
    expect(filterReviewed(reviewed, { ...DEFAULT_FILTERS, ruleId: "HEB-SPACE-001" })).toHaveLength(1);
    expect(filterReviewed(reviewed, { ...DEFAULT_FILTERS, status: "accepted" })).toHaveLength(1);
  });

  it("combines filters with AND", () => {
    expect(filterReviewed(reviewed, { ...DEFAULT_FILTERS, category: "spacing", severity: "error" })).toEqual([]);
  });
});

describe("countByStatus", () => {
  it("counts each status", () => {
    const counts = countByStatus(reviewed);
    expect(counts.total).toBe(reviewed.length);
    expect(counts.accepted).toBe(1);
    expect(counts.open).toBe(reviewed.length - 1);
    expect(counts.rejected + counts.ignored).toBe(0);
  });
});
