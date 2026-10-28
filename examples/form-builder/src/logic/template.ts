import { REQUIRED_EFFECTS, type Rule } from '../domain/conditions';
import type { Template } from '../domain/template';
import { modelOf, type FieldConfig } from '../fields/models';
import { findCycle } from './graph';

export interface TemplateIssue {
  /** Field the issue belongs to; undefined for template-level issues. */
  fieldId?: string;
  message: string;
}

/**
 * Everything that must hold before a template may be saved. Per-field config
 * rules come from each field's own Zod schema; cross-field rules live here.
 */
export function validateTemplate(template: Template): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const { fields } = template;

  if (template.title.trim() === '') issues.push({ message: 'Give the form a title' });

  const ids = new Set<string>();
  for (const f of fields) {
    if (ids.has(f.id)) issues.push({ fieldId: f.id, message: 'Duplicate field id' });
    ids.add(f.id);
  }
  const byId = new Map(fields.map((f) => [f.id, f]));

  for (const field of fields) {
    const model = modelOf(field);

    const parsed = model.configSchema.safeParse(field);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        // Rule problems are reported as "Rule N: …" so the author can find them.
        const ruleIndex = issue.path[0] === 'rules' && typeof issue.path[1] === 'number' ? issue.path[1] + 1 : null;
        issues.push({ fieldId: field.id, message: ruleIndex ? `Rule ${ruleIndex}: ${issue.message}` : issue.message });
      }
    }

    field.rules.forEach((rule, i) => {
      const n = `Rule ${i + 1}`;
      const target = byId.get(rule.targetFieldId);
      if (!target) return void issues.push({ fieldId: field.id, message: `${n}: choose a field to check` });
      if (target.id === field.id) return void issues.push({ fieldId: field.id, message: `${n}: a field cannot depend on itself` });

      const targetKind = modelOf(target).conditionKind;
      if (targetKind === null || targetKind !== rule.condition.kind) {
        return void issues.push({ fieldId: field.id, message: `${n}: "${target.label}" cannot be used in a condition` });
      }
      if (model.behaviour !== 'input' && REQUIRED_EFFECTS.includes(rule.effect)) {
        issues.push({ fieldId: field.id, message: `${n}: this field cannot be marked required` });
      }
      const c = rule.condition;
      if (c.kind === 'singleSelect' && target.type === 'singleSelect') {
        if (!target.options.some((o) => o.id === c.value)) issues.push({ fieldId: field.id, message: `${n}: pick an option` });
      }
      if (c.kind === 'multiSelect' && target.type === 'multiSelect') {
        if (c.value.some((id) => !target.options.some((o) => o.id === id))) {
          issues.push({ fieldId: field.id, message: `${n}: an option no longer exists` });
        }
      }
    });

    if (field.type === 'calculation') {
      for (const id of field.sourceIds) {
        const source = byId.get(id);
        if (!source) issues.push({ fieldId: field.id, message: 'A source field no longer exists' });
        else if (source.type !== 'number') {
          issues.push({ fieldId: field.id, message: `"${source.label}" is not a Number field` });
        }
      }
    }
  }

  const cycle = findCycle(fields);
  if (cycle) {
    const names = cycle.map((id) => `"${byId.get(id)?.label ?? id}"`).join(' → ');
    issues.push({ fieldId: cycle[0], message: `Circular dependency: ${names}` });
  }
  return issues;
}

/**
 * Repairs references that point at things that no longer exist (deleted fields,
 * removed options). Run after every structural edit so a template never keeps
 * a rule it can't evaluate.
 */
export function cleanReferences(fields: readonly FieldConfig[]): FieldConfig[] {
  const byId = new Map(fields.map((f) => [f.id, f]));

  function cleanRule(rule: Rule): Rule | null {
    const target = byId.get(rule.targetFieldId);
    if (!target) return null;
    const c = rule.condition;
    if (c.kind === 'singleSelect' && target.type === 'singleSelect') {
      // An empty value means "not chosen yet" and is left for validation to flag.
      return c.value === '' || target.options.some((o) => o.id === c.value) ? rule : null;
    }
    if (c.kind === 'multiSelect' && target.type === 'multiSelect') {
      const kept = c.value.filter((id) => target.options.some((o) => o.id === id));
      return kept.length === c.value.length ? rule : { ...rule, condition: { ...c, value: kept } };
    }
    return rule;
  }

  return fields.map((field) => {
    const rules = field.rules.map(cleanRule).filter((r): r is Rule => r !== null);
    const rulesChanged = rules.length !== field.rules.length || rules.some((r, i) => r !== field.rules[i]);
    let next: FieldConfig = rulesChanged ? { ...field, rules } : field;
    if (next.type === 'calculation') {
      const sourceIds = next.sourceIds.filter((id) => byId.has(id));
      if (sourceIds.length !== next.sourceIds.length) next = { ...next, sourceIds };
    }
    return next;
  });
}
