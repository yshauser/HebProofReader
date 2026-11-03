# Mandatory Project Rules

These rules apply to all human and agent-generated changes.

## 1. Scope and change discipline

1. Implement the requested scope only.
2. Prefer minimal, reviewable changes.
3. Do not redesign unrelated components.
4. Do not change public TypeScript interfaces without updating documentation and tests.
5. Do not add a dependency when a small, clear implementation is sufficient.
6. Explain significant dependency choices in the pull request or commit summary.

## 2. TypeScript

1. Enable `strict` mode.
2. Avoid `any`, non-null assertions, and type casts that bypass validation.
3. Validate external input at runtime with Zod or explicit validators.
4. Prefer discriminated unions for source locations and result states.
5. Keep domain types framework-independent.
6. Export only what is part of a deliberate module API.

## 3. React

1. Keep proofreading logic outside React components and hooks.
2. Components must be small and focused.
3. Avoid duplicating domain state.
4. Derived values should be calculated, not independently stored.
5. Do not use `dangerouslySetInnerHTML` for uploaded or generated content.
6. Include loading, empty, success, and error states.

## 4. Hebrew and RTL

1. The application root uses `dir="rtl"` and `lang="he"`.
2. Do not reverse Hebrew strings manually.
3. Use logical CSS properties such as `margin-inline-start`.
4. Test mixed Hebrew, English, numbers, and punctuation.
5. Do not silently remove niqqud or cantillation marks.
6. Use Unicode-aware regular expressions where applicable.
7. Document whether a rule treats niqqud as significant.

## 5. Rule implementation

1. One primary rule per module.
2. Every rule has a unique stable ID.
3. A rule must not modify its input.
4. A rule must be deterministic and free of network calls.
5. A rule returns zero or more immutable findings.
6. A rule must supply exact ranges.
7. A rule must not use random IDs.
8. A rule must not throw for ordinary input, including empty text.
9. Every rule includes tests and examples.
10. Automatic fixes are allowed only when ambiguity is negligible.

## 6. Document safety

1. Never overwrite an uploaded file.
2. Never regenerate a DOCX solely from extracted HTML when document preservation is required.
3. Keep original and normalized text distinct.
4. Preserve source mapping through extraction and normalization.
5. Do not identify a source location only by searching for matching text.
6. Treat uploaded files as untrusted input.

## 7. Testing and quality gates

Every completed task must run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

When the task affects the main workflow, also run:

```bash
npm run test:e2e
```

Do not claim completion when required checks fail. Report the exact failure and attempted resolution.

## 8. Git workflow

1. Work on a feature branch.
2. Do not commit generated build output.
3. Keep commits focused and descriptively named.
4. Do not force-push shared branches.
5. Never merge directly into `main` without review and passing CI.

## 9. Privacy

1. MVP text checks run locally.
2. No analytics may capture document text.
3. Do not log complete document contents.
4. Do not send content to an LLM or external API.
5. Any future remote processing requires an explicit privacy design and user-visible consent.

## 10. Definition of done

A feature is done only when:

- Acceptance criteria are met.
- Relevant automated tests exist and pass.
- Type checking, linting, and build pass.
- Error and empty states are handled.
- Hebrew/RTL behavior was verified.
- Documentation is updated when contracts or behavior change.
- No unrelated refactoring is included.
