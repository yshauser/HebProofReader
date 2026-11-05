import { stableHash } from "../../shared/utilities/hash";

export { stableHash };

export function stableIssueId(parts: {
  ruleId: string;
  documentId: string;
  start: number;
  end: number;
  originalText: string;
  suggestion: string | undefined;
}): string {
  const { ruleId, documentId, start, end, originalText, suggestion } = parts;
  const key = [ruleId, documentId, start, end, originalText, suggestion ?? ""].join("\u0000");
  return `${ruleId}:${stableHash(key)}`;
}
