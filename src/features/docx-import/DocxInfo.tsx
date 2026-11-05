import type { LoadedDocx } from "./loadDocx";
import { docxWarningMessages } from "./messages";

interface DocxInfoProps {
  docx: LoadedDocx;
  onClear: () => void;
}

/** Summary of the loaded DOCX with the limitations the user must know about. */
export function DocxInfo({ docx, onClear }: DocxInfoProps) {
  const warnings = docxWarningMessages(docx.warnings);
  return (
    <section className="panel docx-info" aria-label="פרטי הקובץ">
      <p className="docx-info__title">
        <strong dir="auto" data-testid="docx-file-name">
          {docx.fileName}
        </strong>{" "}
        · {docx.paragraphCount} פסקאות
      </p>
      <p className="hint">הקובץ המקורי אינו משתנה. הבדיקה מוסיפה הערות בקובץ חדש בלבד; תיקונים אוטומטיים אינם מוחלים על קובצי DOCX.</p>
      {warnings.length > 0 ? (
        <ul className="docx-warnings" aria-label="אזהרות">
          {warnings.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={onClear}>
        הסרת הקובץ וחזרה לעריכת טקסט
      </button>
    </section>
  );
}
