import JSZip from "jszip";

/**
 * Builders for synthetic, non-sensitive, Word-like .docx packages (namespaces, mc:Ignorable,
 * styles, settings, docProps, rsids, proofErr/bookmark noise). Output is deterministic in content;
 * `npm run fixtures:docx` writes the committed copies in tests/fixtures/docx.
 */

export const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const FIXED_DATE = new Date("2020-01-01T00:00:00Z");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const BOLD = "<w:b/><w:bCs/>";
export const ITALIC = "<w:i/><w:iCs/>";
export const RTL = "<w:rtl/>";
const HEBREW_LANG = `<w:lang w:val="en-US" w:bidi="he-IL"/>`;

/** A run. `rPr` is raw run-property XML. */
export const run = (text: string, rPr = "", rsid = "00A1B2C3") =>
  `<w:r w:rsidR="${rsid}"><w:rPr>${rPr}${HEBREW_LANG}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

export const paragraph = (content: string, pPr = "") =>
  `<w:p w:rsidR="00A1B2C3" w:rsidRDefault="00A1B2C3">${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${content}</w:p>`;

export const rtlParagraph = (content: string) => paragraph(content, "<w:bidi/>");

export const table = (rows: string[][]) =>
  `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:bidiVisual/></w:tblPr><w:tblGrid>${rows[0]?.map(() => `<w:gridCol w:w="3000"/>`).join("") ?? ""}</w:tblGrid>${rows
    .map((cells) => `<w:tr>${cells.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>${cell}</w:tc>`).join("")}</w:tr>`)
    .join("")}</w:tbl>`;

export interface BuildOptions {
  body: string;
  commentsXml?: string;
  /** Name of the comments part (default word/comments.xml). */
  commentsPart?: string;
  /** Additional parts: name -> XML, registered with the given content type. */
  extraParts?: Array<{ name: string; xml: string; contentType: string; relType?: string }>;
  mainContentType?: string;
}

const MAIN_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
const CT = "application/vnd.openxmlformats-officedocument.wordprocessingml";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export async function buildWordDocx(options: BuildOptions): Promise<Uint8Array> {
  const zip = new JSZip();
  const add = (name: string, content: string) => zip.file(name, content, { date: FIXED_DATE });
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  const commentsPart = options.commentsPart ?? "word/comments.xml";
  const extra = options.extraParts ?? [];

  const overrides = [
    `<Override PartName="/word/document.xml" ContentType="${options.mainContentType ?? MAIN_CT}"/>`,
    `<Override PartName="/word/styles.xml" ContentType="${CT}.styles+xml"/>`,
    `<Override PartName="/word/settings.xml" ContentType="${CT}.settings+xml"/>`,
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`,
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`,
    ...(options.commentsXml ? [`<Override PartName="/${commentsPart}" ContentType="${CT}.comments+xml"/>`] : []),
    ...extra.map((part) => `<Override PartName="/${part.name}" ContentType="${part.contentType}"/>`),
  ];
  add(
    "[Content_Types].xml",
    `${header}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.join("")}</Types>`,
  );
  add(
    "_rels/.rels",
    `${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  const docRels = [
    `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>`,
    `<Relationship Id="rId2" Type="${REL}/settings" Target="settings.xml"/>`,
    ...(options.commentsXml ? [`<Relationship Id="rId3" Type="${REL}/comments" Target="${commentsPart.replace(/^word\//, "")}"/>`] : []),
    ...extra.flatMap((part, i) => (part.relType ? [`<Relationship Id="rId${10 + i}" Type="${part.relType}" Target="${part.name.replace(/^word\//, "")}"/>`] : [])),
  ];
  add("word/_rels/document.xml.rels", `${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${docRels.join("")}</Relationships>`);
  add(
    "word/document.xml",
    `${header}<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"><w:body>${options.body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`,
  );
  add(
    "word/styles.xml",
    `${header}<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:cs="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:bidi="he-IL"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`,
  );
  add("word/settings.xml", `${header}<w:settings xmlns:w="${W_NS}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/></w:settings>`);
  add(
    "docProps/core.xml",
    `${header}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Synthetic fixture</dc:title><dc:creator>Fixture Generator</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2020-01-01T00:00:00Z</dcterms:created></cp:coreProperties>`,
  );
  add("docProps/app.xml", `${header}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Fixture Generator</Application></Properties>`);
  if (options.commentsXml) add(commentsPart, options.commentsXml);
  for (const part of extra) add(part.name, part.xml);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export const commentsXml = (comments: Array<{ id: number; author: string; text: string }>) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments xmlns:w="${W_NS}">${comments
    .map(
      (c) =>
        `<w:comment w:id="${c.id}" w:author="${esc(c.author)}" w:date="2020-01-01T00:00:00Z" w:initials="${esc(c.author.slice(0, 1))}"><w:p><w:r><w:annotationRef/></w:r><w:r><w:t>${esc(c.text)}</w:t></w:r></w:p></w:comment>`,
    )
    .join("")}</w:comments>`;

const proofErr = `<w:proofErr w:type="spellStart"/>`;
const bookmark = (id: number) => `<w:bookmarkStart w:id="${id}" w:name="_Bm${id}"/><w:bookmarkEnd w:id="${id}"/>`;

export const FIXTURE_NAMES = [
  "simple-paragraphs",
  "split-runs",
  "tables",
  "rtl-mixed-content",
  "existing-comments",
  "tracked-changes",
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

const header1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr xmlns:w="${W_NS}"><w:p><w:r><w:t>כותרת עליונה  לדוגמה</w:t></w:r></w:p></w:hdr>`;
const footnotes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:footnotes xmlns:w="${W_NS}"><w:footnote w:id="1"><w:p><w:r><w:t>הערת שוליים</w:t></w:r></w:p></w:footnote></w:footnotes>`;

export const fixtureBuilders: Record<FixtureName, () => Promise<Uint8Array>> = {
  "simple-paragraphs": () =>
    buildWordDocx({
      body: rtlParagraph(run("שלום ,יוסף")) + rtlParagraph(run("זהו  טקסט פשוט.")) + rtlParagraph(run("הוא הוא הגיע")),
    }),

  "split-runs": () =>
    buildWordDocx({
      body:
        rtlParagraph(
          run("טוב ", BOLD) + proofErr + run(" מאוד", ITALIC, "00B2C3D4") + bookmark(1) + run(" וגם ,", "", "00C3D4E5") + run("עוד", BOLD) + run(" מילה", `${BOLD}${ITALIC}`),
        ) + rtlParagraph(run("(סוגר ", BOLD) + run("שלא נסגר", ITALIC)),
    }),

  tables: () =>
    buildWordDocx({
      body:
        rtlParagraph(run("לפני הטבלה")) +
        table([
          [rtlParagraph(run("תא ,ראשון")), rtlParagraph(run("תא  שני"))],
          [rtlParagraph(run("הוא הוא")), rtlParagraph(run("סוף השורה ?"))],
        ]) +
        rtlParagraph(run("אחרי הטבלה")),
    }),

  "rtl-mixed-content": () =>
    buildWordDocx({
      body:
        rtlParagraph(run("השתמשו ב-") + run("Word", "<w:rFonts w:ascii=\"Calibri\" w:hAnsi=\"Calibri\"/>") + run("  כדי לפתוח (קובץ ,DOCX", RTL)) +
        rtlParagraph(run("שָׁלוֹם ,עולם: 3,5 ו-1,000 ש״ח.", RTL)) +
        paragraph(run("English line  with double space, then עברית", "")),
    }),

  "existing-comments": () =>
    buildWordDocx({
      body: rtlParagraph(
        run("לפני ") +
          `<w:commentRangeStart w:id="0"/>` +
          run("טקסט עם הערה") +
          `<w:commentRangeEnd w:id="0"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="0"/></w:r>` +
          run("  אחרי ,"),
      ),
      commentsXml: commentsXml([{ id: 0, author: "מישהו", text: "הערה קיימת" }]),
    }),

  "tracked-changes": () =>
    buildWordDocx({
      body:
        rtlParagraph(
          run("לפני  השינוי ") +
            `<w:ins w:id="10" w:author="מישהו" w:date="2020-01-01T00:00:00Z">${run("טקסט שהוכנס")}</w:ins>` +
            `<w:del w:id="11" w:author="מישהו" w:date="2020-01-01T00:00:00Z"><w:r><w:delText>טקסט שנמחק</w:delText></w:r></w:del>` +
            run(" ואחרי ,") +
            `<w:fldSimple w:instr=" PAGE ">${run("7")}</w:fldSimple>`,
        ) + rtlParagraph(run("פסקה רגילה")),
      extraParts: [
        { name: "word/header1.xml", xml: header1, contentType: `${CT}.header+xml`, relType: `${REL}/header` },
        { name: "word/footnotes.xml", xml: footnotes, contentType: `${CT}.footnotes+xml`, relType: `${REL}/footnotes` },
      ],
    }),
};
