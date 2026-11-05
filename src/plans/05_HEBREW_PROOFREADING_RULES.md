# Initial Hebrew Proofreading Rule Catalog

## 1. General policy

The initial rule set should focus on high-confidence, deterministic issues. Avoid rules that require semantic interpretation or have many legitimate exceptions.

Each finding must include an exact range, Hebrew explanation, and optional safe fix.

Rule identifiers are stable and must never be reused for a different meaning.

## 2. Initial MVP rules

### HEB-SPACE-001 — Multiple horizontal spaces

**Detect:** Two or more consecutive regular spaces or tabs within a line.

**Exclude:** Leading indentation when an option explicitly permits it.

**Finding range:** The complete whitespace sequence.

**Suggestion:** One regular space.

**Auto-fix:** Yes.

**Examples:**

```text
Incorrect: זהו  טקסט
Correct:   זהו טקסט
```

### HEB-SPACE-002 — Space before comma

**Detect:** Horizontal whitespace immediately before `,`.

**Finding range:** The whitespace only, or whitespace plus comma if required by UI highlighting. Choose one convention and test it consistently. Preferred: whitespace only.

**Suggestion:** Empty string.

**Auto-fix:** Yes.

```text
Incorrect: שלום ,יוסף
Correct:   שלום, יוסף
```

### HEB-SPACE-003 — Missing space after comma

**Detect:** A comma followed immediately by a Hebrew letter, Latin letter, or digit.

**Exclude:** Decimal/grouping formats only when configured; URLs and machine identifiers where relevant.

**Finding range:** Zero-length insertion immediately after the comma.

**Suggestion:** One space.

**Auto-fix:** Yes when exclusion logic is satisfied.

### HEB-SPACE-004 — Space before terminal punctuation

**Detect:** Horizontal whitespace before `.`, `?`, `!`, `:`, or `;`.

**Suggestion:** Remove whitespace.

**Auto-fix:** Yes.

### HEB-SPACE-005 — Missing space after terminal punctuation

**Detect:** `.`, `?`, `!`, `:`, or `;` followed immediately by a letter, when the punctuation does not belong to a URL, abbreviation, decimal number, or ellipsis.

**Auto-fix:** Only after robust exclusions; otherwise suggestion-only.

### HEB-SPACE-006 — Space immediately inside parentheses

**Detect:** Whitespace after `(` or before `)`.

**Auto-fix:** Yes.

```text
Incorrect: ( טקסט )
Correct:   (טקסט)
```

### HEB-PUNC-001 — Repeated comma

**Detect:** Two or more consecutive commas, optionally separated by spaces.

**Suggestion:** One comma.

**Auto-fix:** Yes.

### HEB-PUNC-002 — Repeated terminal punctuation

**Detect:** Repeated `?` or `!` beyond the configured allowed count.

**Default policy:** Flag two or more. Do not auto-fix because expressive writing can be intentional.

### HEB-PUNC-003 — Unbalanced round parentheses

**Detect:** Missing opening or closing round parenthesis.

**Implementation:** Stack-based scan, not only regex.

**Auto-fix:** No.

### HEB-PUNC-004 — Unbalanced square brackets

**Detect:** Missing opening or closing square bracket.

**Auto-fix:** No.

### HEB-PUNC-005 — Unbalanced curly brackets

**Detect:** Missing opening or closing curly bracket.

**Auto-fix:** No.

### HEB-PUNC-006 — Unbalanced quotation marks

**Detect:** Unpaired configured quotation mark types.

**Supported pairs:** `״...״`, `“...”`, `"..."` as configuration profiles.

**Caution:** Hebrew geresh and gershayim can occur inside words and abbreviations. Do not treat every `׳` or `״` as a quotation delimiter.

**Auto-fix:** No.

### HEB-TYPO-001 — Straight quote policy

**Detect:** Straight ASCII quotes where the selected style profile requires typographic Hebrew or curly quotation marks.

**Auto-fix:** No in the first version because apostrophes and quotes are context-sensitive.

### HEB-TYPO-002 — Hyphen consistency

**Detect:** Mixed use of ASCII hyphen-minus, Hebrew maqaf, en dash, or em dash for the same configured function.

**Auto-fix:** No by default.

### HEB-TYPO-003 — Non-breaking or invisible whitespace

**Detect:** Non-breaking spaces, zero-width spaces, and other configured invisible characters.

**Message:** Identify the Unicode character explicitly.

**Auto-fix:** Optional per character and configuration.

### HEB-CONS-001 — Terminology inconsistency

**Detect:** Multiple variants from a configured terminology group in the same document.

Example configuration:

```json
{
  "preferred": "דוא\"ל",
  "variants": ["דוא״ל", "מייל", "אימייל", "e-mail"]
}
```

**Auto-fix:** No by default.

### HEB-CONS-002 — Repeated adjacent word

**Detect:** The same normalized word twice consecutively, separated only by whitespace.

```text
Incorrect: הוא הוא הגיע
```

**Exclusions:** Intentional repetition may exist; therefore suggestion-only.

### HEB-CONS-003 — Mixed spelling variants

**Detect:** Use of multiple configured spelling variants in one document.

**Auto-fix:** No unless the user selects a preferred document profile.

## 3. Second-wave deterministic rules

Implement only after the initial rules and source mapping are stable:

- Spaces around slash according to a style profile.
- Spaces around mathematical operators.
- Number-unit spacing.
- Date-format consistency.
- Hebrew/Latin punctuation consistency.
- Empty parentheses or brackets.
- Suspicious isolated punctuation.
- Excessive blank lines.
- Sentence-start lowercase Latin letter where relevant.
- Organization-specific banned or preferred terms.
- Optional dictionary lookup with personal and organization allowlists.

## 4. Rules intentionally deferred

Do not implement these as simple regex rules:

- Subject-verb agreement.
- Gender and number agreement.
- Correct use of prepositions.
- Semantic ambiguity.
- Sentence quality or clarity.
- General spelling correction without a reliable dictionary and morphology strategy.
- Full niqqud correctness.

## 5. Rule configuration

Rules may have options, but defaults must be explicit and tested.

```ts
export interface HebrewStyleProfile {
  quotationStyle: "hebrew" | "curly" | "ascii";
  preferredDash: "maqaf" | "hyphen" | "en-dash";
  maxConsecutiveQuestionMarks: number;
  maxConsecutiveExclamationMarks: number;
  allowLeadingIndentation: boolean;
  terminologyGroups: readonly TerminologyGroup[];
}
```

## 6. False-positive policy

A missed low-severity issue is preferable to repeatedly flagging legitimate Hebrew. Any rule with frequent false positives must be disabled by default or refined before release.
