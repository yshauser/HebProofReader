import { describe, expect, it } from "vitest";
import { commentedFileName } from "./filename";

describe("commentedFileName", () => {
  it("never returns the source name", () => {
    expect(commentedFileName("report.docx")).toBe("report.commented.docx");
    expect(commentedFileName("report.docx")).not.toBe("report.docx");
  });

  it("keeps Hebrew names", () => {
    expect(commentedFileName("דוח שנתי.docx")).toBe("דוח שנתי.commented.docx");
  });

  it.each([
    ["..\\..\\evil.docx", "evil"],
    ["a/b/c.docx", "abc"],
    ['we"ird:na*me?.docx', "weirdname"],
    ["bidi\u202Etxt.docx", "biditxt"],
    ["  .hidden.docx", "hidden"],
  ])("sanitizes %j", (input, base) => {
    expect(commentedFileName(input)).toBe(`${base}.commented.docx`);
  });

  it("falls back for empty names and limits length", () => {
    expect(commentedFileName(undefined)).toBe("document.commented.docx");
    expect(commentedFileName(".docx")).toBe("document.commented.docx");
    expect(commentedFileName(`${"x".repeat(500)}.docx`).length).toBeLessThanOrEqual(80 + ".commented.docx".length);
  });
});
