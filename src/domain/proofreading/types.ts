import type { DocumentModel, SourceLocation, TextRange } from "../document/types";

export type RuleCategory =
  | "spacing"
  | "punctuation"
  | "typography"
  | "spelling"
  | "grammar"
  | "style"
  | "consistency";

export type IssueSeverity = "info" | "warning" | "error";

export interface TextEdit {
  range: TextRange;
  replacement: string;
}

export interface RuleContext {
  document: DocumentModel;
  text: string;
  options: Readonly<Record<string, unknown>>;
  signal?: AbortSignal;
}

export interface ProofreadingRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: RuleCategory;
  readonly defaultSeverity: IssueSeverity;
  readonly enabledByDefault: boolean;

  check(context: RuleContext): readonly ProofreadingIssue[];
}

export interface ProofreadingIssue {
  id: string;
  ruleId: string;
  category: RuleCategory;
  severity: IssueSeverity;

  message: string;
  explanation?: string;

  /** Half-open UTF-16 range [start, end). Zero-length means insertion point. */
  range: TextRange;
  sourceLocation: SourceLocation;

  originalText: string;
  contextBefore: string;
  contextAfter: string;

  suggestion?: string;
  fix?: TextEdit;
  autoFixable: boolean;
  confidence: 1;

  tags?: readonly string[];
}

export interface RuleExecutionError {
  ruleId: string;
  kind: "exception" | "invalid-issue";
  /** Never contains document text. */
  message: string;
}

export interface IssueOverlap {
  firstId: string;
  secondId: string;
}

export interface ProofreadingResult {
  documentId: string;
  issues: readonly ProofreadingIssue[];
  overlaps: readonly IssueOverlap[];
  errors: readonly RuleExecutionError[];
  executedRuleIds: readonly string[];
}
