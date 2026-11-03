import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProofreadingRule } from "../domain/proofreading";
import { findingsReportSchema } from "../features/export-results/exporters";
import { createRuleRegistry } from "../proofreading/registry/registry";
import { space001 } from "../proofreading/rules/spacing/space001";
import { App } from "./App";

const SAMPLE = "שלום ,יוסף  טוב";

async function enterText(text: string) {
  await userEvent.click(screen.getByRole("textbox", { name: "טקסט לבדיקה" }));
  await userEvent.paste(text);
}

async function enterAndRun(text = SAMPLE) {
  await enterText(text);
  await userEvent.click(screen.getByRole("button", { name: "בדיקה" }));
}

const cards = () => screen.getAllByTestId("finding");
const card = (ruleId: string) => {
  const found = cards().find((c) => c.getAttribute("data-rule-id") === ruleId);
  if (!found) throw new Error(`no finding for ${ruleId}`);
  return found;
};
const count = (key: string) => screen.getByTestId(`count-${key}`).textContent;
const textarea = () => screen.getByRole("textbox", { name: "טקסט לבדיקה" });

describe("App", () => {
  it("is RTL Hebrew with empty states before running", () => {
    const { container } = render(<App />);
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(container.firstElementChild).toHaveAttribute("lang", "he");
    expect(screen.getByRole("button", { name: "בדיקה" })).toBeDisabled();
    expect(screen.getByTestId("findings-empty")).toHaveTextContent("עדיין לא הורצה בדיקה");
    expect(count("total")).toBe("0");
  });

  it("lists findings in document order with rule, category, severity, explanation, original and suggestion", async () => {
    render(<App />);
    await enterAndRun();
    expect(cards().map((c) => c.getAttribute("data-rule-id"))).toEqual(["HEB-SPACE-002", "HEB-SPACE-003", "HEB-SPACE-001"]);
    const first = card("HEB-SPACE-002");
    expect(first).toHaveTextContent("HEB-SPACE-002");
    expect(first).toHaveTextContent("רווחים");
    expect(first).toHaveTextContent("אזהרה");
    expect(first).toHaveTextContent("אין להשאיר רווח");
    expect(first).toHaveTextContent("הצעה: (הסרה)");
    expect(first).toHaveTextContent("שורה 1, עמודה 5");
    expect(count("total")).toBe("3");
    expect(count("open")).toBe("3");
    expect(screen.getByTestId("notice")).toHaveTextContent("נמצאו 3 ממצאים.");
  });

  it("highlights the exact range of the selected finding", async () => {
    render(<App />);
    await enterAndRun();
    await userEvent.click(within(card("HEB-SPACE-001")).getByRole("button", { name: /HEB-SPACE-001/ }));
    expect(screen.getByTestId("highlight").textContent).toBe("  ");
    await userEvent.click(within(card("HEB-SPACE-003")).getByRole("button", { name: /HEB-SPACE-003/ }));
    expect(screen.getByTestId("highlight")).toBeEmptyDOMElement();
    expect(screen.getByTestId("highlight").className).toContain("insertion");
    await userEvent.click(within(card("HEB-SPACE-002")).getByRole("button", { name: /HEB-SPACE-002/ }));
    expect(screen.getByTestId("highlight").textContent).toBe(" ");
  });

  it("navigates with previous and next, wrapping around", async () => {
    render(<App />);
    await enterAndRun();
    await userEvent.click(screen.getByRole("button", { name: "הבא" }));
    expect(card("HEB-SPACE-002")).toHaveClass("finding--selected");
    await userEvent.click(screen.getByRole("button", { name: "הקודם" }));
    expect(card("HEB-SPACE-001")).toHaveClass("finding--selected");
    await userEvent.click(screen.getByRole("button", { name: "הבא" }));
    expect(card("HEB-SPACE-002")).toHaveClass("finding--selected");
  });

  it("supports accepted, rejected and ignored states without changing the finding", async () => {
    render(<App />);
    await enterAndRun();
    const first = card("HEB-SPACE-002");
    await userEvent.click(within(first).getByRole("button", { name: "קבלה" }));
    expect(count("accepted")).toBe("1");
    expect(count("open")).toBe("2");
    await userEvent.click(within(card("HEB-SPACE-003")).getByRole("button", { name: "דחייה" }));
    await userEvent.click(within(card("HEB-SPACE-001")).getByRole("button", { name: "השמטה" }));
    expect([count("accepted"), count("rejected"), count("ignored"), count("open")]).toEqual(["1", "1", "1", "0"]);
    expect(count("total")).toBe("3");
    await userEvent.click(within(card("HEB-SPACE-002")).getByRole("button", { name: "קבלה" }));
    expect(count("open")).toBe("1");
    expect(count("accepted")).toBe("0");
  });

  it("filters by category, severity, rule and review status", async () => {
    render(<App />);
    await enterAndRun(`${SAMPLE}??`);
    expect(cards()).toHaveLength(4);
    await userEvent.selectOptions(screen.getByLabelText("קטגוריה"), "punctuation");
    expect(cards().map((c) => c.getAttribute("data-rule-id"))).toEqual(["HEB-PUNC-002"]);
    await userEvent.selectOptions(screen.getByLabelText("קטגוריה"), "all");
    await userEvent.selectOptions(screen.getByLabelText("חוק"), "HEB-SPACE-001");
    expect(cards()).toHaveLength(1);
    await userEvent.selectOptions(screen.getByLabelText("חוק"), "all");
    await userEvent.selectOptions(screen.getByLabelText("חומרה"), "info");
    expect(cards().map((c) => c.getAttribute("data-rule-id"))).toEqual(["HEB-PUNC-002"]);
    await userEvent.selectOptions(screen.getByLabelText("חומרה"), "error");
    expect(screen.getByTestId("findings-empty")).toHaveTextContent("אין ממצאים התואמים");
    expect(count("total")).toBe("4");
    await userEvent.selectOptions(screen.getByLabelText("חומרה"), "all");
    await userEvent.click(within(card("HEB-SPACE-001")).getByRole("button", { name: "קבלה" }));
    await userEvent.selectOptions(screen.getByLabelText("מצב סקירה"), "accepted");
    expect(cards().map((c) => c.getAttribute("data-rule-id"))).toEqual(["HEB-SPACE-001"]);
  });

  it("disables rules individually and by category", async () => {
    render(<App />);
    await enterAndRun();
    await userEvent.click(screen.getByText(/הגדרות חוקים/));
    await userEvent.click(screen.getByRole("checkbox", { name: /HEB-SPACE-001/ }));
    expect(screen.getByText(/הגדרות החוקים השתנו/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "בדיקה" }));
    expect(cards().map((c) => c.getAttribute("data-rule-id"))).toEqual(["HEB-SPACE-002", "HEB-SPACE-003"]);
    const spacing = screen.getByRole("checkbox", { name: "קטגוריית רווחים" });
    await userEvent.click(spacing);
    expect(spacing).toBeChecked();
    await userEvent.click(spacing);
    expect(spacing).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "בדיקה" }));
    expect(screen.getByTestId("findings-empty")).toHaveTextContent("לא נמצאו ממצאים");
  });

  it("applies a safe fix, reruns the engine and keeps offsets correct", async () => {
    render(<App />);
    await enterAndRun();
    await userEvent.click(within(card("HEB-SPACE-001")).getByRole("button", { name: "החלת תיקון" }));
    expect(textarea()).toHaveValue("שלום ,יוסף טוב");
    expect(cards().map((c) => c.getAttribute("data-rule-id"))).toEqual(["HEB-SPACE-002", "HEB-SPACE-003"]);
    await userEvent.click(within(card("HEB-SPACE-003")).getByRole("button", { name: /HEB-SPACE-003/ }));
    expect(screen.getByTestId("highlight").parentElement?.textContent).toBe("שלום ,יוסף טוב");
  });

  it("applies all safe fixes at once", async () => {
    render(<App />);
    await enterAndRun();
    await userEvent.click(screen.getByRole("button", { name: "החלת כל התיקונים הבטוחים" }));
    expect(textarea()).toHaveValue("שלום, יוסף טוב");
    expect(screen.getByTestId("findings-empty")).toHaveTextContent("לא נמצאו ממצאים");
  });

  it("exposes no fix for suggestion-only findings", async () => {
    render(<App />);
    await enterAndRun("מה??");
    expect(within(card("HEB-PUNC-002")).queryByRole("button", { name: "החלת תיקון" })).toBeNull();
    expect(card("HEB-PUNC-002")).toHaveTextContent("ללא תיקון אוטומטי");
    expect(screen.getByRole("button", { name: "החלת כל התיקונים הבטוחים" })).toBeDisabled();
  });

  it("hides stale findings after the text changes", async () => {
    render(<App />);
    await enterAndRun();
    await userEvent.type(textarea(), "x");
    expect(screen.getByTestId("findings-empty")).toHaveTextContent("הטקסט השתנה");
    expect(count("total")).toBe("0");
    expect(screen.queryByTestId("highlight")).toBeNull();
  });

  it("reports a failing rule and still shows other results", async () => {
    const broken: ProofreadingRule = {
      ...space001,
      id: "HEB-BROKEN-001",
      check: () => {
        throw new Error("boom");
      },
    };
    render(<App registry={createRuleRegistry([broken, space001])} />);
    await enterAndRun("א  ב");
    expect(screen.getByTestId("notice")).toHaveTextContent("HEB-BROKEN-001");
    expect(screen.getByTestId("notice")).not.toHaveTextContent("boom");
    expect(cards()).toHaveLength(1);
  });

  describe("export", () => {
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

    it("exports corrected text and a valid JSON report as new files", async () => {
      render(<App />);
      expect(screen.getByRole("button", { name: "ייצוא דוח JSON" })).toBeDisabled();
      await enterAndRun();
      await userEvent.click(within(card("HEB-SPACE-002")).getByRole("button", { name: "דחייה" }));
      await userEvent.click(screen.getByRole("button", { name: "ייצוא טקסט מתוקן" }));
      await userEvent.click(screen.getByRole("button", { name: "ייצוא דוח JSON" }));
      expect(downloads).toEqual(["corrected-text.txt", "findings-report.json"]);
      expect(await created[0]?.text()).toBe(SAMPLE);
      const report = findingsReportSchema.parse(JSON.parse((await created[1]?.text()) ?? ""));
      expect(report.counts).toEqual({ total: 3, open: 2, accepted: 0, rejected: 1, ignored: 0 });
      expect(report.issues[0]).toMatchObject({ ruleId: "HEB-SPACE-002", status: "rejected", range: { start: 4, end: 5 } });
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });
});
