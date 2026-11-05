import { describe, expect, it } from "vitest";
import { DocxError } from "./errors";
import { DEFAULT_DOCX_LIMITS } from "./limits";
import { DOCX_MIME_TYPE, validateSignature, validateUploadInfo } from "./validate";

const codeOf = (fn: () => void) => {
  try {
    fn();
  } catch (error) {
    return error instanceof DocxError ? error.code : "other";
  }
  return undefined;
};

describe("validateUploadInfo", () => {
  const ok = { name: "doc.docx", size: 1000, type: DOCX_MIME_TYPE };

  it("accepts a normal .docx upload", () => {
    expect(codeOf(() => validateUploadInfo(ok))).toBeUndefined();
  });

  it.each(["doc.doc", "doc.docm", "doc.txt", "doc.docx.exe", "docx", "doc.pdf", ""])("rejects extension of %j", (name) => {
    expect(codeOf(() => validateUploadInfo({ ...ok, name }))).toBe("invalid-extension");
  });

  it("is case-insensitive for the extension", () => {
    expect(codeOf(() => validateUploadInfo({ ...ok, name: "DOC.DOCX" }))).toBeUndefined();
  });

  it.each(["", "application/octet-stream", "application/zip", "application/x-zip-compressed"])("accepts MIME %j", (type) => {
    expect(codeOf(() => validateUploadInfo({ ...ok, type }))).toBeUndefined();
  });

  it.each(["application/msword", "text/plain", "application/pdf", "image/png"])("rejects MIME %j", (type) => {
    expect(codeOf(() => validateUploadInfo({ ...ok, type }))).toBe("invalid-mime");
  });

  it("rejects empty and oversized files, with a configurable limit", () => {
    expect(codeOf(() => validateUploadInfo({ ...ok, size: 0 }))).toBe("empty-file");
    expect(codeOf(() => validateUploadInfo({ ...ok, size: DEFAULT_DOCX_LIMITS.maxFileBytes + 1 }))).toBe("file-too-large");
    expect(codeOf(() => validateUploadInfo({ ...ok, size: DEFAULT_DOCX_LIMITS.maxFileBytes }))).toBeUndefined();
    expect(codeOf(() => validateUploadInfo({ ...ok, size: 11 }, { ...DEFAULT_DOCX_LIMITS, maxFileBytes: 10 }))).toBe("file-too-large");
  });
});

describe("validateSignature", () => {
  it("accepts a ZIP signature", () => {
    expect(codeOf(() => validateSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0])))).toBeUndefined();
  });

  it("rejects legacy .doc / encrypted OLE containers", () => {
    expect(codeOf(() => validateSignature(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0])))).toBe("legacy-or-encrypted");
  });

  it("does not trust the filename: renamed text, PDF and empty content are rejected", () => {
    expect(codeOf(() => validateSignature(new TextEncoder().encode("hello")))).toBe("not-a-zip");
    expect(codeOf(() => validateSignature(new TextEncoder().encode("%PDF-1.7")))).toBe("not-a-zip");
    expect(codeOf(() => validateSignature(new Uint8Array()))).toBe("empty-file");
  });

  it("enforces the size limit on the actual bytes", () => {
    expect(codeOf(() => validateSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]), { ...DEFAULT_DOCX_LIMITS, maxFileBytes: 4 }))).toBe("file-too-large");
  });
});
