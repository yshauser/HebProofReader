import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseXml, W } from "../adapters/docx/xml";
import { findingsReportSchema } from "../features/export-results/exporters";
import { anchoredTexts, readFixture, sha256 } from "../../tests/helpers/docx";
import { App } from "./App";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const user = () => userEvent.setup({ applyAccept: false });

const fixtureFile = (name: string, fileName = `${name}.docx`) => new File([readFixture(name)], fileName, { type: DOCX_MIME });
const uploadInput = () => screen.getByLabelText("העלאת קובץ DOCX");

async function upload(file: File) {
  await user().upload(uploadInput(), file);
}

async function uploadAndRun(name = "simple-paragraphs") {
  render(<App />);
  await upload(fixtureFile(name));
  await screen.findByTestId("document-preview");
  await userEvent.click(screen.getByRole("button", { name: "בדיקה" }));
}

const cards = () => screen.getAllByTestId("finding");
const card = (ruleId: string) => {
  const found = cards().find((c) => c.getAttribute("data-rule-id") === ruleId);
  if (!found) throw new Error(`no finding for ${ruleId}`);
  return found;
};

describe("App with a DOCX file", () => {
  let created: Blob[];
  let downloads: string[];

  beforeEach(() => {
    created = [];
    downloads = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:test";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("loads the file into a read-only preview and shows the file name and limitations", async () => {
    render(<App />);
    await upload(fixtureFile("tracked-changes", "דוח שלי.docx"));
    const preview = await screen.findByTestId("document-preview");
    expect(preview).toHaveAttribute("dir", "rtl");
    expect(preview).toHaveTextContent("לפני השינוי טקסט שהוכנס");
    expect(screen.queryByRole("textbox", { name: "טקסט לבדיקה" })).not.toBeInTheDocument();
    expect(screen.getByTestId("docx-file-name")).toHaveTextContent("דוח שלי.docx");
    const warnings = within(screen.getByRole("list", { name: "אזהרות" })).getAllByRole("listitem");
    expect(warnings.map((w) => w.textContent).join("\n")).toMatch(/מעקב שינויים/);
    expect(warnings.map((w) => w.textContent).join("\n")).toMatch(/כותרות עליונות/);
  });

  it("shows findings with a paragraph position and highlights the exact range in the preview", async () => {
    await uploadAndRun();
    expect(cards()).toHaveLength(4);
    expect(card("HEB-SPACE-001")).toHaveTextContent("פסקה 2");
    await userEvent.click(within(card("HEB-SPACE-001")).getByRole("button", { name: /HEB-SPACE-001/ }));
    const highlights = screen.getAllByTestId("highlight");
    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.textContent).toBe("  ");
    expect(highlights[0]?.closest("p")).toHaveAttribute("data-line", "2");
  });

  it("never offers fixes or corrected-text export for a DOCX", async () => {
    await uploadAndRun();
    expect(screen.queryByRole("button", { name: "החלת תיקון" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "החלת כל התיקונים הבטוחים" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ייצוא טקסט מתוקן" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ייצוא DOCX עם הערות" })).toBeEnabled();
  });

  it("keeps the export disabled until a check has run", async () => {
    render(<App />);
    await upload(fixtureFile("simple-paragraphs"));
    await screen.findByTestId("document-preview");
    expect(screen.getByRole("button", { name: "ייצוא DOCX עם הערות" })).toBeDisabled();
  });

  it("exports a new .docx with a comment for each open or accepted finding and none for rejected or ignored ones", async () => {
    const source = readFixture("simple-paragraphs");
    const before = sha256(source);
    await uploadAndRun();
    await userEvent.click(within(card("HEB-SPACE-002")).getByRole("button", { name: "דחייה" }));
    await userEvent.click(within(card("HEB-SPACE-003")).getByRole("button", { name: "השמטה" }));
    await userEvent.click(within(card("HEB-CONS-002")).getByRole("button", { name: "קבלה" }));
    await userEvent.click(screen.getByRole("button", { name: "ייצוא DOCX עם הערות" }));

    await waitFor(() => expect(downloads).toEqual(["simple-paragraphs.commented.docx"]));
    const bytes = new Uint8Array(await created[0]?.arrayBuffer());
    expect(created[0]?.type).toBe(DOCX_MIME);

    const commentsXml = await (await JSZip.loadAsync(bytes)).file("word/comments.xml")?.async("string");
    const comments = Array.from(parseXml(commentsXml ?? "").getElementsByTagNameNS(W, "comment"));
    expect(comments).toHaveLength(2);
    expect(comments.map((c) => c.textContent).join("|")).toContain("HEB-SPACE-001");
    expect(comments.map((c) => c.textContent).join("|")).toContain("HEB-CONS-002");
    expect(comments.map((c) => c.textContent).join("|")).not.toContain("HEB-SPACE-002");
    expect([...(await anchoredTexts(bytes)).values()]).toEqual(["  ", "הוא הוא"]);

    expect(sha256(source)).toBe(before);
    expect(await screen.findByTestId("notice")).toHaveTextContent("נוצר קובץ חדש עם 2 הערות.");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("exports a JSON report that records the DOCX source locations", async () => {
    await uploadAndRun("split-runs");
    await userEvent.click(screen.getByRole("button", { name: "ייצוא דוח JSON" }));
    const report = findingsReportSchema.parse(JSON.parse((await created[0]?.text()) ?? ""));
    expect(report.sourceType).toBe("docx");
    expect(report.issues[0]).toMatchObject({
      ruleId: "HEB-SPACE-001",
      range: { start: 3, end: 5 },
      sourceLocation: { kind: "docx", start: { paragraphIndex: 0, runIndex: 0, offsetInRun: 3 }, end: { paragraphIndex: 0, runIndex: 1, offsetInRun: 1 } },
    });
    expect(JSON.stringify(report)).not.toContain("split-runs.docx");
  });

  it.each([
    ["a legacy .doc", () => new File([readFixture("simple-paragraphs")], "old.doc", { type: "application/msword" }), "קובצי DOC ישנים"],
    ["a renamed text file", () => new File(["שלום"], "fake.docx", { type: DOCX_MIME }), "אינו מסמך DOCX תקין"],
    [
      "an OLE container named .docx",
      () => new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])], "locked.docx", { type: DOCX_MIME }),
      "מוגן בסיסמה",
    ],
    ["an empty file", () => new File([], "empty.docx", { type: DOCX_MIME }), "ריק"],
  ])("rejects %s with a clear Hebrew message and keeps the current state", async (_name, make, message) => {
    render(<App />);
    await userEvent.click(screen.getByRole("textbox", { name: "טקסט לבדיקה" }));
    await userEvent.paste("טקסט קיים");
    await upload(make());
    expect(await screen.findByTestId("notice")).toHaveTextContent(message);
    expect(screen.getByTestId("notice")).not.toHaveTextContent(/Error|at |undefined/);
    expect(screen.getByRole("textbox", { name: "טקסט לבדיקה" })).toHaveValue("טקסט קיים");
  });

  it("removes the file and returns to the text editor", async () => {
    await uploadAndRun();
    await userEvent.click(screen.getByRole("button", { name: "הסרת הקובץ וחזרה לעריכת טקסט" }));
    expect(screen.getByRole("textbox", { name: "טקסט לבדיקה" })).toBeInTheDocument();
    expect(screen.queryByTestId("document-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("findings-empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ייצוא טקסט מתוקן" })).toBeInTheDocument();
  });

  it("starts from a clean review state when another file is loaded", async () => {
    await uploadAndRun();
    await userEvent.click(within(card("HEB-SPACE-001")).getByRole("button", { name: "קבלה" }));
    await upload(fixtureFile("tables"));
    await waitFor(() => expect(screen.getByTestId("document-preview")).toHaveTextContent("לפני הטבלה"));
    expect(screen.getByTestId("findings-empty")).toBeInTheDocument();
    expect(screen.getByTestId("count-total")).toHaveTextContent("0");
  });
});
