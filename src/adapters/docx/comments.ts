import type { DocxLocation } from "../../domain/document";
import { DEFAULT_DOCX_LIMITS } from "./limits";
import type { DocxLimits } from "./limits";
import { anchorToOffset, indexDocument, locate, runUnits } from "./ooxml";
import type { DocxIndex, RunInfo } from "./ooxml";
import { COMMENTS_REL_TYPE, CONTENT_TYPES_PART, findCommentsPartName, MAIN_PART, openDocxPackage, RELS_PART } from "./package";
import type { DocxPackage } from "./package";
import { DocxError } from "./errors";
import { elementChildren, isW, parseXml, serializeXml, W, wElement, XML_NS } from "./xml";

export interface DocxCommentInput {
  location: DocxLocation;
  /** The text the finding covers. The comment is only written if the anchored text still equals it. */
  expectedText: string;
  text: string;
}

export interface AddCommentsOptions {
  author: string;
  initials: string;
  /** ISO 8601 date written to every comment. Supplied by the caller to keep output deterministic. */
  date: string;
  limits?: DocxLimits;
}

export interface SkippedComment {
  index: number;
  reason: "invalid-anchor" | "text-mismatch";
}

export interface AddCommentsResult {
  bytes: Uint8Array;
  applied: number;
  skipped: SkippedComment[];
}

const DEFAULT_COMMENTS_PART = "word/comments.xml";
const COMMENTS_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
const EMPTY_COMMENTS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${W}"/>`;
const EMPTY_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

/**
 * Splits a run at `offset` (relative to the run text) keeping w:rPr and the run attributes on both
 * halves. Only w:t can straddle the cut; tab/br units are atomic.
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
      tail.setAttributeNS(XML_NS, "xml:space", "preserve");
      tail.textContent = text.slice(offset - acc);
      node.textContent = text.slice(0, offset - acc);
      node.setAttributeNS(XML_NS, "xml:space", "preserve");
      second.appendChild(tail);
    } else {
      second.appendChild(node);
    }
    acc += len;
  }
  run.parentNode?.insertBefore(second, run.nextSibling);
}

interface Placement {
  start: number;
  end: number;
  id: string;
}

/** Runs with text, sorted by offset (document order). */
const textRuns = (index: DocxIndex): RunInfo[] => index.paragraphs.flatMap((p) => p.runs).filter((r) => r.text !== "");

/** Binary search for the run whose text strictly contains a cut at `offset` (r.start < offset < r.end). */
function runStrictlyAround(runs: readonly RunInfo[], offset: number): RunInfo | undefined {
  let low = 0;
  let high = runs.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const run = runs[mid];
    if (!run) return undefined;
    if (offset <= run.start) high = mid - 1;
    else if (offset >= run.end) low = mid + 1;
    else return run;
  }
  return undefined;
}

/**
 * Inserts all comment markers with a single index: runs are first cut at every boundary from the
 * highest offset to the lowest (a cut never disturbs positions before it), then the index is
 * rebuilt once and the markers are placed next to the runs that now begin or end at each boundary.
 */
function insertComments(doc: Document, placements: readonly Placement[]): void {
  const before = textRuns(indexDocument(doc));
  const cuts = [...new Set(placements.flatMap((p) => [p.start, p.end]))].sort((a, b) => b - a);
  for (const cut of cuts) {
    const run = runStrictlyAround(before, cut);
    if (run) splitRun(run.element, cut - run.start);
  }

  const index = indexDocument(doc);
  const allRuns = index.paragraphs.flatMap((p) => p.runs);
  const startsAt = new Map<number, RunInfo>();
  const endsAt = new Map<number, RunInfo>();
  for (const run of allRuns) {
    if (!startsAt.has(run.start)) startsAt.set(run.start, run);
    if (!endsAt.has(run.end)) endsAt.set(run.end, run);
  }
  const beforeStart = (offset: number) => {
    const run = startsAt.get(offset);
    return run
      ? { parent: run.element.parentNode as Node, before: run.element as Node | null }
      : { parent: locate(index, offset, "start").paragraph.element as Node, before: null };
  };

  for (const { start, end, id } of placements) {
    const startMarker = wElement(doc, "commentRangeStart", { id });
    const endMarker = wElement(doc, "commentRangeEnd", { id });
    if (start === end) {
      const at = beforeStart(start);
      for (const node of [startMarker, endMarker, referenceRun(doc, id)]) at.parent.insertBefore(node, at.before);
      continue;
    }
    const endRun = endsAt.get(end);
    const endParent = endRun ? (endRun.element.parentNode as Node) : (locate(index, end, "end").paragraph.element as Node);
    const endBefore = endRun ? endRun.element.nextSibling : null;
    endParent.insertBefore(endMarker, endBefore);
    endParent.insertBefore(referenceRun(doc, id), endBefore);
    const startAt = beforeStart(start);
    startAt.parent.insertBefore(startMarker, startAt.before);
  }
}

function referenceRun(doc: Document, id: string): Element {
  const run = wElement(doc, "r");
  run.appendChild(wElement(doc, "commentReference", { id }));
  return run;
}

