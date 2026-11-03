# Architecture

## 1. Architectural style

Use a layered, dependency-directed architecture. Domain and proofreading packages must not depend on React, browser DOM APIs, DOCX libraries, or PDF libraries.

```text
UI / Application
       |
       v
Document adapters -> Document Model -> Proofreading Engine
                                           |
                                           v
                                  ProofreadingIssue[]
                                           |
                                           v
                            Review state / exporters
```

## 2. Recommended repository structure

Begin with one Vite repository but preserve package boundaries in `src`. Move to a workspace only when DOCX/backend/add-in packages justify it.

```text
src/
  app/
    App.tsx
    routes/
    providers/

  features/
    text-editor/
    proofreading-run/
    findings-panel/
    rule-settings/
    export-results/

  domain/
    document/
    proofreading/
    review/

  proofreading/
    engine/
    registry/
    tokenizer/
    normalization/
    rules/
      spacing/
      punctuation/
      typography/
      consistency/
      spelling/

  adapters/
    plain-text/
    docx/
    pdf/

  workers/
    proofreading.worker.ts

  shared/
    components/
    errors/
    utilities/

tests/
  fixtures/
    text/
    docx/
```

## 3. Layer responsibilities

### UI layer

- Captures user input.
- Displays text and findings.
- Maintains review state.
- Does not implement proofreading logic.
- Does not parse DOCX or PDF directly inside React components.

### Application layer

- Coordinates input, rule configuration, engine execution, and export.
- Converts domain errors to user-facing messages.
- Owns use cases such as `RunProofreading`, `ApplySuggestion`, and `ExportReport`.

### Domain layer

- Defines document segments, source locations, rules, findings, fixes, and review states.
- Has no framework dependencies.

### Proofreading engine

- Receives normalized document content and enabled rules.
- Executes rules independently.
- Validates findings.
- Deduplicates exact duplicates.
- identifies overlaps.
- Produces stable deterministic ordering.

### Document adapters

- Plain text adapter creates the simplest document model.
- DOCX adapter extracts content while retaining paragraph/run anchors.
- PDF adapter is deferred and later retains page/span/bounding-box anchors.

### Exporters

- JSON findings exporter.
- Plain-text exporter.
- DOCX comment writer in MVP 2.

## 4. Data flow

```text
Input
  -> adapter.parse()
  -> DocumentModel
  -> normalization with source map
  -> enabled rules
  -> engine validation/deduplication/sorting
  -> findings
  -> review session
  -> fix or export
```

## 5. Normalization and source mapping

Normalization must never lose the ability to return to the original source.

Examples of normalization:

- Standardize line endings to `\n`.
- Optionally identify non-breaking spaces without silently replacing source data.
- Treat Hebrew diacritics deliberately, not accidentally.
- Preserve Unicode offsets consistently.

JavaScript string indices are UTF-16 code-unit offsets. The entire project must use one explicit offset convention. For MVP, use UTF-16 offsets because they match JavaScript slicing and selection APIs. Document this in types and tests.

Each normalized segment must retain source anchors. Never rely only on searching for `originalText`, because identical text can occur multiple times.

## 6. Applying fixes

When applying multiple non-overlapping fixes, apply them from the highest start offset to the lowest. This prevents earlier offsets from moving before later replacements are made.

After a single interactive fix, prefer rerunning the engine. Do not manually mutate all existing findings unless performance proves this necessary.

Conflicting or overlapping fixes require explicit user resolution.

## 7. Future deployment shape

```text
apps/
  web/
  api/
  word-addin/

packages/
  domain/
  proofreading-core/
  hebrew-rules/
  docx-adapter/
  pdf-adapter/
  shared-types/
  test-fixtures/
```

Do not create this monorepo prematurely for MVP 1 unless it improves rather than delays delivery.
