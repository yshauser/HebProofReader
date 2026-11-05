# Phase 5 — DOCX research spike: findings

Status: disposable and superseded by the production adapter in `src/adapters/docx` (Phase 6). Differences: the adapter additionally indexes tracked insertions, inline content controls and smart tags, resolves anchors once before editing, finds the comments part through relationships, and batches run splitting.

Original status: disposable. Code lives in `spikes/docx/` and is not imported by `src/`. Run it with `npm run spike:docx` (33 tests). It uses `jszip` (ZIP) and `@xmldom/xmldom` (DOM-faithful XML), both dev dependencies only.

**Not verified:** output files were never opened in Microsoft Word or LibreOffice (neither is available here). Everything below is verified structurally (re-parsing, XML well-formedness, anchored-text checks), not by rendering. Phase 6 must add a real-Word/LibreOffice check before release.

## Questions from the roadmap

### 1. Can paragraphs and runs be parsed with stable anchors? Yes, with caveats
- Extraction: every `w:p` in document order (including table cells), each paragraph's runs (direct `w:r` and runs inside `w:hyperlink`); `w:tab` -> `\t`, `w:br`/`w:cr` -> `\n`; paragraph texts joined by `\n` and handed unchanged to the existing engine (rule contracts untouched).
- Mapping: engine `[start, end)` -> `DocxLocation` (`paragraphIndex`, `runIndex`, `offsetInRun`) and back. An exhaustive test checks every `[start, end)` pair on every fixture round-trips exactly. Identical words in different paragraphs resolve by position, never by text search.
- Zero-length insertions use the start anchor for both ends.
- Caveat: anchors are only valid for one document state. Inserting a comment splits runs and adds an empty reference run, so `runIndex` values shift. Phase 6 must resolve all anchors from the original document, or re-index after each edit as the spike does.
- Caveat: a run that contains only non-text content (field chars, drawings, comment references) is a zero-length run.

### 2. Can comments be inserted across one and multiple runs? Yes
- Within a run, across runs, across paragraphs, at insertion points, in empty paragraphs, in hyperlinks, and overlapping comments all produce markers whose anchored text equals the finding's `originalText`.
- Technique: split the run at both boundaries (cloning `w:rPr` to both halves, splitting only `w:t`), then insert `commentRangeStart`, `commentRangeEnd` and a `commentReference` run. Text is unchanged.
- A package without `comments.xml` gets the part, its `[Content_Types].xml` override and a document relationship added exactly once.

### 3. Which formatting and structures are preserved? Everything we do not touch
- The source bytes are never modified; the output is a new file with a different hash. Untouched parts are copied as-is.
- Tables, `w:bidi`, `w:rtl`, bold/italic run properties survived. Splitting preserves run formatting (bold/italic counts checked).
- Not preserved byte-for-byte: `document.xml` is re-serialized by xmldom (attribute/namespace formatting may change, content does not). Compare with a canonical XML diff in Phase 6.

### 4. How are existing comments handled? Preserved
- Existing `comments.xml` entries and their ranges are kept; new IDs are `max(existing) + 1`. The existing comment's anchored text is unchanged.

### 5. Limitations the UI must disclose
- Not indexed (text invisible to the engine, so never checked or commented): tracked changes (`w:ins`, `w:del`, `w:moveFrom/To`), content controls (`w:sdt`), simple fields (`w:fldSimple`), smart tags, text boxes (`w:txbxContent`), embedded chunks. The spike detects these (`findUnsupportedContent`); Phase 6 should warn the user instead of silently skipping, or index them.
- Headers, footers, footnotes, endnotes are separate parts and are not read.
- Fix application is out of scope: DOCX MVP exports comments only, never edits text.
- Password-protected/encrypted or legacy `.doc` files are rejected (not valid ZIP / not WordprocessingML).
- Fields with complex structure (`w:fldChar`) are treated as ordinary runs: instruction text is excluded but results are included.
- Zip-bomb and size limits are not implemented in the spike; required by `08_SECURITY_AND_PRIVACY.md`.

## Recommendations for Phase 6
1. Put the adapter in `src/adapters/docx/`, producing a `DocumentModel` with `DocxLocation` segments; keep the engine and `ProofreadingRule` contract unchanged. `toSourceLocation` in `src/domain/document/sourceMap.ts` already has the slot for `docx`.
2. Resolve every anchor from the original document before editing, or edit in descending offset order.
3. Add `jszip` and `@xmldom/xmldom` (or evaluate `fast-xml-parser` with ordered output) as runtime dependencies after a security review; both parse untrusted input.
4. Add tests with real Word-authored fixtures (split runs from editing history, tracked changes, existing comments, RTL tables) and verify in Word and LibreOffice.
5. Parse in a Web Worker or on a backend; enforce size limits and ZIP entry-count/uncompressed-size limits.
