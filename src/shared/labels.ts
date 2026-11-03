import type { IssueSeverity, RuleCategory } from "../domain/proofreading";
import type { ReviewStatus } from "../domain/review";

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  spacing: "רווחים",
  punctuation: "פיסוק",
  typography: "טיפוגרפיה",
  spelling: "איות",
  grammar: "דקדוק",
  style: "סגנון",
  consistency: "עקביות",
};

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  info: "מידע",
  warning: "אזהרה",
  error: "שגיאה",
};

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  open: "פתוח",
  accepted: "התקבל",
  rejected: "נדחה",
  ignored: "הושמט",
};
