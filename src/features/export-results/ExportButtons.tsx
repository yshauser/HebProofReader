interface ExportButtonsProps {
  hasText: boolean;
  hasReport: boolean;
  onExportText: () => void;
  onExportReport: () => void;
}

export function ExportButtons({ hasText, hasReport, onExportText, onExportReport }: ExportButtonsProps) {
  return (
    <div className="toolbar" role="group" aria-label="ייצוא">
      <button type="button" onClick={onExportText} disabled={!hasText}>
        ייצוא טקסט מתוקן
      </button>
      <button type="button" onClick={onExportReport} disabled={!hasReport}>
        ייצוא דוח JSON
      </button>
    </div>
  );
}
