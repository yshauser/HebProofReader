import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TEXT = "שלום ,יוסף  טוב";

test("primary workflow: paste, run, select, fix, export", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const editor = page.getByRole("textbox", { name: "טקסט לבדיקה" });
  await editor.fill(TEXT);
  await page.getByRole("button", { name: "בדיקה" }).click();

  const findings = page.getByTestId("finding");
  await expect(findings).toHaveCount(3);
  await expect(page.getByTestId("count-total")).toHaveText("3");

  await findings.filter({ hasText: "HEB-SPACE-001" }).getByRole("button", { name: /HEB-SPACE-001/ }).click();
  await expect(page.getByTestId("highlight")).toHaveText("  ");

  await findings.filter({ hasText: "HEB-SPACE-001" }).getByRole("button", { name: "החלת תיקון" }).click();
  await expect(editor).toHaveValue("שלום ,יוסף טוב");
  await expect(findings).toHaveCount(2);

  const [textDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "ייצוא טקסט מתוקן" }).click(),
  ]);
  expect(textDownload.suggestedFilename()).toBe("corrected-text.txt");
  const textPath = await textDownload.path();
  expect(await readFile(textPath, "utf8")).toBe("שלום ,יוסף טוב");

  const [reportDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "ייצוא דוח JSON" }).click(),
  ]);
  const report = JSON.parse(await readFile(await reportDownload.path(), "utf8"));
  expect(report.counts.total).toBe(2);

  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:"))).toEqual([]);
});