function nextCommentId(documentXml: Document, commentsXml: Document): number {
  const ids = [
    ...Array.from(documentXml.getElementsByTagNameNS(W, "commentRangeStart")),
    ...Array.from(documentXml.getElementsByTagNameNS(W, "commentReference")),
    ...Array.from(commentsXml.getElementsByTagNameNS(W, "comment")),
  ]
    .map((el) => Number(el.getAttributeNS(W, "id")))
    .filter(Number.isFinite);
  return ids.length === 0 ? 0 : Math.max(...ids) + 1;
}

function commentElement(doc: Document, id: string, text: string, options: AddCommentsOptions): Element {
  const comment = wElement(doc, "comment", { id, author: options.author, date: options.date, initials: options.initials });
  text.split("\n").forEach((line, i) => {
    const paragraph = wElement(doc, "p");
    if (i === 0) {
      const anchor = wElement(doc, "r");
      anchor.appendChild(wElement(doc, "annotationRef"));
      paragraph.appendChild(anchor);
    }
    const run = wElement(doc, "r");
    const t = wElement(doc, "t");
    t.setAttributeNS(XML_NS, "xml:space", "preserve");
    t.textContent = line;
    run.appendChild(t);
    paragraph.appendChild(run);
    comment.appendChild(paragraph);
  });
  return comment;
}

/**
 * Returns a NEW .docx with one comment per resolvable input; the source bytes are never modified.
 *
 * Every anchor is resolved against the ORIGINAL document before any edit, and a comment is only
 * written when the anchored text still equals `expectedText` (anchors are positions, never text
 * searches). Unresolvable comments are reported in `skipped` instead of being placed elsewhere.
 * Existing comments are preserved and new ids are allocated after the highest existing id.
 * All other package parts are copied unchanged.
 */
export async function addCommentsToDocx(
  source: Uint8Array,
  comments: readonly DocxCommentInput[],
  options: AddCommentsOptions,
): Promise<AddCommentsResult> {
  const pkg = await openDocxPackage(source, options.limits ?? DEFAULT_DOCX_LIMITS);
  const documentText = await pkg.readText(MAIN_PART);
  if (documentText === undefined) throw new DocxError("missing-main-part");
  const documentXml = parseXml(documentText);
  const original = indexDocument(documentXml);

  const resolved: Array<{ input: DocxCommentInput; start: number; end: number }> = [];
  const skipped: SkippedComment[] = [];
  comments.forEach((input, index) => {
    const start = anchorToOffset(original, input.location.start);
    const end = anchorToOffset(original, input.location.end);
    if (start === undefined || end === undefined || start > end) skipped.push({ index, reason: "invalid-anchor" });
    else if (original.text.slice(start, end) !== input.expectedText) skipped.push({ index, reason: "text-mismatch" });
    else resolved.push({ input, start, end });
  });

  if (resolved.length === 0) return { bytes: new Uint8Array(source), applied: 0, skipped };

  const existingName = await findCommentsPartName(pkg);
  const commentsName = existingName ?? DEFAULT_COMMENTS_PART;
  const existingXml = await pkg.readText(commentsName);
  const commentsXml = parseXml(existingXml ?? EMPTY_COMMENTS);
  let id = nextCommentId(documentXml, commentsXml);

  const placements = resolved.map(({ start, end }) => ({ start, end, id: String(id++) }));
  insertComments(documentXml, placements);
  resolved.forEach(({ input }, i) => {
    commentsXml.documentElement.appendChild(commentElement(commentsXml, placements[i]?.id ?? "", input.text, options));
  });

  pkg.zip.file(MAIN_PART, serializeXml(documentXml));
  pkg.zip.file(commentsName, serializeXml(commentsXml));
  await ensureContentType(pkg, commentsName);
  if (existingName === undefined) await addCommentsRelationship(pkg, commentsName);
  const bytes = await pkg.zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { bytes, applied: resolved.length, skipped };
}

async function ensureContentType(pkg: DocxPackage, partName: string): Promise<void> {
  const typesText = await pkg.readText(CONTENT_TYPES_PART);
  if (typesText === undefined) throw new DocxError("missing-main-part");
  const types = parseXml(typesText);
  const exists = Array.from(types.getElementsByTagName("Override")).some((el) => el.getAttribute("PartName") === `/${partName}`);
  if (exists) return;
  const override = types.createElementNS(types.documentElement.namespaceURI, "Override");
  override.setAttribute("PartName", `/${partName}`);
  override.setAttribute("ContentType", COMMENTS_CONTENT_TYPE);
  types.documentElement.appendChild(override);
  pkg.zip.file(CONTENT_TYPES_PART, serializeXml(types));
}

async function addCommentsRelationship(pkg: DocxPackage, partName: string): Promise<void> {
  const rels = parseXml((await pkg.readText(RELS_PART)) ?? EMPTY_RELS);
  const used = new Set(Array.from(rels.getElementsByTagName("Relationship")).map((el) => el.getAttribute("Id")));
  let n = 1;
  while (used.has(`rId${n}`)) n++;
  const rel = rels.createElementNS(rels.documentElement.namespaceURI, "Relationship");
  rel.setAttribute("Id", `rId${n}`);
  rel.setAttribute("Type", COMMENTS_REL_TYPE);
  rel.setAttribute("Target", partName.replace(/^word\//, ""));
  rels.documentElement.appendChild(rel);
  pkg.zip.file(RELS_PART, serializeXml(rels));
}
