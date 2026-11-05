import JSZip from "jszip";
import { W } from "./ooxml";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A run with optional run properties (e.g. "<w:b/>"). */
export const r = (text: string, rPr = "") =>
  `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
export const p = (...content: string[]) => `<w:p>${content.join("")}</w:p>`;

export interface BuildOptions {
  commentsXml?: string;
  withDocumentRels?: boolean;
}

export async function buildDocx(bodyXml: string, options: BuildOptions = {}): Promise<Uint8Array> {
  const zip = new JSZip();
  const commentsOverride = options.commentsXml
    ? `<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>`
    : "";
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${commentsOverride}</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  if (options.withDocumentRels !== false) {
    const rel = options.commentsXml
      ? `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>`
      : "";
    zip.file(
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`,
    );
  }
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${bodyXml}</w:body></w:document>`);
  if (options.commentsXml) zip.file("word/comments.xml", options.commentsXml);
  return zip.generateAsync({ type: "uint8array" });
}

const BOLD = "<w:b/>";
const ITALIC = "<w:i/>";
const RTL = "<w:rtl/>";

export const fixtureBodies: Record<string, string> = {
  "simple-paragraphs": p(r("שלום ,יוסף")) + p(r("טוב  מאוד")),
  "split-runs": p(r("טוב ", BOLD), r(" מאוד", ITALIC), r(" וגם ,"), r("עוד", BOLD)),
  "repeated-words": p(r("הוא הוא הלך")) + p(r("הוא הוא חזר")),
  tables: `<w:tbl><w:tr><w:tc>${p(r("תא ,ראשון"))}</w:tc><w:tc>${p(r("תא  שני"))}</w:tc></w:tr></w:tbl>` + p(r("אחרי הטבלה ?")),
  "rtl-mixed": `<w:p><w:pPr><w:bidi/></w:pPr>${r("Hello  ", "")}${r("עולם ,", RTL)}${r(" test!!", "")}</w:p>`,
  "tabs-and-breaks": p(`<w:r><w:t>א</w:t><w:tab/><w:t xml:space="preserve">ב  ג</w:t><w:br/><w:t>ד</w:t></w:r>`),
  hyperlink: p(r("ראו "), `<w:hyperlink w:anchor="x">${r("קישור  כאן", BOLD)}</w:hyperlink>`, r(" ,סוף")),
  "empty-paragraph": p(r("שורה ראשונה")) + p() + p(r("שורה  שלישית")),
  unsupported: p(r("רגיל")) + `<w:p><w:ins w:id="9" w:author="x">${r("מעקב שינויים")}</w:ins></w:p>`,
};

export const existingCommentsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${W}"><w:comment w:id="0" w:author="מישהו" w:date="2020-01-01T00:00:00Z" w:initials="מ"><w:p><w:r><w:t>הערה קיימת</w:t></w:r></w:p></w:comment></w:comments>`;

export const existingCommentsBody =
  p(r("לפני "), `<w:commentRangeStart w:id="0"/>`, r("טקסט עם הערה"), `<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>`, r("  אחרי"));
