import { describe, expect, it } from "vitest";
import { makeDocument } from "../../../tests/helpers/rules";
import { createIssue, CONTEXT_LENGTH } from "./createIssue";
import { stableHash, stableIssueId } from "./hash";

const rule = { id: "T-RULE", category: "spacing", defaultSeverity: "warning" } as const;
const base = { rule, message: "msg" };

describe("createIssue", () => {
  it("derives original text, context, location, severity and confidence", () => {
    const text = "x".repeat(30) + "אבג" + "y".repeat(30);
    const issue = createIssue({ ...base, document: makeDocument(text), range: { start: 30, end: 33 } });
    expect(issue.originalText).toBe("אבג");
    expect(issue.contextBefore).toBe("x".repeat(CONTEXT_LENGTH));
    expect(issue.contextAfter).toBe("y".repeat(CONTEXT_LENGTH));
    expect(issue.sourceLocation).toEqual({ kind: "plain-text", range: { start: 30, end: 33 } });
    expect(issue.severity).toBe("warning");
    expect(issue.confidence).toBe(1);
    expect(issue.autoFixable).toBe(false);
    expect(issue.ruleId).toBe("T-RULE");
    expect(issue.category).toBe("spacing");
  });

  it("bounds context at the text edges", () => {
    const issue = createIssue({ ...base, document: makeDocument("אבג"), range: { start: 1, end: 2 } });
    expect(issue.contextBefore).toBe("א");
    expect(issue.contextAfter).toBe("ג");
  });

  it("allows severity override and tags", () => {
    const issue = createIssue({
      ...base,
      document: makeDocument("אבג"),
      range: { start: 0, end: 1 },
      severity: "error",
      tags: ["a"],
    });
    expect(issue.severity).toBe("error");
    expect(issue.tags).toEqual(["a"]);
  });

  it.each([
    ["start beyond end", { start: 2, end: 1 }],
    ["negative start", { start: -1, end: 1 }],
    ["end beyond text", { start: 0, end: 4 }],
    ["fractional", { start: 0.5, end: 1 }],
  ])("rejects invalid range: %s", (_name, range) => {
    expect(() => createIssue({ ...base, document: makeDocument("אבג"), range })).toThrow();
  });

  it("rejects empty messages, autoFixable without fix, bad fix ranges and bare insertions", () => {
    const document = makeDocument("אבג");
    const range = { start: 0, end: 1 };
    expect(() => createIssue({ rule, document, range, message: " " })).toThrow();
    expect(() => createIssue({ ...base, document, range, autoFixable: true })).toThrow();
    expect(() =>
      createIssue({ ...base, document, range, fix: { range: { start: 0, end: 9 }, replacement: "" } }),
    ).toThrow();
    expect(() => createIssue({ ...base, document, range: { start: 1, end: 1 } })).toThrow();
  });

  it("produces stable, deterministic ids", () => {
    const make = (documentId: string, start = 0) =>
      createIssue({ ...base, document: makeDocument("אבג אבג", documentId), range: { start, end: start + 3 } });
    expect(make("d1").id).toBe(make("d1").id);
    expect(make("d1").id).not.toBe(make("d2").id);
    expect(make("d1", 0).id).not.toBe(make("d1", 4).id);
    expect(make("d1").id.startsWith("T-RULE:")).toBe(true);
  });

  it("id depends on rule, range, original text and suggestion", () => {
    const parts = { ruleId: "R", documentId: "d", start: 0, end: 1, originalText: "a", suggestion: "b" };
    const id = stableIssueId(parts);
    expect(stableIssueId({ ...parts })).toBe(id);
    expect(stableIssueId({ ...parts, ruleId: "S" })).not.toBe(id);
    expect(stableIssueId({ ...parts, end: 2 })).not.toBe(id);
    expect(stableIssueId({ ...parts, originalText: "c" })).not.toBe(id);
    expect(stableIssueId({ ...parts, suggestion: undefined })).not.toBe(id);
  });
});

describe("stableHash", () => {
  it("is deterministic and well distributed over small inputs", () => {
    expect(stableHash("שלום")).toBe(stableHash("שלום"));
    expect(stableHash("a")).not.toBe(stableHash("b"));
    const hashes = new Set(Array.from({ length: 5000 }, (_, i) => stableHash(`k${i}`)));
    expect(hashes.size).toBe(5000);
    expect(stableHash("")).toMatch(/^[0-9a-f]{14}$/);
  });
});
