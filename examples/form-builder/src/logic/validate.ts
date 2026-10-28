import type { Values } from '../domain/template';
import { modelOf, type FieldConfig } from '../fields/models';
import { resolveForm, type FormState } from './resolve';

export type FieldErrors = Record<string, string>;

export const REQUIRED_MESSAGE = 'This field is required';

/**
 * Validates a response. Hidden fields are never validated — even when their
 * default or rule-derived state is "required" — and computed/display fields
 * have nothing to validate.
 */
export function validateForm(
  fields: readonly FieldConfig[],
  rawValues: Values,
  state: FormState = resolveForm(fields, rawValues),
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    const s = state[field.id];
    const model = modelOf(field);
    if (!s || !s.visible || model.behaviour !== 'input') continue;

    if (s.value === undefined) {
      if (s.required) errors[field.id] = REQUIRED_MESSAGE;
      continue;
    }
    const message = model.validateValue(field, s.value);
    if (message) errors[field.id] = message;
  }
  return errors;
}
