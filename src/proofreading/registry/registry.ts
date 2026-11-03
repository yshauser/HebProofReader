import type { ProofreadingRule } from "../../domain/proofreading";

export interface RuleRegistry {
  list(): readonly ProofreadingRule[];
  get(id: string): ProofreadingRule | undefined;
}

export function createRuleRegistry(rules: readonly ProofreadingRule[]): RuleRegistry {
  const map = new Map<string, ProofreadingRule>();
  for (const rule of rules) {
    if (map.has(rule.id)) throw new Error(`Duplicate rule id: ${rule.id}`);
    map.set(rule.id, rule);
  }
  const ordered = [...map.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { list: () => ordered, get: (id) => map.get(id) };
}
