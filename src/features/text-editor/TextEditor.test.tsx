import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TextEditor } from "./TextEditor";

describe("TextEditor", () => {
  it("is an accessible RTL Hebrew textarea", () => {
    render(<TextEditor value="" onChange={() => undefined} highlight={null} />);
    const textarea = screen.getByRole("textbox", { name: "טקסט לבדיקה" });
    expect(textarea).toHaveAttribute("dir", "rtl");
    expect(textarea).toHaveAttribute("lang", "he");
  });

  it("reports edits including Hebrew and mixed text", async () => {
    const onChange = vi.fn();
    render(<TextEditor value="" onChange={onChange} highlight={null} />);
    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.paste("שלום world 123");
    expect(onChange).toHaveBeenLastCalledWith("שלום world 123");
  });

  it("shows the value it is given", () => {
    render(<TextEditor value={"אבג\nדהו"} onChange={() => undefined} highlight={null} />);
    expect(screen.getByRole("textbox")).toHaveValue("אבג\nדהו");
  });

  it("renders no highlight without a range", () => {
    render(<TextEditor value="אבג" onChange={() => undefined} highlight={null} />);
    expect(screen.queryByTestId("highlight")).toBeNull();
  });

  it("highlights exactly the requested half-open range", () => {
    render(<TextEditor value="אבגדהוז" onChange={() => undefined} highlight={{ start: 2, end: 5 }} />);
    const mark = screen.getByTestId("highlight");
    expect(mark).toHaveTextContent("גדה");
    expect(mark.parentElement).toHaveTextContent("אבגדהוז");
    expect(mark.className).not.toContain("insertion");
  });

  it("renders a zero-length range as an insertion marker", () => {
    render(<TextEditor value="אבג" onChange={() => undefined} highlight={{ start: 1, end: 1 }} />);
    const mark = screen.getByTestId("highlight");
    expect(mark).toBeEmptyDOMElement();
    expect(mark.className).toContain("highlight--insertion");
  });

  it("never interprets text as HTML", () => {
    render(<TextEditor value="<b>x</b> אבג" onChange={() => undefined} highlight={{ start: 0, end: 3 }} />);
    expect(screen.getByTestId("highlight")).toHaveTextContent("<b>");
    expect(document.querySelector("b")).toBeNull();
  });
});
