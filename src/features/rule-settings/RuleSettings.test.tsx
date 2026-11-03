import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { initialRules } from "../../proofreading/rules";
import { RuleSettings } from "./RuleSettings";

const allEnabled = Object.fromEntries(initialRules.map((rule) => [rule.id, true]));

function setup(enabled: Record<string, boolean> = allEnabled) {
  const onToggleRule = vi.fn();
  const onToggleCategory = vi.fn();
  render(<RuleSettings rules={initialRules} enabled={enabled} onToggleRule={onToggleRule} onToggleCategory={onToggleCategory} />);
  return { onToggleRule, onToggleCategory };
}

describe("RuleSettings", () => {
  it("lists every rule with its stable id and shows the active count", () => {
    setup();
    for (const rule of initialRules) {
      expect(screen.getByRole("checkbox", { name: `${rule.id} ${rule.name}` })).toBeChecked();
    }
    expect(screen.getByText(/12\/12 פעילים/)).toBeInTheDocument();
  });

  it("toggles an individual rule", async () => {
    const { onToggleRule } = setup();
    await userEvent.click(screen.getByRole("checkbox", { name: /HEB-SPACE-001/ }));
    expect(onToggleRule).toHaveBeenCalledWith("HEB-SPACE-001");
  });

  it("toggles a whole category", async () => {
    const { onToggleCategory } = setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "קטגוריית רווחים" }));
    expect(onToggleCategory).toHaveBeenCalledWith("spacing", false);
  });

  it("shows unchecked and indeterminate category states", () => {
    setup({ ...allEnabled, "HEB-SPACE-001": false });
    const spacing = screen.getByRole("checkbox", { name: "קטגוריית רווחים" });
    expect(spacing).not.toBeChecked();
    expect(spacing).toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: /HEB-SPACE-001/ })).not.toBeChecked();
  });
});
