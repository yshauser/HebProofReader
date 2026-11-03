import type { DocumentModel } from "../../domain/document";
import type {
  IssueSeverity,
  ProofreadingIssue,
  ProofreadingResult,
  ProofreadingRule,
  RuleExecutionError,
} from "../../domain/proofreading";
import { findOverlaps } from "./overlaps";
import { findIssueViolation } from "./validate";

export interface RunProofreadingInput {
  document: DocumentModel;
  rules: readonly ProofreadingRule[];
  /** Rules to execute. Defaults to every rule with `enabledByDefault`. */
  enabledRuleIds?: ReadonlySet<string>;
  /** Per-rule options keyed by rule ID. */
  ruleOptions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  signal?: AbortSignal;
}

const SEVERITY_RANK: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

export function compareIssues(a: ProofreadingIssue, b: ProofreadingIssue): number {
  return (
    a.range.start - b.range.start ||
    a.range.end - b.range.end ||
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Runs rules in isolation, then validates, deduplicates, sorts and detects overlaps. Deterministic. */
export function runProofreading(input: RunProofreadingInput): ProofreadingResult {
  const { document, rules, ruleOptions = {}, signal } = input;
  const text = document.text;
  const errors: RuleExecutionError[] = [];
  const executedRuleIds: string[] = [];
  const byId = new Map<string, ProofreadingIssue>();

  for (const rule of rules) {
    const enabled = input.enabledRuleIds ? input.enabledRuleIds.has(rule.id) : rule.enabledByDefault;
    if (!enabled) continue;
    executedRuleIds.push(rule.id);

    let emitted: readonly ProofreadingIssue[];
    try {
      emitted = rule.check({ document, text, options: ruleOptions[rule.id] ?? {}, signal });
    } catch (error) {
      errors.push({ ruleId: rule.id, kind: "exception", message: error instanceof Error ? error.name : "UnknownError" });
      continue;
    }

    for (const issue of emitted) {
      const violation = findIssueViolation(issue, rule, text);
      if (violation) {
        errors.push({ ruleId: rule.id, kind: "invalid-issue", message: violation });
        continue;
      }
      if (!byId.has(issue.id)) byId.set(issue.id, issue);
    }
  }

  const issues = [...byId.values()].sort(compareIssues);
  return { documentId: document.id, issues, overlaps: findOverlaps(issues), errors, executedRuleIds };
}
