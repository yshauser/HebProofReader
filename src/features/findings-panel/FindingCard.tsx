import type { ReviewedIssue, ReviewStatus } from "../../domain/review";
import { REVIEW_STATUSES } from "../../domain/review";
import { CATEGORY_LABELS, SEVERITY_LABELS, STATUS_LABELS } from "../../shared/labels";
import { offsetToLineColumn, visibleText } from "../../shared/utilities/text";

interface FindingCardProps {
  item: ReviewedIssue;
  text: string;
  selected: boolean;
  overlapping: boolean;
  /** False for sources whose text is never modified (DOCX): the fix button is hidden. */
  allowFix: boolean;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: ReviewStatus) => void;
  onApplyFix: (id: string) => void;
}

const ACTION_STATUSES = REVIEW_STATUSES.filter((status) => status !== "open");
const ACTION_LABELS: Record<ReviewStatus, string> = {
  open: "פתוח",
  accepted: "קבלה",
  rejected: "דחייה",
  ignored: "השמטה",
};

export function FindingCard({ item, text, selected, overlapping, allowFix, onSelect, onStatus, onApplyFix }: FindingCardProps) {
  const { issue, status } = item;
  const { line, column } = offsetToLineColumn(text, issue.range.start);
  const location = issue.sourceLocation.kind === "docx" ? `פסקה ${issue.sourceLocation.start.paragraphIndex + 1}` : `שורה ${line}, עמודה ${column}`;
  const isInsertion = issue.range.start === issue.range.end;
  const suggestion = issue.suggestion === undefined ? undefined : issue.suggestion === "" ? "(הסרה)" : visibleText(issue.suggestion);

  return (
    <li
      className={`finding finding--${status}${selected ? " finding--selected" : ""}`}
      data-testid="finding"
      data-rule-id={issue.ruleId}
      data-status={status}
    >
      <button
        type="button"
        className="finding__main"
        aria-pressed={selected}
        onClick={() => onSelect(issue.id)}
        aria-label={`${issue.ruleId}: ${issue.message}`}
      >
        <span className="finding__meta">
          <span className="rule-id" dir="ltr">
            {issue.ruleId}
          </span>
          <span className="badge">{CATEGORY_LABELS[issue.category]}</span>
          <span className={`badge badge--${issue.severity}`}>{SEVERITY_LABELS[issue.severity]}</span>
          <span className="badge badge--status">{STATUS_LABELS[status]}</span>
          {overlapping ? <span className="badge badge--warn">חופף לממצא אחר</span> : null}
        </span>
        <strong className="finding__message">{issue.message}</strong>
        {issue.explanation ? <span className="finding__explanation">{issue.explanation}</span> : null}
        <span className="finding__context" dir="auto">
          {visibleText(issue.contextBefore)}
          <mark>{isInsertion ? "⎀" : visibleText(issue.originalText)}</mark>
          {visibleText(issue.contextAfter)}
        </span>
        <span className="finding__details">
          {isInsertion ? "הוספה" : "מקור"}
          {suggestion !== undefined ? <> · הצעה: <bdi>{suggestion}</bdi></> : null}
          {" · "}
          {issue.autoFixable ? (allowFix ? "תיקון אוטומטי בטוח" : "תיקון בטוח (אינו מוחל על DOCX)") : "ללא תיקון אוטומטי"}
          {" · "}
          {location}
        </span>
      </button>
      <div className="finding__actions" role="group" aria-label={`פעולות עבור ${issue.ruleId}`}>
        {ACTION_STATUSES.map((target) => (
          <button
            key={target}
            type="button"
            aria-pressed={status === target}
            onClick={() => onStatus(issue.id, status === target ? "open" : target)}
          >
            {ACTION_LABELS[target]}
          </button>
        ))}
        {issue.autoFixable && allowFix ? (
          <button type="button" className="primary" onClick={() => onApplyFix(issue.id)}>
            החלת תיקון
          </button>
        ) : null}
      </div>
    </li>
  );
}
