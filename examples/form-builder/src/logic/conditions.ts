import type { Condition } from '../domain/conditions';

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Evaluates one condition against a target field's *effective* value.
 *
 * `undefined` / empty means "the target has no value", and a condition never
 * matches then — the field simply keeps its default state (spec: "when the
 * target field has no value"). That includes negative operators such as
 * "does not equal" and "contains none of": absence of an answer is not an answer.
 */
export function evaluateCondition(condition: Condition, value: unknown): boolean {
  switch (condition.kind) {
    case 'text': {
      if (typeof value !== 'string' || norm(value) === '') return false;
      const actual = norm(value);
      const expected = norm(condition.value);
      switch (condition.operator) {
        case 'equals':
          return actual === expected;
        case 'notEquals':
          return actual !== expected;
        case 'contains':
          return actual.includes(expected);
      }
      return false;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'greaterThan':
          return value > condition.value;
        case 'lessThan':
          return value < condition.value;
        case 'withinRange':
          return value >= condition.value.min && value <= condition.value.max;
      }
      return false;
    }
    case 'singleSelect': {
      if (typeof value !== 'string' || value === '') return false;
      return condition.operator === 'equals' ? value === condition.value : value !== condition.value;
    }
    case 'multiSelect': {
      if (!Array.isArray(value) || value.length === 0) return false;
      const selected = new Set(value as unknown[]);
      switch (condition.operator) {
        case 'containsAny':
          return condition.value.some((id) => selected.has(id));
        case 'containsAll':
          return condition.value.every((id) => selected.has(id));
        case 'containsNone':
          return !condition.value.some((id) => selected.has(id));
      }
      return false;
    }
    case 'date': {
      // ISO YYYY-MM-DD strings order lexicographically.
      if (typeof value !== 'string' || value === '') return false;
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'before':
          return value < condition.value;
        case 'after':
          return value > condition.value;
      }
      return false;
    }
  }
}
