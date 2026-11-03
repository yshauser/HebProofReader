import type { IssueSeverity, ProofreadingRule, RuleCategory } from "../../domain/proofreading";
import { REVIEW_STATUSES } from "../../domain/review";
import type { ReviewStatus } from "../../domain/review";
import { CATEGORY_LABELS, SEVERITY_LABELS, STATUS_LABELS } from "../../shared/labels";
import type { FindingFilters } from "./model";

interface FindingsFiltersProps {
  rules: readonly ProofreadingRule[];
  filters: FindingFilters;
  onChange: (filters: FindingFilters) => void;
}

export function FindingsFilters({ rules, filters, onChange }: FindingsFiltersProps) {
  const categories = [...new Set(rules.map((rule) => rule.category))];
  return (
    <div className="filters" role="group" aria-label="מסננים">
      <label>
        קטגוריה
        <select value={filters.category} onChange={(e) => onChange({ ...filters, category: e.target.value as RuleCategory | "all" })}>
          <option value="all">הכול</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </label>
      <label>
        חומרה
        <select value={filters.severity} onChange={(e) => onChange({ ...filters, severity: e.target.value as IssueSeverity | "all" })}>
          <option value="all">הכול</option>
          {(Object.keys(SEVERITY_LABELS) as IssueSeverity[]).map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_LABELS[severity]}
            </option>
          ))}
        </select>
      </label>
      <label>
        חוק
        <select value={filters.ruleId} onChange={(e) => onChange({ ...filters, ruleId: e.target.value })}>
          <option value="all">הכול</option>
          {rules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        מצב סקירה
        <select value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value as ReviewStatus | "all" })}>
          <option value="all">הכול</option>
          {REVIEW_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
