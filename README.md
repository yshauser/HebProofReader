# מגיהה עברית — Hebrew Proofreader (MVP 1)

A local, deterministic, rule-based Hebrew proofreading web app. Text is analysed entirely in the browser: nothing is sent over the network, stored, or logged. No LLM or external API is used.

## Setup

```bash
npm ci
npx playwright install chromium   # once, for e2e
npm run dev                       # http://localhost:5173
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm run lint` | ESLint |
| `npm run test -- --run` | Vitest unit and component tests |
| `npm run test:e2e` | Playwright smoke test |

## Architecture

```text
src/
  domain/        framework-free types: document, proofreading, review
  adapters/      plain-text adapter (DOCX/PDF slots reserved)
  proofreading/  engine (createIssue, run, overlaps, fixes), registry, tokenizer, normalization, rules/
  features/      UI: text-editor, findings-panel, rule-settings, export-results, proofreading-run (session hook)
  app/           App composition
tests/           fixtures (tests/fixtures/text), helpers, integration tests
e2e/             Playwright
```

- `domain/` and `proofreading/` do not import React or DOM APIs. UI components contain no proofreading logic; the session hook only calls the engine.
- All ranges are half-open UTF-16 `[start, end)`. Zero-length ranges are insertion points and require a suggestion.
- Issues are built only through `createIssue` (validates range, derives `originalText` and context, maps source location, builds a deterministic ID `ruleId:hash(rule, document, range, text, suggestion)`).
- The engine isolates rule exceptions, validates every issue against invariants, deduplicates by ID, sorts by (start, end, severity, rule ID), and reports overlaps. Error records never contain document text.
- Fixes are applied from the highest offset to the lowest; overlapping edits are rejected. In the UI, every fix reruns the engine. Review state (open/accepted/rejected/ignored) lives outside the engine result.
- Results are tied to the text they were computed from: editing the text hides stale findings until the next run.

## Implemented rules

| ID | Detects | Range | Auto-fix |
| --- | --- | --- | --- |
| HEB-SPACE-001 | 2+ spaces/tabs (option `allowLeadingIndentation`) | whole run | yes |
| HEB-SPACE-002 | whitespace before comma | whitespace | yes |
| HEB-SPACE-003 | missing space after comma (skips `1,000`, URLs, e-mail) | insertion point | yes |
| HEB-SPACE-004 | whitespace before `. ? ! : ;` (skips `.env`, `:D`, indentation) | whitespace | yes |
| HEB-SPACE-005 | missing space after `. ? ! : ;` (skips URLs, abbreviations, decimals, ellipsis, emoticons) | insertion point | no (heuristic exclusions) |
| HEB-SPACE-006 | whitespace inside `( )` | whitespace | yes |
| HEB-PUNC-001 | repeated commas | whole sequence | yes |
| HEB-PUNC-002 | repeated `?`/`!` (options for limits) | whole run | no |
| HEB-PUNC-003 | unbalanced `( )` (skips `1)` enumerators and `:)`) | the bracket | no |
| HEB-PUNC-004 | unbalanced `[ ]` | the bracket | no |
| HEB-CONS-002 | adjacent repeated word (niqqud ignored, Latin case-folded, same line) | whole run | no |
| HEB-TYPO-003 | NBSP, special spaces, zero-width chars (names the code point) | the character | zero-width only (spaces via option `autoFixSpaces`) |

Niqqud is never removed from text; it is ignored only when comparing words in HEB-CONS-002. LRM/RLM, ZWJ/ZWNJ and soft hyphen are intentionally not flagged.

## Privacy

No network calls for document content, no `localStorage`, no analytics, no `dangerouslySetInnerHTML`. Exports are generated locally as new files (`corrected-text.txt` = current editor text, `findings-report.json`, which omits the full document text).

## Known limitations

- Engine runs synchronously on the main thread (100k characters checks in well under a second in tests); no Web Worker, so no loading state is needed yet.
- Rule options exist in code but have no UI; no style profiles or terminology groups yet.
- Not implemented from the catalog: HEB-PUNC-005, HEB-TYPO-001/002, HEB-CONS-001/003.
- HEB-SPACE-005 heuristics (single-letter abbreviations, Latin pairs) can miss real errors by design.
- Highlighting uses a mirror layer behind the textarea; very unusual fonts/zoom could misalign it slightly.
- `npm audit` reports a moderate dev-only advisory (minimatch via ESLint); not shipped to users.
- No DOCX, PDF, OCR, backend, or AI features (out of scope).

## Next steps

Phase 5: DOCX research spike (paragraph/run anchors, comment insertion), then rule options UI and style profiles, then the remaining catalog rules.
