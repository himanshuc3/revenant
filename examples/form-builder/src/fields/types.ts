import type { z } from 'zod';
import type { ConditionKind } from '../domain/conditions';

/** Fields every config has, regardless of type. */
export interface BaseConfig {
  id: string;
  type: string;
  label: string;
  visible: boolean;
  required: boolean;
}

export type FieldBehaviour = 'input' | 'display' | 'computed';

/**
 * The React-free contract for a field type. Everything the engine, validator,
 * storage layer and PDF need to know about a type lives here; UI lives in `FieldView`.
 */
export interface FieldModel<C extends BaseConfig, V> {
  readonly type: C['type'];
  /** Palette name, e.g. "Single Line Text". */
  readonly title: string;
  readonly description: string;
  /** `input` captures a value, `display` captures none, `computed` derives one. */
  readonly behaviour: FieldBehaviour;
  /** Operator family other fields' rules can use against this field; null = not a rule target. */
  readonly conditionKind: ConditionKind | null;
  readonly configSchema: z.ZodType<C, z.ZodTypeDef, unknown>;
  readonly valueSchema: z.ZodType<V, z.ZodTypeDef, unknown>;
  createDefault(id: string): C;
  /** Value a brand-new instance starts with (e.g. today's date). */
  initialValue?(config: C, today: string): V | undefined;
  isEmpty(value: V | undefined): boolean;
  /** Validates a *non-empty* value against the config; returns a message or null. */
  validateValue(config: C, value: V): string | null;
  /** Human-readable lines for the PDF / summaries. */
  format(config: C, value: V): string[];
  /** Ids of other fields this field reads from (beyond its rules). */
  sourceIds?(config: C): readonly string[];
  /** Computes the value of a `computed` field from resolved source values. */
  compute?(config: C, resolve: (fieldId: string) => unknown): V | undefined;
}
