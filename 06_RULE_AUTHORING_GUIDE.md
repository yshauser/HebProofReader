# Rule Authoring Guide

## 1. Before implementation

For every new rule, document:

- Stable rule ID.
- Hebrew name and description.
- Category and severity.
- Exact detection condition.
- Explicit exclusions.
- Finding range convention.
- Suggested replacement.
- Whether automatic fixing is safe.
- Positive and negative examples.

Do not implement a rule whose expected behavior cannot be stated clearly.

## 2. Module template

```ts
import type {
  ProofreadingIssue,
  ProofreadingRule,
  RuleContext,
} from "../../domain/proofreading";

export const exampleRule: ProofreadingRule = {
  id: "HEB-EXAMPLE-001",
  name: "שם החוק",
  description: "תיאור ברור של החוק",
  category: "spacing",
  defaultSeverity: "warning",
  enabledByDefault: true,

  check(context: RuleContext): readonly ProofreadingIssue[] {
    const issues: ProofreadingIssue[] = [];
    const { text } = context;

    // Deterministic, side-effect-free implementation.

    return issues;
  },
};
```

Use shared builders to validate ranges, calculate context, map source locations, and generate stable IDs. Do not duplicate this logic in every rule.

## 3. Recommended shared builder

```ts
createIssue({
  rule,
  document,
  range,
  message,
  explanation,
  suggestion,
  fix,
  autoFixable,
});
```

The builder must:

- Validate the range.
- Derive `originalText` by slicing the source.
- Add bounded context before and after.
- Map the normalized range to a source location.
- Generate a deterministic finding ID.

## 4. Regex guidance

1. Prefer readable regexes and helper functions over one giant expression.
2. Use the Unicode `u` flag.
3. Use `g` only when all matches are required.
4. Confirm behavior on Hebrew letters, niqqud, Latin text, digits, and line breaks.
5. Guard against zero-length infinite loops.
6. Avoid browser features that are not within the project's compatibility target.
7. Explain non-obvious regexes in a brief comment.

## 5. Token-based rules

Use tokenization when a rule depends on word boundaries or neighboring tokens. The tokenizer should emit stable ranges into the original normalized text.

```ts
export interface Token {
  kind: "word" | "number" | "punctuation" | "whitespace" | "other";
  value: string;
  range: TextRange;
}
```

Do not use JavaScript `\b` as a universal Hebrew word-boundary solution without tests.

## 6. Rule test checklist

Every rule requires:

- Detects one occurrence.
- Detects multiple occurrences.
- Does not flag correct text.
- Handles empty input.
- Handles start and end of text.
- Handles newlines.
- Handles mixed Hebrew and English.
- Handles niqqud when relevant.
- Produces the exact expected start/end range.
- Produces the expected suggestion and fix.
- Does not mutate input.
- Is deterministic across repeated runs.

## 7. Example parameterized test

```ts
import { describe, expect, it } from "vitest";

const positiveCases = [
  {
    input: "שלום ,יוסף",
    expectedText: " ",
    expectedStart: 4,
    expectedEnd: 5,
  },
];

const negativeCases = ["שלום, יוסף", "", "שלום"];

describe("HEB-SPACE-002", () => {
  it.each(positiveCases)("detects $input", (testCase) => {
    const result = runRule(testCase.input);
    expect(result).toHaveLength(1);
    expect(result[0].range).toEqual({
      start: testCase.expectedStart,
      end: testCase.expectedEnd,
    });
    expect(result[0].originalText).toBe(testCase.expectedText);
  });

  it.each(negativeCases)("does not flag %s", (input) => {
    expect(runRule(input)).toHaveLength(0);
  });
});
```

## 8. Review questions

Before merging a rule, ask:

- Can legitimate Hebrew frequently match it?
- Are exceptions explicit?
- Is the highlighted range intuitive?
- Can the fix damage URLs, identifiers, abbreviations, or numbers?
- Does the rule work across paragraph boundaries as intended?
- Is it enabled by default for the right reason?
