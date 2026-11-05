import JSZip from "jszip";
import type { TextRange } from "../../src/domain/document";
import { elementChildren, indexDocument, isW, locate, parseXml, runUnits, serializeXml, W } from "./ooxml";
import type { DocxIndex } from "./ooxml";

export interface CommentInput {
  range: TextRange;
  text: string;
}

export interface AddCommentsOptions {
  author: string;
  initials: string;
  /** Fixed by the caller to keep output deterministic. */
  date: string;
}

const COMMENTS_PART = "word/comments.xml";
const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
const REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";

function wElement(doc: Document, name: string, attrs: Record<string, string> = {}): Element {
  const el = doc.createElementNS(W, `w:${name}`);
  for (const [key, value] of Object.entries(attrs)) el.setAttributeNS(W, `w:${key}`, value);
  return el;
}

/**
 * Splits a run at `offset` (relative to the run text) keeping w:rPr on both halves.
 * Only w:t can straddle the cut; tab/br units are atomic.
 */
function splitRun(run: Element, offset: number): void {
  const doc = run.ownerDocument;
  const units = runUnits(run);
  const total = units.reduce((n, u) => n + u.text.length, 0);
  if (offset <= 0 || offset >= total) return;

  const second = run.cloneNode(false) as Element;
  const rPr = elementChildren(run).find((c) => isW(c, "rPr"));
  if (rPr) second.appendChild(rPr.cloneNode(true));

  let acc = 0;
  for (const { node, text } of units) {
    const len = text.length;
    if (acc + len <= offset && (len > 0 || acc < offset)) {
      /* stays in the first half */
    } else if (acc < offset && offset < acc + len) {
      const tail = wElement(doc, "t");
      tail.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      tail.textContent = text.slice(offset - acc);
      node.textContent = text.slice(0, offset - acc);
      node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      second.appendChild(tail);
    } else {
      second.appendChild(node);
    }
    acc += len;
  }
  run.parentNode?.insertBefore(second, run.nextSibling);
}

function splitAt(doc: Document, offset: number, bias: "start" | "end"): void {
  const where = locate(indexDocument(doc), offset, bias);
  if (where.run) splitRun(where.run.element, where.offsetInRun);
}

/** The node before which a marker for `offset` must go, or the paragraph to append to. */
function insertionPoint(index: DocxIndex, offset: number, edge: "before-start" | "after-end") {
  if (edge === "before-start") {
    const where = locate(index, offset, "start");
    const run = where.paragraph.runs.find((r) => r.start === offset);
    return run ? { parent: run.element.parentNode as Node, before: run.element as Node | null } : { parent: where.paragraph.element as Node, before: null };
  }
  const where = locate(index, offset, "end");
  const run = where.paragraph.runs.find((r) => r.end === offset);
  return run ? { parent: run.element.parentNode as Node, before: run.element.nextSibling } : { parent: where.paragraph.element as Node, before: null };
}

function referenceRun(doc: Document, id: string): Element {
  const run = wElement(doc, "r");
  run.appendChild(wElement(doc, "commentReference", { id }));
  return run;
}

function nextCommentId(documentXml: Document, commentsXml: Document | undefined): number {
  const ids = [
    ...Array.from(documentXml.getElementsByTagNameNS(W, "commentRangeStart")),
    ...Array.from(commentsXml?.getElementsByTagNameNS(W, "comment") ?? []),
  ].map((el) => Number(el.getAttributeNS(W, "id")));
  return ids.length === 0 ? 0 : Math.max(...ids.filter(Number.isFinite)) + 1;
}

const EMPTY_COMMENTS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${W}"/>`;

/**
 * Returns a NEW docx (the input bytes are never modified) with one comment per input range.
 * Anchors are resolved by position, never by searching for text.
 */
export async function addComments(source: Uint8Array, comments: readonly CommentInput[], options: AddCommentsOptions): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(source);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Not a WordprocessingML package");
  const documentXml = parseXml(await documentFile.async("string"));
  const existingComments = zip.file(COMMENTS_PART);
  const commentsXml = parseXml(existingComments ? await existingComments.async("string") : EMPTY_COMMENTS);
  let id = nextCommentId(documentXml, existingComments ? commentsXml : undefined);

  for (const comment of comments) {
    const { start, end } = comment.range;
    const commentId = String(id++);
    if (start !== end) splitAt(documentXml, end, "end");
    splitAt(documentXml, start, "start");

    const index = indexDocument(documentXml);
    const startMarker = wElement(documentXml, "commentRangeStart", { id: commentId });
    const endMarker = wElement(documentXml, "commentRangeEnd", { id: commentId });
    if (start === end) {
      const at = insertionPoint(index, start, "before-start");
      for (const node of [startMarker, endMarker, referenceRun(documentXml, commentId)]) at.parent.insertBefore(node, at.before);
    } else {
      const endAt = insertionPoint(index, end, "after-end");
      endAt.parent.insertBefore(endMarker, endAt.before);
      endAt.parent.insertBefore(referenceRun(documentXml, commentId), endAt.before);
      const startAt = insertionPoint(index, start, "before-start");
      startAt.parent.insertBefore(startMarker, startAt.before);
    }

    const node = wElement(commentsXml, "comment", { id: commentId, author: options.author, date: options.date, initials: options.initials });
    const paragraph = wElement(commentsXml, "p");
    const run = wElement(commentsXml, "r");
    const text = wElement(commentsXml, "t");
    text.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    text.textContent = comment.text;
    run.appendChild(text);
    paragraph.appendChild(run);
    node.appendChild(paragraph);
    commentsXml.documentElement.appendChild(node);
  }

  zip.file("word/document.xml", serializeXml(documentXml));
  zip.file(COMMENTS_PART, serializeXml(commentsXml));
  if (!existingComments) await registerCommentsPart(zip);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

async function registerCommentsPart(zip: JSZip): Promise<void> {
  const typesFile = zip.file("[Content_Types].xml");
  if (!typesFile) throw new Error("Missing [Content_Types].xml");
  const types = parseXml(await typesFile.async("string"));
  const override = types.createElementNS(types.documentElement.namespaceURI, "Override");
  override.setAttribute("PartName", `/${COMMENTS_PART}`);
  override.setAttribute("ContentType", CONTENT_TYPE);
  types.documentElement.appendChild(override);
  zip.file("[Content_Types].xml", serializeXml(types));

  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  const rels = parseXml(
    relsFile ? await relsFile.async("string") : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  );
  const used = Array.from(rels.documentElement.childNodes).flatMap((n) => (n.nodeType === 1 ? [(n as Element).getAttribute("Id") ?? ""] : []));
  let n = 1;
  while (used.includes(`rId${n}`)) n++;
  const rel = rels.createElementNS(rels.documentElement.namespaceURI, "Relationship");
  rel.setAttribute("Id", `rId${n}`);
  rel.setAttribute("Type", REL_TYPE);
  rel.setAttribute("Target", "comments.xml");
  rels.documentElement.appendChild(rel);
  zip.file(relsPath, serializeXml(rels));
}
