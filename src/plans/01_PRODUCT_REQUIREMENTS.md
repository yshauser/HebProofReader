# Product Requirements

## 1. Primary user

A Hebrew-speaking user who wants to inspect a text or document for deterministic spelling, punctuation, spacing, typography, and consistency issues.

## 2. Main user workflow

1. Open the application.
2. Paste Hebrew text or upload a supported document.
3. Select which rule groups are enabled.
4. Start proofreading.
5. Review findings in document order.
6. Click a finding to focus and highlight its exact location.
7. Accept a safe suggestion, reject it, or mark it as ignored.
8. Export corrected text, a findings report, or later a copied DOCX containing comments.

## 3. Functional requirements

### FR-001 — Text input

The user can enter or paste Unicode Hebrew text into an RTL editor.

### FR-002 — Run proofreading

The user can run all enabled deterministic rules over the current text.

### FR-003 — Findings list

Every finding displays:

- Rule name and identifier.
- Category.
- Severity.
- Explanation in Hebrew.
- Original text.
- Suggested replacement when available.
- Context around the finding.
- Position in the document.
- Whether automatic correction is allowed.

### FR-004 — Source highlighting

Selecting a finding highlights its exact range and scrolls the editor or document viewer to it.

### FR-005 — Finding states

A finding may be:

- Open.
- Accepted.
- Rejected.
- Ignored.

The state is review-session data and must not mutate the underlying rule result.

### FR-006 — Automatic correction

Only findings marked `autoFixable: true` can be applied automatically. Applying a correction must update the text and rerun the rules or safely recalculate all affected locations.

### FR-007 — Rule configuration

The user can enable or disable rules individually and by category.

### FR-008 — Results filtering

The user can filter by category, severity, rule, and review state.

### FR-009 — Export results

MVP 1 exports:

- Corrected plain text.
- JSON findings report.

MVP 2 exports:

- A new DOCX containing comments.

### FR-010 — DOCX upload

The application accepts `.docx` only, not legacy `.doc`, and validates file type and size.

### FR-011 — Source preservation

The original source file is immutable. Every generated document receives a new filename.

### FR-012 — Stable ordering

Findings are ordered first by source location, then by severity, then by rule ID.

### FR-013 — Overlapping findings

The engine detects overlapping findings. The UI shows both, but automatic correction must not apply conflicting fixes in a single operation without resolution.

### FR-014 — Error handling

Parser failures, unsupported files, invalid encoding, and rule failures produce clear Hebrew messages without exposing stack traces to the user.

## 4. Non-functional requirements

### NFR-001 — RTL accessibility

The UI uses `dir="rtl"`, semantic controls, visible focus indicators, accessible labels, and keyboard navigation.

### NFR-002 — Performance

For MVP 1, a text of 100,000 characters should be checked without freezing the UI. If necessary, the engine runs in a Web Worker.

### NFR-003 — Reliability

One failing rule must not crash the complete run. The engine records the failure and continues with other rules.

### NFR-004 — Type safety

TypeScript strict mode is enabled. Avoid `any`; exceptions require a code comment explaining why.

### NFR-005 — Browser support

Support current stable versions of Chromium, Firefox, and Safari where practical.

### NFR-006 — Local-first behavior

MVP 1 text analysis runs locally in the browser.

## 5. MVP 1 acceptance criteria

- The application starts with `npm run dev`.
- Hebrew text is displayed and edited correctly in RTL.
- At least ten initial deterministic rules are implemented.
- Every rule has unit tests.
- Findings highlight the correct range.
- Filters and rule enable/disable controls work.
- Safe fixes can be applied without corrupting positions.
- JSON and corrected-text exports work.
- `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` pass.
- A Playwright smoke test covers the primary workflow.
