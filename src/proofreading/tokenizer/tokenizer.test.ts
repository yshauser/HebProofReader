import { describe, expect, it } from "vitest";
import { stripHebrewMarks } from "../normalization";
import { isHorizontalWhitespace, tokenize } from "./index";

describe("tokenize", () => {
  it("returns no tokens for empty text", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("classifies Hebrew, Latin, numbers, whitespace and punctuation", () => {
    const tokens = tokenize("שלום world 3.14, א!");
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ["word", "שלום"],
      ["whitespace", " "],
      ["word", "world"],
      ["whitespace", " "],
      ["number", "3.14"],
      ["punctuation", ","],
      ["whitespace", " "],
      ["word", "א"],
      ["punctuation", "!"],
    ]);
  });

  it("covers the whole text without gaps and with exact ranges", () => {
    const text = "שָׁלוֹם 😀 צה״ל\ndon't (x)";
    const tokens = tokenize(text);
    let cursor = 0;
    for (const token of tokens) {
      expect(token.range.start).toBe(cursor);
      expect(text.slice(token.range.start, token.range.end)).toBe(token.value);
      cursor = token.range.end;
    }
    expect(cursor).toBe(text.length);
  });

  it("keeps niqqud inside words and gershayim/apostrophes inside words", () => {
    expect(tokenize("שָׁלוֹם")).toHaveLength(1);
    expect(tokenize("צה״ל")).toHaveLength(1);
    expect(tokenize("don't")).toHaveLength(1);
  });

  it("splits words on maqaf", () => {
    expect(tokenize("בית־ספר").map((t) => t.kind)).toEqual(["word", "punctuation", "word"]);
  });

  it("keeps surrogate pairs whole", () => {
    const tokens = tokenize("😀");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.range).toEqual({ start: 0, end: 2 });
  });
});

describe("whitespace and normalization helpers", () => {
  it("distinguishes horizontal whitespace", () => {
    expect(isHorizontalWhitespace(" \t\u00A0")).toBe(true);
    expect(isHorizontalWhitespace(" \n")).toBe(false);
    expect(isHorizontalWhitespace("")).toBe(false);
  });

  it("strips niqqud without touching maqaf or letters", () => {
    expect(stripHebrewMarks("שָׁלוֹם")).toBe("שלום");
    expect(stripHebrewMarks("בית־ספר")).toBe("בית־ספר");
  });
});
