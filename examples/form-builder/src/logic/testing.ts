import type { Condition, Effect, Rule } from '../domain/conditions';
import type { Values } from '../domain/template';
import { createField, createTemplate } from '../domain/template';
import type { FieldConfig } from '../fields/models';

let n = 0;
export function rule(targetFieldId: string, condition: Condition, effect: Effect): Rule {
  n += 1;
  return { id: `r${n}`, targetFieldId, condition, effect };
}

export function withId<T extends FieldConfig>(field: T, id: string, patch: Partial<T> = {}): T {
  return { ...field, id, ...patch };
}

export const text = (id: string, patch: Partial<ReturnType<typeof createField<'singleLineText'>>> = {}) =>
  withId(createField('singleLineText'), id, { label: id, ...patch });
export const num = (id: string, patch: Partial<ReturnType<typeof createField<'number'>>> = {}) =>
  withId(createField('number'), id, { label: id, ...patch });

export function templateOf(fields: FieldConfig[]) {
  return { ...createTemplate(), fields };
}
export type { Values };
