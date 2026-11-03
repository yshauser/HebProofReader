/** 1-based line and column of a UTF-16 offset. */
export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  return { line, column: offset - (before.lastIndexOf("\n") + 1) + 1 };
}

/** Makes invisible/line-break characters visible for display in one line. */
export function visibleText(value: string): string {
  return value
    .replace(/\n/gu, "↵")
    .replace(/\t/gu, "⇥")
    .replace(/ /gu, "·")
    .replace(/[\u00A0\u200B\u2060\uFEFF]/gu, (ch) => `⟦U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}⟧`);
}
