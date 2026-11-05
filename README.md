# מגיה עברית — Hebrew Proofreader (MVP 1 + DOCX comments)

A local, deterministic, rule-based Hebrew proofreading web app. Text and uploaded `.docx` files are analysed entirely in the browser: nothing is sent over the network, stored, or logged. No LLM or external API is used.

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
| `npm run test:e2e` | Playwright tests (text workflow and DOCX workflow) |
| `npm run fixtures:docx` | Regenerates `tests/fixtures/docx/*.docx` from `tests/helpers/docxFixtures.ts` (Node 22.6+) |
| `npm run spike:docx` | Phase 5 research spike tests (disposable, superseded by `src/adapters/docx`) |

## Architecture

```text
src/
  domain/        framework-free types: document, proofreading, review
  adapters/      plain-text adapter; docx adapter (parse, comment writer, validation); PDF slot reserved
  proofreading/  engine (createIssue, run, overlaps, fixes), registry, tokenizer, normalization, rules/
  features/      UI: text-editor, document-preview, docx-import, findings-panel, rule-settings, export-results, proofreading-run (session hook)
  app/           App composition
tests/           fixtures (tests/fixtures/text, tests/fixtures/docx), helpers, integration tests
e2e/             Playwright
```

- `domain/` and `proofreading/` do not import React or DOM APIs. UI components contain no proofreading logic; the session hook only calls the engine.
- All ranges are half-open UTF-16 `[start, end)`. Zero-length ranges are insertion points and require a suggestion.
- Issues are built only through `createIssue` (validates range, derives `originalText` and context, maps source location, builds a deterministic ID `ruleId:hash(rule, document, range, text, suggestion)`).
- The engine isolates rule exceptions, validates every issue against invariants, deduplicates by ID, sorts by (start, end, severity, rule ID), and reports overlaps. Error records never contain document text.
- Fixes are applied from the highest offset to the lowest; overlapping edits are rejected. In the UI, every fix reruns the engine. Review state (open/accepted/rejected/ignored) lives outside the engine result.
- Results are tied to the text they were computed from: editing the text hides stale findings until the next run.

## DOCX support

Upload a `.docx` (button in the header). The file is parsed locally into a `DocumentModel`, checked with the same rules, and exported as a **new** `<name>.commented.docx` with one Word comment per finding. The uploaded file and its bytes are never modified or overwritten.

- **Adapter** (`src/adapters/docx`, loaded on demand so ZIP/XML code is not in the initial bundle): `parseDocx` (validation, indexing, warnings), `addCommentsToDocx` (comment writer), `validateUploadInfo`, `commentedFileName`. Domain/engine code never imports a DOCX library; `toSourceLocation` maps ranges to `DocxLocation` from the model's segments alone.
- **Text model**: paragraph texts (body, table cells, block content controls; runs in hyperlinks, tracked insertions and inline content controls) joined by `\n`; `w:tab`/`w:br` become `\t`/`\n`. Offsets are UTF-16 as everywhere else. One segment per text run carries `{paragraphIndex, runIndex, offsetInRun}`; `runIndex: -1` is a paragraph without text.
- **Comments**: anchors are resolved against the original package before any edit and a comment is written only if the anchored text still equals the finding's `originalText`; otherwise it is skipped and counted (never placed by text search). Runs are split at the boundaries keeping `w:rPr` and attributes. Existing comments are kept (new ids start after the highest id; the comments part is found through the relationships). All other package parts are copied unchanged; `document.xml` is re-serialized.
- **What is exported**: findings that are open or accepted; rejected and ignored findings get no comment. Fixes are never applied to DOCX (the findings panel hides fix actions). The JSON report adds `sourceType` and a per-finding `sourceLocation`.
- **Preview**: read-only RTL view of the extracted text; selecting a finding highlights its exact range (across lines too) and scrolls it into view. Findings show their paragraph number.
- **Validation and safety** (untrusted input): `.docx` extension and MIME allow-list, content signature (ZIP; OLE/legacy `.doc`/encrypted rejected), 10 MiB file limit, 2,000 ZIP entries, 50 MiB per read part with streaming abort (decompression bombs), macro-enabled/template packages rejected, DOCTYPE/ENTITY rejected before XML parsing, strict UTF-8, parser diagnostics never printed. Errors are typed codes mapped to Hebrew messages; nothing is logged.
- **Warnings shown to the user**: tracked changes (checked as if all accepted; deleted text not checked), simple fields, text boxes and embedded chunks (not checked), headers/footers/footnotes/endnotes (not read), existing comments (preserved).

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

No network calls for document content, no `localStorage`, no analytics, no `dangerouslySetInnerHTML`. Exports are generated locally as new files (`corrected-text.txt` = current editor text, `findings-report.json`, which omits the full document text, and `<name>.commented.docx`). The uploaded DOCX is held in memory for the active session only and released when removed or replaced; object URLs are revoked right after the download starts.

## Known limitations

- Engine runs synchronously on the main thread (100k characters checks in well under a second in tests); no Web Worker, so no loading state is needed yet.
- Rule options exist in code but have no UI; no style profiles or terminology groups yet.
- Not implemented from the catalog: HEB-PUNC-005, HEB-TYPO-001/002, HEB-CONS-001/003.
- HEB-SPACE-005 heuristics (single-letter abbreviations, Latin pairs) can miss real errors by design.
- Highlighting uses a mirror layer behind the textarea; very unusual fonts/zoom could misalign it slightly.
- `npm audit` reports a moderate dev-only advisory (minimatch via ESLint); not shipped to users.
- DOCX: not verified in Microsoft Word or LibreOffice (neither was available); fixtures are synthetic Word-like packages and structure is verified by re-parsing and a canonical comparison. Verify with real Word-authored files before release.
- DOCX: text boxes, simple fields, headers/footers and footnotes are not checked or commented; comments cannot be placed inside deleted (tracked) text; parsing runs on the main thread (a 2,000-paragraph document with ~6,000 comments takes a few seconds in tests); no password-protected or legacy `.doc` support.
- No PDF, OCR, backend, or AI features (out of scope).

## Next steps

Verify DOCX output in Word/LibreOffice with real documents, optionally index headers/footers/footnotes, then Phase 7 (rule options UI, style profiles, remaining catalog rules).
