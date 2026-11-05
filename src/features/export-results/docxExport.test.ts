import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { anchoredTexts, readFixture, sha256 } from "../../../tests/helpers/docx";
import { parseDocx } from "../../adapters/docx";
import type { ProofreadingIssue } from "../../domain/proofreading";
import type { ReviewedIssue, ReviewStatus } from "../../domain/review";
import { runProofreading } from "../../proofreading/engine";
import { initialRules } from "../../proofreading/rules";
import { buildCommentText, exportCommentedDocx } from "./docxExport";

async function reviewedFor(name: string, status: (issue: ProofreadingIssue) => ReviewStatus = () => "open"): Promise<ReviewedIssue[]> {
  const { document } = await parseDocx(readFixture(name));
  return runProofreading({ document, rules: initialRules }).issues.map((issue) => ({ issue, status: status(issue) }));
}

const NOW = new Date("2024-05-06T07:08:09.123Z");

describe("buildCommentText", () => {
  it("contains rule id, message, explanation and the suggestion", async () => {
    const reviewed = await reviewedFor("simple-paragraphs");
    const space001 = reviewed.find(({ issue }) => issue.ruleId === "HEB-SPACE-001")?.issue;
    if (!space001) throw new Error("fixture changed");
    const lines = buildCommentText(space001).split("\n");
    expect(lines[0]).toBe(`HEB-SPACE-001: ${space001.message}`);
    expect(lines.at(-1)).toMatch(/^הצעה: /);
  });

  it("distinguishes insertions and removals", async () => {
    const reviewed = await reviewedFor("simple-paragraphs");
    const insertion = reviewed.find(({ issue }) => issue.ruleId === "HEB-SPACE-003")?.issue;
    const removal = reviewed.find(({ issue }) => issue.ruleId === "HEB-SPACE-002")?.issue;
    if (!insertion || !removal) throw new Error("fixture changed");
    expect(buildCommentText(insertion)).toContain("הצעה: הוספת ");
    expect(buildCommentText(removal)).toContain("הצעה: הסרה");
  });
});

describe("exportCommentedDocx", () => {
  it("exports open and accepted findings only, under a new file name, without touching the source", async () => {
    const source = readFixture("simple-paragraphs");
    const before = sha256(source);
    const reviewed = await reviewedFor("simple-paragraphs", (issue) =>
      issue.ruleId === "HEB-SPACE-002" ? "rejected" : issue.ruleId === "HEB-SPACE-003" ? "ignored" : issue.ruleId === "HEB-CONS-002" ? "accepted" : "open",
    );
    const outcome = await exportCommentedDocx({ bytes: source, fileName: "מסמך.docx", reviewed, now: NOW });
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome).toMatchObject({ fileName: "מסמך.commented.docx", applied: 2, skipped: 0 });
    expect([...(await anchoredTexts(outcome.bytes)).values()]).toEqual(["  ", "הוא הוא"]);
    expect(sha256(source)).toBe(before);
    const comments = await (await JSZip.loadAsync(outcome.bytes)).file("word/comments.xml")?.async("string");
    expect(comments).toContain('w:date="2024-05-06T07:08:09Z"');
    expect(comments).toContain('w:author="מגיה עברית"');
  });

  it("reports that there is nothing to export when every finding is rejected or ignored", async () => {
    const reviewed = await reviewedFor("simple-paragraphs", () => "rejected");
    const outcome = await exportCommentedDocx({ bytes: readFixture("simple-paragraphs"), fileName: "a.docx", reviewed });
    expect(outcome).toEqual({ ok: false, message: "אין ממצאים לייצוא כהערות." });
  });

  it("counts findings whose location cannot be verified instead of misplacing them", async () => {
    const reviewed = await reviewedFor("simple-paragraphs");
    const wrongDocument = await exportCommentedDocx({ bytes: readFixture("tables"), fileName: "a.docx", reviewed, now: NOW });
    if (!wrongDocument.ok) throw new Error(wrongDocument.message);
    expect(wrongDocument.applied + wrongDocument.skipped).toBe(reviewed.length);
    expect(wrongDocument.skipped).toBeGreaterThan(0);
  });

  it("maps adapter errors to Hebrew without technical details", async () => {
    const reviewed = await reviewedFor("simple-paragraphs");
    const outcome = await exportCommentedDocx({ bytes: new TextEncoder().encode("not a zip"), fileName: "a.docx", reviewed });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toBe("הקובץ אינו מסמך DOCX תקין.");
  });
});
