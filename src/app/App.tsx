import type { RuleRegistry } from "../proofreading/registry/registry";
import { ExportButtons } from "../features/export-results/ExportButtons";
import { downloadTextFile } from "../features/export-results/download";
import { buildFindingsReport, serializeReport } from "../features/export-results/exporters";
import { FindingsPanel } from "../features/findings-panel/FindingsPanel";
import { useProofreadingSession } from "../features/proofreading-run/useProofreadingSession";
import { RuleSettings } from "../features/rule-settings/RuleSettings";
import { TextEditor } from "../features/text-editor/TextEditor";

export function App({ registry }: { registry?: RuleRegistry } = {}) {
  const session = useProofreadingSession(registry);
  const { text, result, selectedIssue, notice } = session;

  function exportReport() {
    if (!result) return;
    const review = Object.fromEntries(session.reviewed.map(({ issue, status }) => [issue.id, status]));
    downloadTextFile("findings-report.json", serializeReport(buildFindingsReport({ text, result, review })), "application/json");
  }

  return (
    <div className="app" dir="rtl" lang="he">
      <header className="app__header">
        <h1>מגיהה עברית</h1>
        <p className="app__tagline">בדיקה דטרמיניסטית מקומית. הטקסט אינו נשלח לשום שרת ואינו נשמר.</p>
        <div className="toolbar">
          <button type="button" className="primary" onClick={session.run} disabled={text.trim() === ""}>
            בדיקה
          </button>
          <ExportButtons
            hasText={text !== ""}
            hasReport={result !== null}
            onExportText={() => downloadTextFile("corrected-text.txt", text, "text/plain")}
            onExportReport={exportReport}
          />
        </div>
      </header>
      <div role="status" aria-live="polite" className="notice-region">
        {notice ? (
          <p className={`notice notice--${notice.kind}`} data-testid="notice">
            {notice.text}
          </p>
        ) : null}
      </div>
      <main className="app__main">
        <div className="app__editor">
          <TextEditor value={text} onChange={session.setText} highlight={selectedIssue ? selectedIssue.range : null} />
          <RuleSettings
            rules={session.rules}
            enabled={session.enabled}
            onToggleRule={session.toggleRule}
            onToggleCategory={session.setCategoryEnabled}
          />
        </div>
        <FindingsPanel
          rules={session.rules}
          text={text}
          hasRun={session.hasRun}
          textIsStale={session.textIsStale}
          rulesChanged={session.rulesChanged}
          reviewed={session.reviewed}
          filtered={session.filtered}
          counts={session.counts}
          overlappingIds={session.overlappingIds}
          filters={session.filters}
          selectedId={session.selectedId}
          onFiltersChange={session.setFilters}
          onSelect={session.select}
          onStep={session.step}
          onStatus={session.setStatus}
          onApplyFix={session.applyFix}
          onApplyAllSafe={session.applyAllSafeFixes}
        />
      </main>
    </div>
  );
}
