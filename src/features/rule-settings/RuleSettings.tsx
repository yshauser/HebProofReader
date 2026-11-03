import { useEffect, useRef } from "react";
import type { ProofreadingRule, RuleCategory } from "../../domain/proofreading";
import { CATEGORY_LABELS } from "../../shared/labels";

interface RuleSettingsProps {
  rules: readonly ProofreadingRule[];
  enabled: Readonly<Record<string, boolean>>;
  onToggleRule: (ruleId: string) => void;
  onToggleCategory: (category: RuleCategory, value: boolean) => void;
}

function CategoryToggle({
  category,
  rules,
  enabled,
  onToggleCategory,
}: {
  category: RuleCategory;
  rules: readonly ProofreadingRule[];
  enabled: Readonly<Record<string, boolean>>;
  onToggleCategory: RuleSettingsProps["onToggleCategory"];
}) {
  const ref = useRef<HTMLInputElement>(null);
  const on = rules.filter((rule) => enabled[rule.id]).length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = on > 0 && on < rules.length;
  }, [on, rules.length]);
  return (
    <label className="rule-group__title">
      <input
        ref={ref}
        type="checkbox"
        checked={on === rules.length}
        onChange={(event) => onToggleCategory(category, event.target.checked)}
        aria-label={`קטגוריית ${CATEGORY_LABELS[category]}`}
      />
      <strong>{CATEGORY_LABELS[category]}</strong>
    </label>
  );
}

export function RuleSettings({ rules, enabled, onToggleRule, onToggleCategory }: RuleSettingsProps) {
  const categories = [...new Set(rules.map((rule) => rule.category))];
  return (
    <details className="panel rule-settings">
      <summary>הגדרות חוקים ({rules.filter((rule) => enabled[rule.id]).length}/{rules.length} פעילים)</summary>
      {categories.map((category) => {
        const group = rules.filter((rule) => rule.category === category);
        return (
          <fieldset key={category} className="rule-group">
            <legend className="visually-hidden">{CATEGORY_LABELS[category]}</legend>
            <CategoryToggle category={category} rules={group} enabled={enabled} onToggleCategory={onToggleCategory} />
            <ul className="rule-group__list">
              {group.map((rule) => (
                <li key={rule.id}>
                  <label title={rule.description}>
                    <input
                      type="checkbox"
                      checked={Boolean(enabled[rule.id])}
                      onChange={() => onToggleRule(rule.id)}
                      aria-label={`${rule.id} ${rule.name}`}
                    />
                    <span className="rule-id" dir="ltr">
                      {rule.id}
                    </span>{" "}
                    {rule.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </details>
  );
}
