import type { DocxLimits } from "../../adapters/docx";
import type { ProofreadingIssue } from "../../domain/proofreading";
import type { ReviewedIssue } from "../../domain/review";
import { visibleText } from "../../shared/utilities/text";
import { docxErrorMessage, GENERIC_DOCX_ERROR } from "../docx-import/messages";

export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const COMMENT_AUTHOR = "מגיה עברית";
export const COMMENT_INITIALS = "מע";

/** Text of the Word comment: rule and message, the explanation, and the suggestion if any. */
export function buildCommentText(issue: ProofreadingIssue): string {
  const lines = [`${issue.ruleId}: ${issue.message}`];
  if (issue.explanation) lines.push(issue.explanation);
  if (issue.suggestion !== undefined) {
    const suggestion = issue.suggestion === "" ? "הסרה" : visibleText(issue.suggestion);
    lines.push(issue.range.start === issue.range.end ? `הצעה: הוספת ${suggestion}` : `הצעה: ${suggestion}`);
  }
  return lines.join("\n");
}

/** Rejected and ignored findings are not exported; open and accepted ones are. */
export const isExportedStatus = (status: ReviewedIssue["status"]) => status === "open" || status === "accepted";

export type DocxExportResult =
  | { ok: true; bytes: Uint8Array; fileName: string; applied: number; skipped: number }
  | { ok: false; message: string };

export interface DocxExportInput {
  bytes: Uint8Array;
  fileName: string | undefined;
  reviewed: readonly ReviewedIssue[];
  now?: Date;
  limits?: DocxLimits;
}

/** Writes a NEW .docx with a comment for every exported finding. The source bytes are not modified. */
export async function exportCommentedDocx(input: DocxExportInput): Promise<DocxExportResult> {
  const adapter = await import("../../adapters/docx");
  const comments = input.reviewed
    .filter(({ status }) => isExportedStatus(status))
    .flatMap(({ issue }) =>
      issue.sourceLocation.kind === "docx"
        ? [{ location: issue.sourceLocation, expectedText: issue.originalText, text: buildCommentText(issue) }]
        : [],
    );
  if (comments.length === 0) return { ok: false, message: "אין ממצאים לייצוא כהערות." };
  try {
    const date = (input.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
    const result = await adapter.addCommentsToDocx(input.bytes, comments, {
      author: COMMENT_AUTHOR,
      initials: COMMENT_INITIALS,
      date,
      ...(input.limits ? { limits: input.limits } : {}),
    });
    return {
      ok: true,
      bytes: result.bytes,
      fileName: adapter.commentedFileName(input.fileName),
      applied: result.applied,
      skipped: result.skipped.length,
    };
  } catch (error) {
    return { ok: false, message: error instanceof adapter.DocxError ? docxErrorMessage(error.code) : GENERIC_DOCX_ERROR };
  }
}
