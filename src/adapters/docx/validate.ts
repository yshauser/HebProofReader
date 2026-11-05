import { DocxError } from "./errors";
import { DEFAULT_DOCX_LIMITS } from "./limits";
import type { DocxLimits } from "./limits";

export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** MIME types browsers report for .docx files. Empty is allowed because many systems report none. */
const ACCEPTED_MIME_TYPES = new Set([
  DOCX_MIME_TYPE,
  "",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
]);

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((byte, i) => bytes[i] === byte);

export interface UploadInfo {
  name: string;
  size: number;
  type: string;
}

/** Cheap checks on file metadata, run before the file is read. */
export function validateUploadInfo(info: UploadInfo, limits: DocxLimits = DEFAULT_DOCX_LIMITS): void {
  if (!/\.docx$/i.test(info.name)) throw new DocxError("invalid-extension");
  if (!ACCEPTED_MIME_TYPES.has(info.type)) throw new DocxError("invalid-mime");
  if (info.size === 0) throw new DocxError("empty-file");
  if (info.size > limits.maxFileBytes) throw new DocxError("file-too-large");
}

/** Content-signature checks. The filename and MIME type alone are never trusted. */
export function validateSignature(bytes: Uint8Array, limits: DocxLimits = DEFAULT_DOCX_LIMITS): void {
  if (bytes.length === 0) throw new DocxError("empty-file");
  if (bytes.length > limits.maxFileBytes) throw new DocxError("file-too-large");
  if (startsWith(bytes, OLE_SIGNATURE)) throw new DocxError("legacy-or-encrypted");
  if (!startsWith(bytes, ZIP_SIGNATURE)) throw new DocxError("not-a-zip");
}
