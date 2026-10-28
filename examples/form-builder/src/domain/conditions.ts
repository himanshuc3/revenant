import { z } from 'zod';

/**
 * Conditions are keyed by the *kind* of value they compare against, not by field
 * type. A field type declares which kind it exposes as a rule target
 * (`FieldModel.conditionKind`), so a new field type can reuse an existing kind.
 */
export const CONDITION_KINDS = ['text', 'number', 'singleSelect', 'multiSelect', 'date'] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];

const nonBlank = (s: string) => s.trim().length > 0;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isoDate = z
  .string()
  .regex(ISO_DATE, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Invalid date');

const textCondition = z.object({
  kind: z.literal('text'),
  operator: z.enum(['equals', 'notEquals', 'contains']),
  value: z.string().refine(nonBlank, 'Enter a value'),
});

const numberComparison = z.object({
  kind: z.literal('number'),
  operator: z.enum(['equals', 'greaterThan', 'lessThan']),
  value: z.number().finite(),
});

const numberRange = z.object({
  kind: z.literal('number'),
  operator: z.literal('withinRange'),
  value: z
    .object({ min: z.number().finite(), max: z.number().finite() })
    .refine((r) => r.min <= r.max, 'Minimum must not exceed maximum'),
});

const singleSelectCondition = z.object({
  kind: z.literal('singleSelect'),
  operator: z.enum(['equals', 'notEquals']),
  value: z.string().min(1, 'Choose an option'),
});

const multiSelectCondition = z.object({
  kind: z.literal('multiSelect'),
  operator: z.enum(['containsAny', 'containsAll', 'containsNone']),
  value: z.array(z.string().min(1)).min(1, 'Choose at least one option'),
});

const dateCondition = z.object({
  kind: z.literal('date'),
  operator: z.enum(['equals', 'before', 'after']),
  value: isoDate,
});

export const ConditionSchema = z.union([
  textCondition,
  numberComparison,
  numberRange,
  singleSelectCondition,
  multiSelectCondition,
  dateCondition,
]);
export type Condition = z.infer<typeof ConditionSchema>;
export type ConditionOf<K extends ConditionKind> = Extract<Condition, { kind: K }>;

export const EFFECTS = ['show', 'hide', 'require', 'unrequire'] as const;
export type Effect = (typeof EFFECTS)[number];

export const RuleSchema = z.object({
  id: z.string().min(1),
  targetFieldId: z.string().min(1),
  condition: ConditionSchema,
  effect: z.enum(EFFECTS),
});
export type Rule = z.infer<typeof RuleSchema>;

export const VISIBILITY_EFFECTS: readonly Effect[] = ['show', 'hide'];
export const REQUIRED_EFFECTS: readonly Effect[] = ['require', 'unrequire'];

interface OperatorOption {
  operator: Condition['operator'];
  label: string;
}

/** Operators offered per target kind — mirrors the table in the spec. */
export const OPERATORS_BY_KIND: Record<ConditionKind, readonly OperatorOption[]> = {
  text: [
    { operator: 'equals', label: 'equals' },
    { operator: 'notEquals', label: 'does not equal' },
    { operator: 'contains', label: 'contains' },
  ],
  number: [
    { operator: 'equals', label: 'equals' },
    { operator: 'greaterThan', label: 'is greater than' },
    { operator: 'lessThan', label: 'is less than' },
    { operator: 'withinRange', label: 'is within range' },
  ],
  singleSelect: [
    { operator: 'equals', label: 'equals' },
    { operator: 'notEquals', label: 'does not equal' },
  ],
  multiSelect: [
    { operator: 'containsAny', label: 'contains any of' },
    { operator: 'containsAll', label: 'contains all of' },
    { operator: 'containsNone', label: 'contains none of' },
  ],
  date: [
    { operator: 'equals', label: 'equals' },
    { operator: 'before', label: 'is before' },
    { operator: 'after', label: 'is after' },
  ],
};

export const EFFECT_LABELS: Record<Effect, string> = {
  show: 'Show this field',
  hide: 'Hide this field',
  require: 'Mark as required',
  unrequire: 'Mark as not required',
};

/** A blank, valid-shaped condition to seed the rule editor for a kind. */
export function defaultCondition(kind: ConditionKind): Condition {
  switch (kind) {
    case 'text':
      return { kind, operator: 'equals', value: '' };
    case 'number':
      return { kind, operator: 'equals', value: 0 };
    case 'singleSelect':
      return { kind, operator: 'equals', value: '' };
    case 'multiSelect':
      return { kind, operator: 'containsAny', value: [] };
    case 'date':
      return { kind, operator: 'equals', value: '' };
  }
}
