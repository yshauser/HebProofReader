import type { ProofreadingRule } from "../../domain/proofreading";
import type { ReviewCounts, ReviewedIssue, ReviewStatus } from "../../domain/review";
import { FindingCard } from "./FindingCard";
import { FindingsFilters } from "./FindingsFilters";
import type { FindingFilters } from "./model";

interface FindingsPanelProps {
  rules: readonly ProofreadingRule[];
  text: string;
  hasRun: boolean;
  textIsStale: boolean;
  rulesChanged: boolean;
  reviewed: readonly ReviewedIssue[];
  filtered: readonly ReviewedIssue[];
  counts: ReviewCounts;
  overlappingIds: ReadonlySet<string>;
  filters: FindingFilters;
  selectedId: string | null;
  onFiltersChange: (filters: FindingFilters) => void;
  onSelect: (id: string) => void;
  onStep: (delta: 1 | -1) => void;
  onStatus: (id: string, status: ReviewStatus) => void;
  onApplyFix: (id: string) => void;
  onApplyAllSafe: () => void;
}

const COUNT_ITEMS: Array<[keyof ReviewCounts, string]> = [
  ["total", "סה״כ"],
  ["open", "פתוחים"],
  ["accepted", "התקבלו"],
  ["rejected", "נדחו"],
  ["ignored", "הושמטו"],
];

function emptyMessage(props: FindingsPanelProps): string | null {
  if (!props.hasRun) return "עדיין לא הורצה בדיקה. לחצו על ״בדיקה״ כדי לחפש ממצאים.";
  if (props.textIsStale) return "הטקסט השתנה מאז הבדיקה האחרונה. הריצו בדיקה מחדש.";
  if (props.reviewed.length === 0) return "לא נמצאו ממצאים.";
  if (props.filtered.length === 0) return "אין ממצאים התואמים למסננים.";
  return null;
}

export function FindingsPanel(props: FindingsPanelProps) {
  const { filtered, counts, selectedId } = props;
  const empty = emptyMessage(props);
  const hasFixable = props.reviewed.some(({ issue, status }) => issue.autoFixable && (status === "open" || status === "accepted"));
  return (
    <section className="panel findings" aria-labelledby="findings-title">
      <h2 id="findings-title">ממצאים</h2>
      <ul className="counts" aria-label="סיכום ממצאים">
        {COUNT_ITEMS.map(([key, label]) => (
          <li key={key}>
            {label}: <strong data-testid={`count-${key}`}>{counts[key]}</strong>
          </li>
        ))}
      </ul>
      {props.rulesChanged ? <p className="hint">הגדרות החוקים השתנו מאז הבדיקה האחרונה. הריצו בדיקה מחדש.</p> : null}
      <FindingsFilters rules={props.rules} filters={props.filters} onChange={props.onFiltersChange} />
      <div className="toolbar" role="group" aria-label="ניווט ופעולות">
        <button type="button" onClick={() => props.onStep(-1)} disabled={filtered.length === 0}>
          הקודם
        </button>
        <button type="button" onClick={() => props.onStep(1)} disabled={filtered.length === 0}>
          הבא
        </button>
        <button type="button" onClick={props.onApplyAllSafe} disabled={!hasFixable}>
          החלת כל התיקונים הבטוחים
        </button>
      </div>
      {empty ? (
        <p className="empty" data-testid="findings-empty">
          {empty}
        </p>
      ) : (
        <ol className="finding-list" aria-label="רשימת ממצאים">
          {filtered.map((item) => (
            <FindingCard
              key={item.issue.id}
              item={item}
              text={props.text}
              selected={item.issue.id === selectedId}
              overlapping={props.overlappingIds.has(item.issue.id)}
              onSelect={props.onSelect}
              onStatus={props.onStatus}
              onApplyFix={props.onApplyFix}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
