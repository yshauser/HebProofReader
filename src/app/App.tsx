import type { RuleRegistry } from "../proofreading/registry/registry";
import { DocumentPreview } from "../features/document-preview/DocumentPreview";
import { DocxInfo } from "../features/docx-import/DocxInfo";
import { DocxUpload } from "../features/docx-import/DocxUpload";
import { DOCX_MIME_TYPE, exportCommentedDocx } from "../features/export-results/docxExport";
import { ExportButtons } from "../features/export-results/ExportButtons";
import { downloadFile, downloadTextFile } from "../features/export-results/download";
import { buildFindingsReport, serializeReport } from "../features/export-results/exporters";
import { FindingsPanel } from "../features/findings-panel/FindingsPanel";
import { useProofreadingSession } from "../features/proofreading-run/useProofreadingSession";
import { RuleSettings } from "../features/rule-settings/RuleSettings";
import { TextEditor } from "../features/text-editor/TextEditor";

export function App({ registry }: { registry?: RuleRegistry } = {}) {
  const session = useProofreadingSession(registry);
  const { text, result, selectedIssue, notice, docx } = session;

  function exportReport() {
    if (!result) return;
    const review = Object.fromEntries(session.reviewed.map(({ issue, status }) => [issue.id, status]));
    downloadTextFile("findings-report.json", serializeReport(buildFindingsReport({ text, result, review, sourceType: docx ? "docx" : "plain-text" })), "application/json");
  }

  async function exportDocx() {
    if (!docx) return;
    const outcome = await exportCommentedDocx({ bytes: docx.bytes, fileName: docx.fileName, reviewed: session.reviewed });
    if (!outcome.ok) {
      session.notify({ kind: "error", text: outcome.message });
      return;
    }
    downloadFile(outcome.fileName, outcome.bytes, DOCX_MIME_TYPE);
    session.notify({
      kind: outcome.skipped > 0 ? "error" : "success",
      text:
        `נוצר קובץ חדש עם ${outcome.applied} הערות.` +
        (outcome.skipped > 0 ? ` ${outcome.skipped} ממצאים לא נוספו כי המיקום שלהם לא אומת.` : ""),
    });
  }

  return (
    <div className="app" dir="rtl" lang="he">
      <header className="app__header">
        <h1>מַגִּיהַּ עברית</h1>
        <p className="app__tagline">הבדיקה מקומית. הטקסט אינו נשלח לשום שרת ואינו נשמר.</p>
        <div className="toolbar">
          <button type="button" className="primary" onClick={session.run} disabled={text.trim() === ""}>
            בדיקה
          </button>
          <DocxUpload loading={session.docxLoading} onFile={(file) => void session.loadDocx(file)} />
          <ExportButtons
            hasText={text !== ""}
            hasReport={result !== null}
            onExportText={() => downloadTextFile("corrected-text.txt", text, "text/plain")}
            onExportReport={exportReport}
            {...(docx ? { onExportDocx: () => void exportDocx() } : {})}
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
          {docx ? (
            <>
              <DocxInfo docx={docx} onClear={session.clearDocx} />
              <DocumentPreview text={text} highlight={selectedIssue ? selectedIssue.range : null} />
            </>
          ) : (
            <TextEditor value={text} onChange={session.setText} highlight={selectedIssue ? selectedIssue.range : null} />
          )}
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
          allowFixes={!docx}
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
