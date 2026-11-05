/**
 * PHASE 5 SPIKE (disposable). Not part of the application or the engine.
 * Question answered here: can DOCX paragraphs/runs be indexed with stable anchors and can
 * comments be inserted at engine-style [start, end) UTF-16 ranges?
 */
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { DocxAnchor, DocxLocation, TextRange } from "../../src/domain/document";

export const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export const isW = (node: Node | null, name: string): boolean =>
  node !== null && node.nodeType === 1 && (node as Element).namespaceURI === W && (node as Element).localName === name;

export const elementChildren = (el: Element): Element[] =>
  Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);

export const parseXml = (xml: string): Document => new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;
export const serializeXml = (doc: Document): string => new XMLSerializer().serializeToString(doc as never);

export interface RunInfo {
  element: Element;
  paragraphIndex: number;
  runIndex: number;
  text: string;
  /** Offsets in the extracted document text. */
  start: number;
  end: number;
}

export interface ParagraphInfo {
  element: Element;
  index: number;
  runs: RunInfo[];
  start: number;
  end: number;
}

export interface DocxIndex {
  paragraphs: ParagraphInfo[];
  /** Paragraph texts joined with "\n". This is what the engine receives. */
  text: string;
}

/** Content units of a run (everything except w:rPr) with the text each contributes. */
export function runUnits(run: Element): Array<{ node: Element; text: string }> {
  return elementChildren(run)
    .filter((c) => !isW(c, "rPr"))
    .map((node) => {
      if (isW(node, "t")) return { node, text: node.textContent ?? "" };
      if (isW(node, "tab")) return { node, text: "\t" };
      if (isW(node, "noBreakHyphen")) return { node, text: "\u2011" };
      if (isW(node, "cr")) return { node, text: "\n" };
      if (isW(node, "br")) {
        const type = node.getAttributeNS(W, "type");
        return { node, text: type === null || type === "" || type === "textWrapping" ? "\n" : "" };
      }
      return { node, text: "" };
    });
}

const runText = (run: Element) => runUnits(run).map((u) => u.text).join("");

function collectParagraphElements(node: Element, out: Element[]): void {
  for (const child of elementChildren(node)) {
    if (isW(child, "p")) out.push(child);
    else collectParagraphElements(child, out);
  }
}

/** Runs that are direct children of the paragraph or of a w:hyperlink inside it. */
function paragraphRunElements(p: Element): Element[] {
  return elementChildren(p).flatMap((c) => (isW(c, "r") ? [c] : isW(c, "hyperlink") ? elementChildren(c).filter((x) => isW(x, "r")) : []));
}

export function indexDocument(doc: Document): DocxIndex {
  const body = elementChildren(doc.documentElement).find((c) => isW(c, "body"));
  if (!body) throw new Error("word/document.xml has no w:body");
  const paragraphElements: Element[] = [];
  collectParagraphElements(body, paragraphElements);

  const paragraphs: ParagraphInfo[] = [];
  let cursor = 0;
  paragraphElements.forEach((element, index) => {
    const paragraph: ParagraphInfo = { element, index, runs: [], start: cursor, end: cursor };
    paragraphRunElements(element).forEach((runElement, runIndex) => {
      const text = runText(runElement);
      paragraph.runs.push({ element: runElement, paragraphIndex: index, runIndex, text, start: cursor, end: cursor + text.length });
      cursor += text.length;
    });
    paragraph.end = cursor;
    paragraphs.push(paragraph);
    cursor += 1; // the "\n" separator between paragraphs
  });
  return { paragraphs, text: paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n") };
}

/** Elements the spike does NOT index; text inside them is invisible to the engine. */
export function findUnsupportedContent(doc: Document): string[] {
  const unsupported = ["ins", "del", "moveFrom", "moveTo", "sdt", "fldSimple", "smartTag", "txbxContent", "altChunk"];
  return unsupported.filter((name) => doc.getElementsByTagNameNS(W, name).length > 0);
}

interface Located {
  paragraph: ParagraphInfo;
  run: RunInfo | undefined;
  offsetInRun: number;
}

/**
 * Maps a text offset to a paragraph/run position.
 * "start" bias prefers the run that begins at the offset; "end" bias prefers the run that ends there.
 */
export function locate(index: DocxIndex, offset: number, bias: "start" | "end"): Located {
  const { paragraphs } = index;
  if (paragraphs.length === 0) throw new Error("Document has no paragraphs");
  const last = <T>(items: T[], pred: (item: T) => boolean) => items.filter(pred).at(-1);
  const paragraph =
    (bias === "start"
      ? paragraphs.find((p) => p.start <= offset && offset < p.end) ?? last(paragraphs, (p) => p.start <= offset)
      : paragraphs.find((p) => p.start < offset && offset <= p.end) ?? last(paragraphs, (p) => p.start <= offset)) ??
    paragraphs[0];
  if (!paragraph) throw new Error("unreachable");
  const inside = paragraph.runs.find((r) => (bias === "start" ? r.start <= offset && offset < r.end : r.start < offset && offset <= r.end));
  if (inside) return { paragraph, run: inside, offsetInRun: offset - inside.start };
  const edge = bias === "start" ? paragraph.runs.at(-1) : paragraph.runs.at(0);
  if (!edge) return { paragraph, run: undefined, offsetInRun: 0 };
  return bias === "start" ? { paragraph, run: edge, offsetInRun: edge.text.length } : { paragraph, run: edge, offsetInRun: 0 };
}

const toAnchor = ({ paragraph, run, offsetInRun }: Located): DocxAnchor => ({
  paragraphIndex: paragraph.index,
  runIndex: run?.runIndex ?? -1,
  offsetInRun,
});

/** Engine range -> domain DocxLocation. Zero-length ranges use the start anchor for both ends. */
export function toDocxLocation(index: DocxIndex, range: TextRange): DocxLocation {
  const start = toAnchor(locate(index, range.start, "start"));
  const end = range.start === range.end ? start : toAnchor(locate(index, range.end, "end"));
  return { kind: "docx", start, end };
}

/** Inverse of toDocxLocation, used to prove anchors are exact. */
export function docxLocationToText(index: DocxIndex, location: DocxLocation): string {
  const resolve = (a: DocxAnchor) => {
    const p = index.paragraphs[a.paragraphIndex];
    const run = p?.runs[a.runIndex];
    if (!p) throw new Error("bad anchor");
    return run ? run.start + a.offsetInRun : p.end;
  };
  return index.text.slice(resolve(location.start), resolve(location.end));
}
