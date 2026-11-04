# Domain Model

## 1. Offset convention

All text ranges use half-open UTF-16 offsets:

```text
[start, end)
```

`start` is inclusive and `end` is exclusive. Therefore:

```ts
text.slice(start, end)
```

must equal the finding's `originalText` unless the finding explicitly represents a zero-length insertion.

## 2. Core types

```ts
export type RuleCategory =
  | "spacing"
  | "punctuation"
  | "typography"
  | "spelling"
  | "grammar"
  | "style"
  | "consistency";

export type IssueSeverity = "info" | "warning" | "error";
export type ReviewStatus = "open" | "accepted" | "rejected" | "ignored";

export interface TextRange {
  start: number;
  end: number;
}

export interface TextEdit {
  range: TextRange;
  replacement: string;
}
```

## 3. Source locations

```ts
export type SourceLocation =
  | PlainTextLocation
  | DocxLocation
  | PdfLocation;

export interface PlainTextLocation {
  kind: "plain-text";
  range: TextRange;
}

export interface DocxAnchor {
  paragraphIndex: number;
  runIndex: number;
  offsetInRun: number;
}

export interface DocxLocation {
  kind: "docx";
  start: DocxAnchor;
  end: DocxAnchor;
}

export interface PdfLocation {
  kind: "pdf";
  pageNumber: number;
  boundingBoxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}
```

`PdfLocation` is reserved for a later phase and need not be implemented in MVP 1.

## 4. Document model

```ts
export interface DocumentModel {
  id: string;
  sourceType: "plain-text" | "docx" | "pdf";
  text: string;
  segments: DocumentSegment[];
  metadata: DocumentMetadata;
}

export interface DocumentSegment {
  id: string;
  text: string;
  normalizedRange: TextRange;
  sourceLocation: SourceLocation;
}

export interface DocumentMetadata {
  fileName?: string;
  mimeType?: string;
  language: "he";
  createdAt: string;
}
```

## 5. Rule contract

```ts
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
```

Rules must not use random identifiers or current time. Finding identity must be deterministic.

## 6. Finding contract

```ts
export interface ProofreadingIssue {
  id: string;
  ruleId: string;
  category: RuleCategory;
  severity: IssueSeverity;

  message: string;
  explanation?: string;

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
```

For deterministic rules, `confidence` is always `1`. Do not create pseudo-probabilities.

## 7. Finding identity

Generate a stable ID from:

```text
ruleId + documentId + range.start + range.end + originalText + suggestion
```

Use a deterministic hash utility. Do not use `crypto.randomUUID()` for findings.

## 8. Finding invariants

The engine validates every result:

- `0 <= start <= end <= text.length`.
- Non-insertion issues normally have `start < end`.
- `originalText === text.slice(start, end)`.
- `fix.range` is valid.
- `autoFixable === true` only when a concrete, deterministic `fix` exists.
- `ruleId` matches the rule that emitted the finding.
- Messages are non-empty.

An invalid result is excluded and reported as a rule execution error in development logs.

## 9. Review state

```ts
export interface ReviewedIssue {
  issue: ProofreadingIssue;
  status: ReviewStatus;
}
```

Review status must not be stored inside the immutable engine result.
