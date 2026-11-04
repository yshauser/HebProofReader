# Prompt for Devin Desktop

Copy the prompt below into Devin Desktop from the parent directory where the new repository should be created.

---

You are the lead implementation agent for a new Hebrew proofreading application.

Create the application from scratch according to all Markdown specification files supplied with this task. Treat the files as normative requirements, especially:

- `00_README.md`
- `01_PRODUCT_REQUIREMENTS.md`
- `02_ARCHITECTURE.md`
- `03_DOMAIN_MODEL.md`
- `04_PROJECT_RULES.md`
- `05_HEBREW_PROOFREADING_RULES.md`
- `06_RULE_AUTHORING_GUIDE.md`
- `07_TESTING_STRATEGY.md`
- `08_SECURITY_AND_PRIVACY.md`
- `09_ROADMAP.md`

## Goal for this task

Implement **MVP 1 only**: a local, deterministic, rule-based Hebrew proofreading web application. Do not implement DOCX, PDF, OCR, backend services, authentication, databases, telemetry, or LLM integration in this task.

## Required stack

- React
- Vite
- TypeScript in strict mode
- Vitest
- React Testing Library
- Playwright
- Zod for external/runtime schemas where useful
- GitHub Actions CI
- npm, unless an existing repository lockfile dictates otherwise

## Mandatory behavior

1. The application is Hebrew-first and RTL.
2. The user can paste or type text.
3. The user can run enabled deterministic rules.
4. Findings appear in document order with rule ID, category, severity, explanation, original text, and suggestion.
5. Selecting a finding highlights the exact source range and brings it into view.
6. The user can filter findings and enable or disable rules.
7. The user can mark findings accepted, rejected, or ignored.
8. Only safe findings expose an automatic fix.
9. Applying a fix preserves correct offsets by rerunning the engine.
10. The user can export corrected plain text and a JSON findings report.
11. No document text is sent over the network or persisted by default.
12. No LLM or external proofreading API is used.

## Initial rules

Implement the initial high-confidence rules defined in `05_HEBREW_PROOFREADING_RULES.md`, with at least:

- HEB-SPACE-001
- HEB-SPACE-002
- HEB-SPACE-003
- HEB-SPACE-004
- HEB-SPACE-005
- HEB-SPACE-006
- HEB-PUNC-001
- HEB-PUNC-002
- HEB-PUNC-003
- HEB-PUNC-004
- HEB-CONS-002
- HEB-TYPO-003

If a rule has unresolved ambiguity, implement the conservative behavior described in the specification and do not make it auto-fixable.

## Architecture requirements

- Keep domain and engine code independent of React.
- Do not put proofreading logic in UI components.
- Use half-open UTF-16 ranges `[start, end)` consistently.
- Build findings through a shared validated issue factory.
- Generate stable deterministic finding IDs. Do not use random UUIDs.
- Isolate rule failures so one failed rule does not stop the run.
- Validate, deduplicate, sort, and identify overlaps centrally in the engine.
- Use a rule registry rather than a monolithic checking function.
- Preserve clear module boundaries so DOCX/PDF adapters can be added later without changing rule contracts.

## UI expectations

Create a clean, practical engineering-oriented interface, not a marketing page.

Suggested layout:

- Header with application name and Run button.
- Main RTL text editor.
- Findings panel alongside it on wide screens and below it on mobile.
- Compact filter and rule-settings controls.
- Clear counts for total/open/accepted/rejected/ignored findings.
- Keyboard-accessible controls and visible focus states.
- Responsive down to mobile width.

Use Hebrew UI labels. Keep code identifiers and documentation in English.

## Testing requirements

- Unit tests for every rule.
- Exact range assertions, not only finding counts.
- Positive, negative, empty, boundary, newline, mixed Hebrew/English, and relevant niqqud cases.
- Unit tests for engine invariants, stable IDs, sorting, deduplication, overlaps, and fix application.
- Component tests for editor, finding selection, filters, rule settings, and review states.
- One Playwright smoke test for the primary workflow.
- Add representative non-sensitive fixtures.

## Implementation process

1. Read every Markdown file completely before changing or creating code.
2. Produce a concise implementation plan mapped to roadmap phases 0–4.
3. Inspect the directory and do not overwrite unrelated existing work.
4. Initialize the project if no project exists.
5. Implement in small, coherent steps.
6. After each major layer, run relevant tests.
7. Do not weaken lint, TypeScript, or tests to hide errors.
8. Do not add unrelated features or perform broad refactors.
9. Before finishing, run all required quality commands.
10. Inspect the final diff for accidental generated files, secrets, and unrelated changes.

## Required scripts

Ensure these commands exist and pass:

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run build
npm run test:e2e
```

## Deliverables

- Complete runnable source code.
- README with setup, scripts, architecture summary, implemented rules, known limitations, and next steps.
- Automated tests.
- GitHub Actions workflow.
- No secrets or API keys.
- A final report containing:
  - What was implemented.
  - Repository structure.
  - Rules implemented.
  - Commands executed and results.
  - Tests added.
  - Known limitations.
  - Recommended next task.

## Completion constraint

Do not claim that the application is complete unless all required commands pass. If an environmental limitation prevents a command from running, report the exact limitation, preserve the implementation, and provide the precise command that remains to be run. Do not replace verification with an assumption.

Begin by reading the specification files and presenting the implementation plan. Then implement the application without waiting for further confirmation unless a true blocking ambiguity prevents safe progress.

---
