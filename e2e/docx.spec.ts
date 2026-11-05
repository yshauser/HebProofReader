import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import JSZip from "jszip";

const FIXTURE = "tests/fixtures/docx/split-runs.docx";

test("DOCX workflow: upload, run, select, review, export a commented copy", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const sourceHash = createHash("sha256").update(await readFile(FIXTURE)).digest("hex");

  await page.goto("/");
  await page.getByLabel("העלאת קובץ DOCX").setInputFiles(FIXTURE);

  const preview = page.getByTestId("document-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("docx-file-name")).toHaveText("split-runs.docx");
  await expect(page.getByRole("textbox", { name: "טקסט לבדיקה" })).toHaveCount(0);

  await page.getByRole("button", { name: "בדיקה" }).click();
  const findings = page.getByTestId("finding");
  await expect(findings).toHaveCount(4);
  await expect(page.getByRole("button", { name: "החלת תיקון" })).toHaveCount(0);

  const space001 = findings.filter({ hasText: "HEB-SPACE-001" });
  await expect(space001).toContainText("פסקה 1");
  await space001.getByRole("button", { name: /HEB-SPACE-001/ }).click();
  await expect(page.getByTestId("highlight")).toHaveText("  ");

  await findings.filter({ hasText: "HEB-SPACE-003" }).getByRole("button", { name: "דחייה" }).click();
  await expect(page.getByTestId("count-rejected")).toHaveText("1");

  const [docxDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "ייצוא DOCX עם הערות" }).click(),
  ]);
  expect(docxDownload.suggestedFilename()).toBe("split-runs.commented.docx");
  const zip = await JSZip.loadAsync(await readFile(await docxDownload.path()));
  const comments = (await zip.file("word/comments.xml")?.async("string")) ?? "";
  expect(comments.match(/<w:comment /g)).toHaveLength(3);
  expect(comments).not.toContain("HEB-SPACE-003");
  const document = (await zip.file("word/document.xml")?.async("string")) ?? "";
  expect(document.match(/<w:commentRangeStart /g)).toHaveLength(3);
  expect(document.match(/<w:commentReference /g)).toHaveLength(3);

  const [reportDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "ייצוא דוח JSON" }).click(),
  ]);
  const report = JSON.parse(await readFile(await reportDownload.path(), "utf8"));
  expect(report.sourceType).toBe("docx");
  expect(report.counts.total).toBe(4);

  expect(createHash("sha256").update(await readFile(FIXTURE)).digest("hex")).toBe(sourceHash);

  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:"))).toEqual([]);
});

test("DOCX upload rejects an unsupported file with a Hebrew message", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("העלאת קובץ DOCX").setInputFiles({ name: "notes.docx", mimeType: "text/plain", buffer: Buffer.from("שלום") });
  await expect(page.getByTestId("notice")).toContainText("סוג הקובץ אינו נתמך");
  await expect(page.getByRole("textbox", { name: "טקסט לבדיקה" })).toBeVisible();
});
