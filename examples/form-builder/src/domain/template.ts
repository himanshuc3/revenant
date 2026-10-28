import { z } from 'zod';
import { isFieldType, modelForType, modelOf, type FieldConfig, type FieldValue } from '../fields/models';
import { newId } from './ids';

export const SCHEMA_VERSION = 1;

/** A field config, validated by the schema its own type registered. */
export const FieldConfigSchema = z.unknown().transform((raw, ctx): FieldConfig => {
  const type = typeof raw === 'object' && raw !== null ? (raw as { type?: unknown }).type : undefined;
  if (!isFieldType(type)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown field type: ${String(type)}` });
    return z.NEVER;
  }
  const parsed = modelForType(type).configSchema.safeParse(raw);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => ctx.addIssue(issue));
    return z.NEVER;
  }
  return parsed.data as FieldConfig;
});

export const TemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(FieldConfigSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.literal(SCHEMA_VERSION),
});
export type Template = z.infer<typeof TemplateSchema>;

export type Values = Record<string, FieldValue>;

/** Keeps only values that are valid for their field; drops unknown ids and bad shapes. */
export function sanitizeValues(fields: readonly FieldConfig[], raw: unknown): Values {
  const out: Values = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const source = raw as Record<string, unknown>;
  for (const field of fields) {
    const model = modelOf(field);
    if (model.behaviour !== 'input') continue;
    const candidate = source[field.id];
    if (candidate === undefined) continue;
    const parsed = model.valueSchema.safeParse(candidate);
    if (parsed.success && parsed.data !== undefined) out[field.id] = parsed.data as FieldValue;
  }
  return out;
}

export const InstanceSchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    status: z.enum(['draft', 'submitted']),
    /** Frozen copy of the template at creation, so later edits never alter old responses. */
    templateSnapshot: TemplateSchema,
    values: z.record(z.unknown()),
    createdAt: z.string(),
    updatedAt: z.string(),
    submittedAt: z.string().optional(),
  })
  .transform((inst) => ({
    ...inst,
    values: sanitizeValues(inst.templateSnapshot.fields, inst.values),
  }));
export type Instance = z.infer<typeof InstanceSchema>;

export function createTemplate(): Template {
  const now = new Date().toISOString();
  return {
    id: newId(),
    title: 'Untitled form',
    description: '',
    fields: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function createField<K extends FieldConfig['type']>(type: K): ReturnType<ReturnType<typeof modelForType<K>>['createDefault']> {
  return modelForType(type).createDefault(newId()) as ReturnType<ReturnType<typeof modelForType<K>>['createDefault']>;
}
