import { describe, expect, it } from "vitest";
import type { DocxErrorCode } from "../../adapters/docx";
import { docxErrorMessage, docxWarningMessages } from "./messages";

const ALL_CODES: DocxErrorCode[] = [
  "invalid-extension",
  "invalid-mime",
  "empty-file",
  "file-too-large",
  "not-a-zip",
  "legacy-or-encrypted",
  "corrupt-package",
  "too-many-entries",
  "part-too-large",
  "missing-main-part",
  "unsupported-package",
  "invalid-xml",
  "unsafe-xml",
  "document-changed",
];

describe("docx messages", () => {
  it.each(ALL_CODES)("has a Hebrew message without technical details for %s", (code) => {
    const message = docxErrorMessage(code);
    expect(message).toMatch(/[\u0590-\u05FF]/);
    expect(message).not.toMatch(/stack|Error|undefined|xml\b/i);
  });

  it("describes every warning in Hebrew", () => {
    const messages = docxWarningMessages([
      { code: "unsupported-content", elements: ["fldSimple", "txbxContent"] },
      { code: "tracked-changes" },
      { code: "unread-parts", parts: ["headers", "footers", "footnotes", "endnotes"] },
      { code: "existing-comments", count: 3 },
      { code: "no-text" },
    ]);
    expect(messages).toHaveLength(5);
    expect(messages[0]).toContain("שדות פשוטים");
    expect(messages[0]).toContain("תיבות טקסט");
    expect(messages[2]).toContain("הערות סיום");
    expect(messages[3]).toContain("3 הערות קיימות");
  });
});
