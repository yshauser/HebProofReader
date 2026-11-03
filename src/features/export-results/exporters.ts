import { z } from "zod";
import type { ProofreadingResult } from "../../domain/proofreading";
import { countByStatus } from "../../domain/review";
import type { ReviewStatus } from "../../domain/review";

const rangeSchema = z.object({ start: z.number().int().min(0), end: z.number().int().min(0) });

export const findingsReportSchema = z.object({
  schemaVersion: z.literal(1),
  documentId: z.string(),
  /** Offsets are half-open UTF-16 ranges [start, end). */
  offsetConvention: z.literal("utf16-half-open"),
  textLength: z.number().int().min(0),
  counts: z.object({
    total: z.number().int(),
    open: z.number().int(),
    accepted: z.number().int(),
    rejected: z.number().int(),
    ignored: z.number().int(),
  }),
  ruleErrors: z.array(z.object({ ruleId: z.string(), kind: z.enum(["exception", "invalid-issue"]), message: z.string() })),
  issues: z.array(
    z.object({
      id: z.string(),
      ruleId: z.string(),
      category: z.enum(["spacing", "punctuation", "typography", "spelling", "grammar", "style", "consistency"]),
      severity: z.enum(["info", "warning", "error"]),
      status: z.enum(["open", "accepted", "rejected", "ignored"]),
      message: z.string(),
      explanation: z.string().optional(),
      range: rangeSchema,
      originalText: z.string(),
      contextBefore: z.string(),
      contextAfter: z.string(),
      suggestion: z.string().optional(),
      autoFixable: z.boolean(),
      confidence: z.literal(1),
    }),
  ),
});

export type FindingsReport = z.infer<typeof findingsReportSchema>;

export interface BuildReportInput {
  text: string;
  result: ProofreadingResult;
  review: Readonly<Record<string, ReviewStatus>>;
}

/** Builds the JSON findings report. The full document text is intentionally not included. */
export function buildFindingsReport({ text, result, review }: BuildReportInput): FindingsReport {
  const reviewed = result.issues.map((issue) => ({ issue, status: review[issue.id] ?? ("open" as const) }));
  const { total, open, accepted, rejected, ignored } = countByStatus(reviewed);
  return {
    schemaVersion: 1,
    documentId: result.documentId,
    offsetConvention: "utf16-half-open",
    textLength: text.length,
    counts: { total, open, accepted, rejected, ignored },
    ruleErrors: result.errors.map((e) => ({ ruleId: e.ruleId, kind: e.kind, message: e.message })),
    issues: reviewed.map(({ issue, status }) => ({
      id: issue.id,
      ruleId: issue.ruleId,
      category: issue.category,
      severity: issue.severity,
      status,
      message: issue.message,
      explanation: issue.explanation,
      range: { start: issue.range.start, end: issue.range.end },
      originalText: issue.originalText,
      contextBefore: issue.contextBefore,
      contextAfter: issue.contextAfter,
      suggestion: issue.suggestion,
      autoFixable: issue.autoFixable,
      confidence: issue.confidence,
    })),
  };
}

export function serializeReport(report: FindingsReport): string {
  return JSON.stringify(report, null, 2);
}
