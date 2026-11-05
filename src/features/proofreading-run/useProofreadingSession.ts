import { useMemo, useState } from "react";
import { createPlainTextDocument, DEFAULT_DOCUMENT_ID } from "../../adapters/plain-text";
import type { ProofreadingResult, RuleCategory } from "../../domain/proofreading";
import { countByStatus } from "../../domain/review";
import type { ReviewedIssue, ReviewStatus } from "../../domain/review";
import { applyIssueFix, applySafeFixes, runProofreading } from "../../proofreading/engine";
import type { RuleRegistry } from "../../proofreading/registry/registry";
import { defaultRegistry } from "../../proofreading/rules";
import { loadDocxFile } from "../docx-import/loadDocx";
import type { LoadedDocx } from "../docx-import/loadDocx";
import { DEFAULT_FILTERS, filterReviewed } from "../findings-panel/model";
import type { FindingFilters } from "../findings-panel/model";

export interface SessionNotice {
  kind: "info" | "success" | "error";
  text: string;
}

interface RunSnapshot {
  text: string;
  enabledKey: string;
  result: ProofreadingResult;
}

const enabledKeyOf = (enabled: Readonly<Record<string, boolean>>) =>
  Object.keys(enabled)
    .filter((id) => enabled[id])
    .sort()
    .join(",");

/** Application-layer session state. Contains no proofreading logic: it only calls the engine. */
export function useProofreadingSession(registry: RuleRegistry = defaultRegistry) {
  const rules = registry.list();
  const [typedText, setText] = useState("");
  const [docx, setDocx] = useState<LoadedDocx | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const text = docx ? docx.document.text : typedText;
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rules.map((rule) => [rule.id, rule.enabledByDefault])),
  );
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [review, setReview] = useState<Record<string, ReviewStatus>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FindingFilters>(DEFAULT_FILTERS);
  const [notice, setNotice] = useState<SessionNotice | null>(null);

  function runOn(nextText: string): ProofreadingResult {
    const document = docx ? docx.document : createPlainTextDocument(nextText, { id: DEFAULT_DOCUMENT_ID });
    const enabledRuleIds = new Set(rules.filter((rule) => enabled[rule.id]).map((rule) => rule.id));
    const result = runProofreading({ document, rules, enabledRuleIds });
    const ids = new Set(result.issues.map((issue) => issue.id));
    setSnapshot({ text: nextText, enabledKey: enabledKeyOf(enabled), result });
    setReview((current) => Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id))));
    setSelectedId((current) => (current && ids.has(current) ? current : null));
    return result;
  }

  function resetResults() {
    setSnapshot(null);
    setReview({});
    setSelectedId(null);
    setFilters(DEFAULT_FILTERS);
  }

  const textIsStale = snapshot !== null && snapshot.text !== text;
  const rulesChanged = snapshot !== null && snapshot.enabledKey !== enabledKeyOf(enabled);
  const result = snapshot && !textIsStale ? snapshot.result : null;

  const reviewed: ReviewedIssue[] = useMemo(
    () => (result ? result.issues.map((issue) => ({ issue, status: review[issue.id] ?? "open" })) : []),
    [result, review],
  );
  const filtered = useMemo(() => filterReviewed(reviewed, filters), [reviewed, filters]);
  const counts = useMemo(() => countByStatus(reviewed), [reviewed]);
  const overlappingIds = useMemo(
    () => new Set((result?.overlaps ?? []).flatMap((o) => [o.firstId, o.secondId])),
    [result],
  );
  const selectedIssue = reviewed.find(({ issue }) => issue.id === selectedId)?.issue ?? null;

  return {
    rules,
    text,
    setText,
    isDocx: docx !== null,
    docx,
    docxLoading,
    enabled,
    result,
    reviewed,
    filtered,
    counts,
    overlappingIds,
    filters,
    setFilters,
    selectedId,
    selectedIssue,
    notice,
    hasRun: snapshot !== null,
    textIsStale,
    rulesChanged,
    clearNotice: () => setNotice(null),

    run() {
      const outcome = runOn(text);
      setNotice(
        outcome.errors.length > 0
          ? { kind: "error", text: `חלק מהחוקים נכשלו ולא נבדקו: ${[...new Set(outcome.errors.map((e) => e.ruleId))].join(", ")}` }
          : { kind: "info", text: outcome.issues.length === 0 ? "לא נמצאו ממצאים." : `נמצאו ${outcome.issues.length} ממצאים.` },
      );
    },

    toggleRule(ruleId: string) {
      setEnabled((current) => ({ ...current, [ruleId]: !current[ruleId] }));
    },

    setCategoryEnabled(category: RuleCategory, value: boolean) {
      setEnabled((current) => ({
        ...current,
        ...Object.fromEntries(rules.filter((rule) => rule.category === category).map((rule) => [rule.id, value])),
      }));
    },

    select(id: string | null) {
      setSelectedId(id);
    },

    step(delta: 1 | -1) {
      if (filtered.length === 0) return;
      const index = filtered.findIndex(({ issue }) => issue.id === selectedId);
      const next = index === -1 ? (delta === 1 ? 0 : filtered.length - 1) : (index + delta + filtered.length) % filtered.length;
      setSelectedId(filtered[next]?.issue.id ?? null);
    },

    setStatus(id: string, status: ReviewStatus) {
      setReview((current) => ({ ...current, [id]: status }));
    },

    async loadDocx(file: File) {
      setDocxLoading(true);
      const loaded = await loadDocxFile(file);
      setDocxLoading(false);
      if (!loaded.ok) {
        setNotice({ kind: "error", text: loaded.message });
        return;
      }
      resetResults();
      setDocx(loaded);
      setNotice({ kind: "info", text: "הקובץ נטען. לחצו על ״בדיקה״ כדי לחפש ממצאים." });
    },

    clearDocx() {
      setDocx(null);
      resetResults();
      setNotice(null);
    },

    applyFix(id: string) {
      if (docx) return;
      const issue = result?.issues.find((candidate) => candidate.id === id);
      if (!issue?.autoFixable) return;
      const nextText = applyIssueFix(text, issue);
      setText(nextText);
      runOn(nextText);
      setNotice({ kind: "success", text: "התיקון הוחל והבדיקה הורצה מחדש." });
    },

    applyAllSafeFixes() {
      if (!result || docx) return;
      const candidates = reviewed.filter(({ status }) => status === "open" || status === "accepted").map(({ issue }) => issue);
      const outcome = applySafeFixes(text, candidates);
      if (outcome.appliedIds.length === 0) return;
      setText(outcome.text);
      runOn(outcome.text);
      setNotice({
        kind: "success",
        text:
          `הוחלו ${outcome.appliedIds.length} תיקונים.` +
          (outcome.skippedIds.length > 0 ? ` ${outcome.skippedIds.length} תיקונים מתנגשים דולגו; הרץ שוב כדי להחילם.` : ""),
      });
    },

    notify(next: SessionNotice) {
      setNotice(next);
    },
  };
}

export type ProofreadingSession = ReturnType<typeof useProofreadingSession>;
