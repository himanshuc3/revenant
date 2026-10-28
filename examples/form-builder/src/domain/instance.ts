import { newId } from './ids';
import { todayIso } from './dates';
import { modelOf } from '../fields/models';
import type { Instance, Template, Values } from './template';

/** Starts a draft response from a template: snapshots it and applies initial values (e.g. today's date). */
export function createDraftInstance(template: Template, now: Date = new Date()): Instance {
  const values: Values = {};
  const today = todayIso(now);
  for (const field of template.fields) {
    const initial = modelOf(field).initialValue?.(field, today);
    if (initial !== undefined) values[field.id] = initial as Values[string];
  }
  const stamp = now.toISOString();
  return {
    id: newId(),
    templateId: template.id,
    status: 'draft',
    templateSnapshot: structuredClone(template),
    values,
    createdAt: stamp,
    updatedAt: stamp,
  };
}
