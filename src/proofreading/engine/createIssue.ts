import { isValidRange, toSourceLocation } from "../../domain/document";
import type { DocumentModel, TextRange } from "../../domain/document";
import type { IssueSeverity, ProofreadingIssue, ProofreadingRule, TextEdit } from "../../domain/proofreading";
import { stableIssueId } from "./hash";

export const CONTEXT_LENGTH = 20;

export interface CreateIssueInput {
  rule: Pick<ProofreadingRule, "id" | "category" | "defaultSeverity">;
  document: DocumentModel;
  range: TextRange;
  message: string;
  explanation?: string;
  suggestion?: string;
  fix?: TextEdit;
  autoFixable?: boolean;
  severity?: IssueSeverity;
  tags?: readonly string[];
}

/**
 * Shared, validating issue factory. Throws on programming errors; the engine isolates
 * such failures per rule.
 */
export function createIssue(input: CreateIssueInput): ProofreadingIssue {
  const { rule, document, range, message, explanation, suggestion, fix, tags } = input;
  const text = document.text;
  const autoFixable = input.autoFixable ?? false;

  if (!isValidRange(range, text.length)) throw new RangeError(`${rule.id}: invalid range`);
  if (message.trim() === "") throw new Error(`${rule.id}: empty message`);
  if (fix && !isValidRange(fix.range, text.length)) throw new RangeError(`${rule.id}: invalid fix range`);
  if (autoFixable && !fix) throw new Error(`${rule.id}: autoFixable requires a fix`);
  if (range.start === range.end && !suggestion) {
    throw new Error(`${rule.id}: zero-length range requires a suggestion`);
  }

  const originalText = text.slice(range.start, range.end);
  const issue: ProofreadingIssue = {
    id: stableIssueId({
      ruleId: rule.id,
      documentId: document.id,
      start: range.start,
      end: range.end,
      originalText,
      suggestion,
    }),
    ruleId: rule.id,
    category: rule.category,
    severity: input.severity ?? rule.defaultSeverity,
    message,
    range: { start: range.start, end: range.end },
    sourceLocation: toSourceLocation(document, range),
    originalText,
    contextBefore: text.slice(Math.max(0, range.start - CONTEXT_LENGTH), range.start),
    contextAfter: text.slice(range.end, range.end + CONTEXT_LENGTH),
    autoFixable,
    confidence: 1,
  };
  if (explanation !== undefined) issue.explanation = explanation;
  if (suggestion !== undefined) issue.suggestion = suggestion;
  if (fix) issue.fix = { range: { ...fix.range }, replacement: fix.replacement };
  if (tags) issue.tags = Object.freeze([...tags]);
  return issue;
}
