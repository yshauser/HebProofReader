# Hebrew Proofreader — Project Definition

## 1. Purpose

Build a Hebrew proofreading application that accepts a document, runs a deterministic set of proofreading rules, presents every finding with an exact location and explanation, and lets the user export a new document containing comments at the relevant locations.

The first version must **not depend on an LLM for proofreading**. The proofreading engine is rule-based, deterministic, explainable, and fully testable.

## 2. Product vision

The system should eventually support:

- Plain Hebrew text.
- Microsoft Word `.docx` documents.
- Text-based PDF documents.
- Scanned PDFs through OCR as a later, separate capability.
- Review, accept, reject, and filter workflows.
- Adding findings as comments to a copy of the source document.
- Optional AI-based checkers in a future version, without changing the core issue model.

## 3. MVP scope

### MVP 1 — Proofreading engine and text workspace

- Paste or type Hebrew text.
- Run deterministic proofreading rules.
- Display findings in a list.
- Highlight the relevant text range.
- Navigate between findings.
- Enable or disable individual rules.
- Accept, reject, or ignore findings in the UI.
- Apply safe automatic corrections to text.
- Export a findings report as JSON.

### MVP 2 — DOCX support

- Upload a `.docx` file.
- Extract text while preserving a mapping to paragraphs and runs.
- Run the same proofreading engine.
- Show findings in document order.
- Create a new `.docx` containing comments at the correct locations.
- Never overwrite the original file.

### Later versions

- Text-based PDF parsing and visual highlighting.
- PDF annotations.
- OCR for scanned documents.
- User-created rules.
- Organization dictionaries and terminology profiles.
- Optional LLM-based grammar and style checking.

## 4. Explicitly out of scope for the first MVP

- LLM-based proofreading.
- OCR.
- Perfect preservation of every complex Word feature.
- PDF editing.
- Multi-user collaboration.
- Billing and subscription management.
- Automatic replacement of uncertain findings.

## 5. Technology baseline

- Development environment: Devin Desktop.
- Repository: GitHub.
- Frontend: React, Vite, TypeScript.
- Styling: CSS Modules or a small, consistent styling solution. Do not introduce a large UI framework unless justified.
- Unit tests: Vitest.
- Component tests: React Testing Library.
- End-to-end tests: Playwright.
- Runtime validation: Zod.
- Package manager: npm, unless the repository is initialized with pnpm.
- Backend for MVP 1: none required.
- Backend for document processing: Node.js + TypeScript when needed.

## 6. Core principles

1. **Deterministic:** identical input and configuration produce identical findings.
2. **Explainable:** every finding identifies the rule and reason.
3. **Location-aware:** every finding maps to an exact source range.
4. **Non-destructive:** source documents are never overwritten.
5. **Test-first for rules:** every rule has positive, negative, boundary, and Hebrew/RTL test cases.
6. **Modular:** document parsing, proofreading, UI, and export are separate layers.
7. **Minimal changes:** avoid broad refactoring unrelated to the requested task.
8. **Privacy-conscious:** document content is processed locally where possible and is never sent externally without an explicit feature and user consent.
9. **Hebrew-first UX:** the application is RTL by default and handles Hebrew Unicode correctly.
10. **Extensible:** future checkers, including AI checkers, return the same `ProofreadingIssue` contract.

## 7. Documentation map

- `01_PRODUCT_REQUIREMENTS.md` — users, workflows, and acceptance criteria.
- `02_ARCHITECTURE.md` — layers, packages, and data flow.
- `03_DOMAIN_MODEL.md` — TypeScript contracts and location model.
- `04_PROJECT_RULES.md` — mandatory engineering constraints.
- `05_HEBREW_PROOFREADING_RULES.md` — initial proofreading rule catalog.
- `06_RULE_AUTHORING_GUIDE.md` — how to implement and test a rule.
- `07_TESTING_STRATEGY.md` — test levels, fixtures, and quality gates.
- `08_SECURITY_AND_PRIVACY.md` — upload and document-safety requirements.
- `09_ROADMAP.md` — phased implementation plan.
- `10_DEVIN_DESKTOP_PROMPT.md` — prompt for generating the application.
