import type { DocxErrorCode, DocxWarning } from "../../adapters/docx";

const ERROR_MESSAGES: Record<DocxErrorCode, string> = {
  "invalid-extension": "ניתן להעלות רק קובצי DOCX (סיומת .docx). קובצי DOC ישנים אינם נתמכים.",
  "invalid-mime": "סוג הקובץ אינו נתמך. ניתן להעלות רק קובצי DOCX.",
  "empty-file": "הקובץ ריק.",
  "file-too-large": "הקובץ גדול מדי להעלאה.",
  "not-a-zip": "הקובץ אינו מסמך DOCX תקין.",
  "legacy-or-encrypted": "הקובץ הוא בפורמט DOC ישן או מוגן בסיסמה. אין תמיכה בקבצים כאלה.",
  "corrupt-package": "לא ניתן לקרוא את הקובץ. ייתכן שהוא פגום.",
  "too-many-entries": "המסמך מכיל יותר מדי רכיבים ולכן נדחה מטעמי בטיחות.",
  "part-too-large": "תוכן המסמך גדול מדי ולכן נדחה מטעמי בטיחות.",
  "missing-main-part": "הקובץ אינו מסמך Word תקין: חסר תוכן ראשי.",
  "unsupported-package": "סוג המסמך אינו נתמך (למשל מסמך עם פקודות מאקרו או תבנית).",
  "invalid-xml": "תוכן המסמך אינו תקין ולא ניתן לקרוא אותו.",
  "unsafe-xml": "המסמך מכיל מבנה שאינו מותר מטעמי בטיחות.",
  "document-changed": "המסמך השתנה מאז הבדיקה ולכן לא ניתן להוסיף הערות.",
};

export const GENERIC_DOCX_ERROR = "לא ניתן לעבד את הקובץ.";

export const docxErrorMessage = (code: DocxErrorCode): string => ERROR_MESSAGES[code];

const UNSUPPORTED_LABELS: Record<string, string> = {
  fldSimple: "שדות פשוטים",
  txbxContent: "תיבות טקסט",
  altChunk: "תוכן מוטבע",
};

const UNREAD_LABELS: Record<string, string> = {
  headers: "כותרות עליונות",
  footers: "כותרות תחתונות",
  footnotes: "הערות שוליים",
  endnotes: "הערות סיום",
};

/** Hebrew sentences for the warnings the user must see before relying on the result. */
export function docxWarningMessages(warnings: readonly DocxWarning[]): string[] {
  return warnings.map((warning) => {
    switch (warning.code) {
      case "unsupported-content":
        return `התוכן הבא אינו נבדק ואינו מקבל הערות: ${warning.elements.map((e) => UNSUPPORTED_LABELS[e] ?? e).join(", ")}.`;
      case "tracked-changes":
        return "במסמך יש מעקב שינויים. הבדיקה מתייחסת לטקסט כאילו כל השינויים התקבלו; טקסט שנמחק אינו נבדק.";
      case "unread-parts":
        return `חלקי המסמך הבאים אינם נבדקים: ${warning.parts.map((p) => UNREAD_LABELS[p] ?? p).join(", ")}.`;
      case "existing-comments":
        return `במסמך יש ${warning.count} הערות קיימות. הן נשמרות ללא שינוי.`;
      case "no-text":
        return "לא נמצא טקסט לבדיקה במסמך.";
    }
  });
}
