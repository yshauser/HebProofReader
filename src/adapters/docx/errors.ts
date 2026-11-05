export type DocxErrorCode =
  | "invalid-extension"
  | "invalid-mime"
  | "empty-file"
  | "file-too-large"
  | "not-a-zip"
  | "legacy-or-encrypted"
  | "corrupt-package"
  | "too-many-entries"
  | "part-too-large"
  | "missing-main-part"
  | "unsupported-package"
  | "invalid-xml"
  | "unsafe-xml"
  | "document-changed";

/** Typed adapter failure. Messages never contain document content; the UI maps `code` to Hebrew text. */
export class DocxError extends Error {
  readonly code: DocxErrorCode;

  constructor(code: DocxErrorCode) {
    super(code);
    this.name = "DocxError";
    this.code = code;
  }
}
