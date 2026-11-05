import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentPreview } from "./DocumentPreview";

const TEXT = "שלום ,יוסף\nזהו  טקסט\n\nסוף";
const lines = () => Array.from(document.querySelectorAll(".preview__line"));

describe("DocumentPreview", () => {
  it("renders RTL Hebrew with one block per line, including empty lines", () => {
    render(<DocumentPreview text={TEXT} highlight={null} />);
    const surface = screen.getByTestId("document-preview");
    expect(surface).toHaveAttribute("dir", "rtl");
    expect(surface).toHaveAttribute("lang", "he");
    expect(surface).toHaveAccessibleName("תצוגת המסמך");
    expect(lines().map((l) => l.textContent?.replace("\u200B", ""))).toEqual(["שלום ,יוסף", "זהו  טקסט", "", "סוף"]);
    expect(screen.queryByTestId("highlight")).not.toBeInTheDocument();
  });

  it("is keyboard focusable and read-only (no editable controls)", () => {
    render(<DocumentPreview text={TEXT} highlight={null} />);
    expect(screen.getByTestId("document-preview")).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("highlights exactly the range within one line", () => {
    render(<DocumentPreview text={TEXT} highlight={{ start: 4, end: 5 }} />);
    const mark = screen.getByTestId("highlight");
    expect(mark.textContent).toBe(" ");
    expect(mark.closest("p")).toHaveAttribute("data-line", "1");
    expect(mark.closest("p")?.textContent).toBe("שלום ,יוסף");
  });

  it("highlights a range that spans lines in every line it touches, covering exactly the range", () => {
    render(<DocumentPreview text={TEXT} highlight={{ start: 8, end: 14 }} />);
    const marks = screen.getAllByTestId("highlight");
    expect(marks.map((m) => m.textContent)).toEqual(["סף", "זהו"]);
    expect(marks.map((m) => m.closest("p")?.getAttribute("data-line"))).toEqual(["1", "2"]);
  });

  it("renders an insertion point as an empty marker at the offset", () => {
    render(<DocumentPreview text={TEXT} highlight={{ start: 6, end: 6 }} />);
    const mark = screen.getByTestId("highlight");
    expect(mark.textContent).toBe("");
    expect(mark).toHaveClass("preview__mark--insertion");
    expect(mark.parentElement?.textContent).toBe("שלום ,יוסף");
  });

  it("puts an insertion at the end of a line in that line", () => {
    render(<DocumentPreview text={TEXT} highlight={{ start: 10, end: 10 }} />);
    expect(screen.getByTestId("highlight").closest("p")).toHaveAttribute("data-line", "1");
  });

  it("scrolls the highlight into view when the highlight changes", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<DocumentPreview text={TEXT} highlight={null} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    rerender(<DocumentPreview text={TEXT} highlight={{ start: 11, end: 13 }} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("renders text as text, never as HTML", () => {
    render(<DocumentPreview text={"<img src=x onerror=alert(1)>"} highlight={null} />);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByTestId("document-preview")).toHaveTextContent("<img src=x onerror=alert(1)>");
  });
});
