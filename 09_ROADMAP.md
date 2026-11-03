# Implementation Roadmap

## Phase 0 — Repository foundation

- Initialize React + Vite + TypeScript.
- Enable strict TypeScript.
- Configure ESLint, Vitest, React Testing Library, and Playwright.
- Add scripts for dev, typecheck, lint, test, test:e2e, and build.
- Set the HTML language and direction to Hebrew/RTL.
- Add CI.

**Exit:** Empty application builds and all quality checks pass.

## Phase 1 — Domain and engine

- Implement domain types.
- Implement plain-text document adapter.
- Implement range/source mapping helpers.
- Implement issue builder and stable IDs.
- Implement rule registry.
- Implement execution isolation, validation, sorting, deduplication, and overlap detection.
- Add engine unit tests.

**Exit:** Engine can run mock rules deterministically on plain text.

## Phase 2 — First rules

Implement and test at least:

- HEB-SPACE-001 through HEB-SPACE-006.
- HEB-PUNC-001 through HEB-PUNC-004.
- HEB-CONS-002.
- HEB-TYPO-003.

**Exit:** Rule suite has strong positive, negative, range, exclusion, and mixed-language tests.

## Phase 3 — MVP user interface

- RTL editor.
- Run action.
- Findings panel.
- Finding selection and source highlighting.
- Filters.
- Rule settings.
- Review states.
- Safe fix application.
- Empty, loading, and error states.

**Exit:** Primary text workflow works end to end.

## Phase 4 — Export and hardening

- Corrected plain-text export.
- JSON findings report.
- Performance test with large text.
- Optional Web Worker if necessary.
- Accessibility review.
- Playwright smoke test.

**Exit:** MVP 1 release candidate.

## Phase 5 — DOCX research spike

Before production implementation, build a disposable spike to answer:

- Can paragraphs and runs be parsed with stable anchors?
- Can comments be inserted across one and multiple runs?
- Which formatting and structures are preserved?
- How are existing comments handled?
- What limitations must the UI disclose?

Do not merge experimental shortcuts into the engine.

## Phase 6 — DOCX MVP

- DOCX upload and validation.
- Parse into `DocumentModel`.
- Map normalized ranges to DOCX locations.
- Document preview adequate for navigation.
- Comment exporter.
- Round-trip fixtures and regression tests.
- New-file download.

**Exit:** Supported DOCX fixtures retain structure and receive comments at correct locations.

## Phase 7 — Advanced deterministic capabilities

- Terminology profiles.
- Organization dictionary.
- User-configurable rule options.
- Import/export rule profiles.
- Better tokenizer and spelling resources.

## Phase 8 — PDF

- Text-based PDF parsing.
- Page/span mapping.
- Viewer highlighting.
- Annotation export where feasible.
- OCR treated as a separate project increment.

## Phase 9 — Optional AI checker

Only after deterministic behavior is mature:

- Add an optional checker behind the same issue contract.
- Clearly label AI findings.
- Add privacy controls and explicit consent.
- Benchmark Hebrew quality on a curated corpus.
- Never allow uncertain AI findings to auto-fix by default.
