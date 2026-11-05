import type { DocumentModel, DocumentSegment } from "../../domain/document";
import { stableHash } from "../../shared/utilities/hash";
import { DocxError } from "./errors";
import { DEFAULT_DOCX_LIMITS } from "./limits";
import type { DocxLimits } from "./limits";
import { findUnsupportedContent, hasTrackedChanges, indexDocument } from "./ooxml";
import type { UnsupportedElement } from "./ooxml";
import { findCommentsPartName, MAIN_PART, openDocxPackage } from "./package";
import type { DocxPackage } from "./package";
import { DOCX_MIME_TYPE } from "./validate";
import { isW, parseXml, W } from "./xml";

export type UnreadPart = "headers" | "footers" | "footnotes" | "endnotes";

/** Things the user must be told about because they are not checked or not changed. */
export type DocxWarning =
  | { code: "unsupported-content"; elements: UnsupportedElement[] }
  | { code: "tracked-changes" }
  | { code: "unread-parts"; parts: UnreadPart[] }
  | { code: "existing-comments"; count: number }
  | { code: "no-text" };

export interface ParseDocxOptions {
  fileName?: string;
  createdAt?: string;
  limits?: DocxLimits;
}

export interface ParsedDocx {
  document: DocumentModel;
  warnings: DocxWarning[];
  paragraphCount: number;
}

const UNREAD_PART_PATTERNS: Array<[UnreadPart, RegExp]> = [
  ["headers", /^word\/header\d*\.xml$/],
  ["footers", /^word\/footer\d*\.xml$/],
  ["footnotes", /^word\/footnotes\.xml$/],
  ["endnotes", /^word\/endnotes\.xml$/],
];

function unreadParts(pkg: DocxPackage): UnreadPart[] {
  const names = pkg.names();
  return UNREAD_PART_PATTERNS.filter(([, pattern]) => names.some((name) => pattern.test(name))).map(([part]) => part);
}

/**
 * Parses a .docx into a DocumentModel. The normalized text is the paragraph texts joined by "\n"
 * (offsets map one-to-one onto the original run texts); one segment per text run, plus a
 * zero-length paragraph-level segment for paragraphs without text, carries the DOCX anchors.
 */
export async function parseDocx(bytes: Uint8Array, options: ParseDocxOptions = {}): Promise<ParsedDocx> {
  const pkg = await openDocxPackage(bytes, options.limits ?? DEFAULT_DOCX_LIMITS);
  const xml = await pkg.readText(MAIN_PART);
  if (xml === undefined) throw new DocxError("missing-main-part");
  const doc = parseXml(xml);
  if (!isW(doc.documentElement, "document")) throw new DocxError("unsupported-package");
  const index = indexDocument(doc);

  const segments: DocumentSegment[] = [];
  for (const paragraph of index.paragraphs) {
    const textRuns = paragraph.runs.filter((run) => run.text !== "");
    if (textRuns.length === 0) {
      const normalizedRange = { start: paragraph.start, end: paragraph.start };
      const anchor = { paragraphIndex: paragraph.index, runIndex: -1, offsetInRun: 0 };
      segments.push({
        id: `p${paragraph.index}`,
        text: "",
        normalizedRange,
        sourceLocation: { kind: "docx", start: anchor, end: { ...anchor } },
      });
      continue;
    }
    for (const run of textRuns) {
      segments.push({
        id: `p${paragraph.index}-r${run.runIndex}`,
        text: run.text,
        normalizedRange: { start: run.start, end: run.end },
        sourceLocation: {
          kind: "docx",
          start: { paragraphIndex: paragraph.index, runIndex: run.runIndex, offsetInRun: 0 },
          end: { paragraphIndex: paragraph.index, runIndex: run.runIndex, offsetInRun: run.text.length },
        },
      });
    }
  }

  const warnings: DocxWarning[] = [];
  const unsupported = findUnsupportedContent(doc);
  if (unsupported.length > 0) warnings.push({ code: "unsupported-content", elements: unsupported });
  if (hasTrackedChanges(doc)) warnings.push({ code: "tracked-changes" });
  const unread = unreadParts(pkg);
  if (unread.length > 0) warnings.push({ code: "unread-parts", parts: unread });
  const commentsName = await findCommentsPartName(pkg);
  const commentsXml = commentsName === undefined ? undefined : await pkg.readText(commentsName);
  const existing = commentsXml === undefined ? 0 : parseXml(commentsXml).getElementsByTagNameNS(W, "comment").length;
  if (existing > 0) warnings.push({ code: "existing-comments", count: existing });
  if (index.text.trim() === "") warnings.push({ code: "no-text" });

  return {
    document: {
      id: `docx-${stableHash(index.text)}`,
      sourceType: "docx",
      text: index.text,
      segments,
      metadata: {
        language: "he",
        createdAt: options.createdAt ?? new Date().toISOString(),
        mimeType: DOCX_MIME_TYPE,
        ...(options.fileName ? { fileName: options.fileName } : {}),
      },
    },
    warnings,
    paragraphCount: index.paragraphs.length,
  };
}
