import type { DocumentModel } from "../../domain/document";
import type { DocxLimits, DocxWarning } from "../../adapters/docx";
import { docxErrorMessage, GENERIC_DOCX_ERROR } from "./messages";

export interface LoadedDocx {
  /** The untouched uploaded bytes, kept in memory only for the active session. */
  bytes: Uint8Array;
  fileName: string;
  document: DocumentModel;
  warnings: DocxWarning[];
  paragraphCount: number;
}

export type LoadDocxResult = ({ ok: true } & LoadedDocx) | { ok: false; message: string };

/**
 * Application use case: validate, read and parse an uploaded .docx. The adapter (and its ZIP/XML
 * dependencies) is loaded on demand. Failures become Hebrew messages; nothing is logged.
 */
export async function loadDocxFile(file: File, limits?: DocxLimits): Promise<LoadDocxResult> {
  const adapter = await import("../../adapters/docx");
  try {
    adapter.validateUploadInfo({ name: file.name, size: file.size, type: file.type }, limits);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await adapter.parseDocx(bytes, { fileName: file.name, ...(limits ? { limits } : {}) });
    return { ok: true, bytes, fileName: file.name, ...parsed };
  } catch (error) {
    return { ok: false, message: error instanceof adapter.DocxError ? docxErrorMessage(error.code) : GENERIC_DOCX_ERROR };
  }
}
