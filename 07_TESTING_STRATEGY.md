# Testing Strategy

## 1. Test pyramid

### Unit tests

Primary coverage for:

- Every proofreading rule.
- Tokenizer.
- Normalization and source mapping.
- Stable ID generation.
- Range validation.
- Sorting, deduplication, and overlap detection.
- Fix application.

### Component tests

Cover:

- Text editor RTL behavior.
- Findings list rendering.
- Rule toggles and filters.
- Selecting a finding and highlighting its range.
- Accept, reject, and ignore states.
- Error and empty states.

### Integration tests

Cover:

- Plain-text adapter through engine to UI view model.
- Applying a fix and rerunning rules.
- Exported JSON schema.
- Later: DOCX parse/map/comment round trip.

### End-to-end tests

A minimum smoke test:

1. Open the app.
2. Paste Hebrew text containing known issues.
3. Run proofreading.
4. Confirm findings appear.
5. Select a finding and confirm highlighting.
6. Apply one safe fix.
7. Export corrected text or report.

## 2. Fixture policy

Keep real-world-like but non-sensitive fixtures in source control.

```text
tests/fixtures/
  text/
    basic-spacing.txt
    mixed-hebrew-english.txt
    niqqud.txt
    punctuation.txt
  docx/
    simple-paragraphs.docx
    split-runs.docx
    tables.docx
    rtl-mixed-content.docx
```

Never include confidential or personally identifiable documents.

## 3. Golden tests

For complex rule sets, store input and expected findings in readable JSON fixtures. Review golden-file changes carefully; do not update expected results merely to make tests pass.

## 4. Property and invariant tests

Where practical, verify:

- Every emitted range is valid.
- Every non-insertion `originalText` matches `text.slice(start, end)`.
- Applying safe fixes never produces `undefined` or invalid Unicode strings.
- Running the engine twice gives deeply equal results.
- Sorting is stable.

## 5. Regression tests

Every corrected bug receives a test that fails before the fix and passes afterward.

## 6. DOCX tests for MVP 2

Test at minimum:

- A finding within one run.
- A finding spanning multiple runs.
- Repeated identical words in different paragraphs.
- Bold/italic boundaries.
- Hebrew and English in one paragraph.
- Tables.
- Existing comments.
- Export creates a new file.
- Original file hash remains unchanged.

## 7. CI quality gates

CI must reject changes when any of these fail:

```bash
npm ci
npm run typecheck
npm run lint
npm run test -- --run
npm run build
```

Run Playwright on pull requests affecting user workflows and on the main branch.

## 8. Coverage policy

Do not optimize for a vanity percentage. Require high branch coverage for the engine and rules, plus meaningful tests for failure paths and exclusions.
