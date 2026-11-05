interface ExportButtonsProps {
  hasText: boolean;
  hasReport: boolean;
  onExportText: () => void;
  onExportReport: () => void;
  /** When provided (DOCX source), the commented-DOCX export replaces the corrected-text export. */
  onExportDocx?: () => void;
}

export function ExportButtons({ hasText, hasReport, onExportText, onExportReport, onExportDocx }: ExportButtonsProps) {
  return (
    <div className="toolbar" role="group" aria-label="ייצוא">
      {onExportDocx ? (
        <button type="button" onClick={onExportDocx} disabled={!hasReport}>
          ייצוא DOCX עם הערות
        </button>
      ) : (
        <button type="button" onClick={onExportText} disabled={!hasText}>
          ייצוא טקסט מתוקן
        </button>
      )}
      <button type="button" onClick={onExportReport} disabled={!hasReport}>
        ייצוא דוח JSON
      </button>
    </div>
  );
}
