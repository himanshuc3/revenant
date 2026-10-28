import type { FieldConfig } from '../fields/models';
import { modelOf } from '../fields/models';

/** Ids a field reads from: its rule targets plus any model-declared sources (e.g. calculation inputs). */
export function dependenciesOf(field: FieldConfig, knownIds: ReadonlySet<string>): string[] {
  const deps = new Set<string>();
  for (const rule of field.rules) deps.add(rule.targetFieldId);
  for (const id of modelOf(field).sourceIds?.(field) ?? []) deps.add(id);
  return [...deps].filter((id) => id !== field.id && knownIds.has(id));
}

/**
 * Orders fields so every field comes after the fields it depends on.
 * Stable with respect to form order. Fields caught in a cycle (which the
 * builder forbids, but corrupt data might contain) are appended in form order
 * so evaluation always terminates.
 */
export function evaluationOrder(fields: readonly FieldConfig[]): FieldConfig[] {
  const known = new Set(fields.map((f) => f.id));
  const remaining = new Map(fields.map((f) => [f.id, new Set(dependenciesOf(f, known))]));
  const done = new Set<string>();
  const order: FieldConfig[] = [];

  let progressed = true;
  while (order.length < fields.length && progressed) {
    progressed = false;
    for (const field of fields) {
      if (done.has(field.id)) continue;
      const deps = remaining.get(field.id);
      if (deps && [...deps].every((d) => done.has(d))) {
        order.push(field);
        done.add(field.id);
        progressed = true;
      }
    }
  }
  for (const field of fields) if (!done.has(field.id)) order.push(field);
  return order;
}

/** Returns the ids forming a dependency cycle, or null if the graph is acyclic. */
export function findCycle(fields: readonly FieldConfig[]): string[] | null {
  const known = new Set(fields.map((f) => f.id));
  const deps = new Map(fields.map((f) => [f.id, dependenciesOf(f, known)]));
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    if (state.get(id) === 'done') return null;
    if (state.get(id) === 'visiting') return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 'visiting');
    stack.push(id);
    for (const next of deps.get(id) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, 'done');
    return null;
  }

  for (const field of fields) {
    const cycle = visit(field.id);
    if (cycle) return cycle;
  }
  return null;
}
