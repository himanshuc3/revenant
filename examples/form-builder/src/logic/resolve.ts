import type { Effect } from '../domain/conditions';
import type { Values } from '../domain/template';
import { modelOf, type FieldConfig, type FieldValue } from '../fields/models';
import { evaluateCondition } from './conditions';
import { evaluationOrder } from './graph';

export interface FieldState {
  visible: boolean;
  /** Required state after rules. Only meaningful while `visible`. */
  required: boolean;
  /**
   * The value other fields see: undefined when the field is hidden, a display
   * field, or empty. Computed fields carry their computed value here.
   */
  value: FieldValue | undefined;
}

export type FormState = Record<string, FieldState>;

const VISIBILITY: readonly Effect[] = ['show', 'hide'];
const REQUIRED: readonly Effect[] = ['require', 'unrequire'];

/**
 * Resolves every field's visibility, required state and effective value.
 *
 * Semantics (documented in the README):
 *  - Visibility and required are independent axes.
 *  - Rules are applied in list order; the **last matching rule per axis wins**.
 *    With no matching rule the field keeps its default state.
 *  - Fields are evaluated in dependency order, and a hidden field contributes
 *    *no value*, so a rule that reads a hidden field never matches. This is what
 *    makes chained conditions (A shows B, B shows C) behave: hiding A hides C.
 *  - A calculation sums only visible, non-empty Number sources.
 */
export function resolveForm(fields: readonly FieldConfig[], rawValues: Values): FormState {
  const state: FormState = {};

  for (const field of evaluationOrder(fields)) {
    const model = modelOf(field);

    let visible = field.visible;
    let required = model.behaviour === 'input' ? field.required : false;

    for (const rule of field.rules) {
      const axis = VISIBILITY.includes(rule.effect) ? 'visibility' : REQUIRED.includes(rule.effect) ? 'required' : null;
      if (!axis) continue;
      if (axis === 'required' && model.behaviour !== 'input') continue;

      const target = fields.find((f) => f.id === rule.targetFieldId);
      if (!target || target.id === field.id) continue;
      if (modelOf(target).conditionKind !== rule.condition.kind) continue;

      const targetValue = state[target.id]?.value;
      if (!evaluateCondition(rule.condition, targetValue)) continue;

      if (axis === 'visibility') visible = rule.effect === 'show';
      else required = rule.effect === 'require';
    }

    let value: FieldValue | undefined;
    if (visible) {
      if (model.behaviour === 'computed') {
        value = model.compute?.(field, (id) => state[id]?.value);
      } else if (model.behaviour === 'input') {
        const raw = rawValues[field.id];
        value = model.isEmpty(raw) ? undefined : raw;
      }
    }

    state[field.id] = { visible, required, value };
  }
  return state;
}

/**
 * The data that may leave the form (storage on submit, PDF): visible fields only,
 * in form order, non-empty. Hidden fields' values never appear.
 */
export function submittableValues(fields: readonly FieldConfig[], state: FormState): Values {
  const out: Values = {};
  for (const field of fields) {
    const s = state[field.id];
    if (s?.visible && s.value !== undefined) out[field.id] = s.value;
  }
  return out;
}
