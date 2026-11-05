import type { DocxAnchor } from "../../domain/document";
import { elementChildren, isW, W } from "./xml";

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
  /** Paragraph texts joined with "\n". This is the text the engine receives. */
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

/** Inline wrappers whose runs are part of the visible text. Tracked insertions count; deletions do not. */
const RUN_CONTAINERS = ["hyperlink", "ins", "moveTo", "smartTag"];

function collectRuns(node: Element, out: Element[]): void {
  for (const child of elementChildren(node)) {
    if (isW(child, "r")) out.push(child);
    else if (RUN_CONTAINERS.some((name) => isW(child, name))) collectRuns(child, out);
    else if (isW(child, "sdt")) elementChildren(child).filter((c) => isW(c, "sdtContent")).forEach((c) => collectRuns(c, out));
  }
}

/** Runs of a paragraph in document order, including runs inside hyperlinks, tracked insertions and inline content controls. */
const paragraphRunElements = (p: Element): Element[] => {
  const runs: Element[] = [];
  collectRuns(p, runs);
  return runs;
};

/**
 * Indexes every w:p of the body (including table cells and block-level content controls) in
 * document order. Paragraphs nested in runs (text boxes) are not indexed.
 */
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
    cursor += 1;
  });
  return { paragraphs, text: paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n") };
}

/** Resolves an anchor to an offset in the extracted text, or undefined if it does not exist. */
export function anchorToOffset(index: DocxIndex, anchor: DocxAnchor): number | undefined {
  const paragraph = index.paragraphs[anchor.paragraphIndex];
  if (!paragraph) return undefined;
  if (anchor.runIndex === -1) return anchor.offsetInRun === 0 ? paragraph.end : undefined;
  const run = paragraph.runs[anchor.runIndex];
  if (!run || anchor.offsetInRun < 0 || anchor.offsetInRun > run.text.length) return undefined;
  return run.start + anchor.offsetInRun;
}

export interface Located {
  paragraph: ParagraphInfo;
  run: RunInfo | undefined;
  offsetInRun: number;
}

/**
 * Maps a text offset to a paragraph/run position. "start" bias prefers the run that begins at the
 * offset, "end" bias prefers the run that ends there. Mirrors the domain segment mapping.
 */
export function locate(index: DocxIndex, offset: number, bias: "start" | "end"): Located {
  const { paragraphs } = index;
  const last = <T>(items: T[], pred: (item: T) => boolean) => items.filter(pred).at(-1);
  const paragraph =
    (bias === "start"
      ? paragraphs.find((p) => p.start <= offset && offset < p.end)
      : paragraphs.find((p) => p.start < offset && offset <= p.end)) ??
    last(paragraphs, (p) => p.start <= offset) ??
    paragraphs[0];
  if (!paragraph) throw new Error("Document has no paragraphs");
  const inside = paragraph.runs.find((r) => (bias === "start" ? r.start <= offset && offset < r.end : r.start < offset && offset <= r.end));
  if (inside) return { paragraph, run: inside, offsetInRun: offset - inside.start };
  const edge = bias === "start" ? paragraph.runs.at(-1) : paragraph.runs.at(0);
  if (!edge) return { paragraph, run: undefined, offsetInRun: 0 };
  return { paragraph, run: edge, offsetInRun: bias === "start" ? edge.text.length : 0 };
}

const UNSUPPORTED_ELEMENTS = ["fldSimple", "txbxContent", "altChunk"] as const;

export type UnsupportedElement = (typeof UNSUPPORTED_ELEMENTS)[number];

/**
 * Elements whose text is not indexed: simple fields (generated values), text boxes and embedded
 * chunks. The engine never sees this text, so it is neither checked nor commented.
 */
export function findUnsupportedContent(doc: Document): UnsupportedElement[] {
  return UNSUPPORTED_ELEMENTS.filter((name) => doc.getElementsByTagNameNS(W, name).length > 0);
}

/** True when the document has tracked changes. Text is processed as if all changes were accepted. */
export function hasTrackedChanges(doc: Document): boolean {
  return ["ins", "del", "moveFrom", "moveTo"].some((name) => doc.getElementsByTagNameNS(W, name).length > 0);
}
