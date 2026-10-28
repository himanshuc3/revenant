import { z } from 'zod';
import { baseFieldShape, checkOrdered, optionalCount } from '../../domain/field';
import { defineModel } from '../define';

const schema = z
  .object({
    ...baseFieldShape,
    type: z.literal('multiLineText'),
    required: z.boolean(),
    placeholder: z.string(),
    minLength: optionalCount(0),
    maxLength: optionalCount(1),
    rows: z.number().int().min(1).max(20),
  })
  .superRefine((c, ctx) =>
    checkOrdered(ctx, c.minLength, c.maxLength, 'maxLength', 'Max length must be ≥ min length'),
  );

export type MultiLineTextConfig = z.infer<typeof schema>;

export const multiLineTextModel = defineModel<MultiLineTextConfig, string>({
  type: 'multiLineText',
  title: 'Multi-line Text',
  description: 'A longer, multi-row answer',
  behaviour: 'input',
  conditionKind: 'text',
  configSchema: schema,
  valueSchema: z.string(),
  createDefault: (id) => ({
    id,
    type: 'multiLineText',
    label: 'Multi-line text',
    visible: true,
    required: false,
    rules: [],
    placeholder: '',
    rows: 4,
  }),
  isEmpty: (v) => v === undefined || v.trim() === '',
  validateValue: (c, v) => {
    if (c.minLength !== undefined && v.length < c.minLength) return `Enter at least ${c.minLength} characters`;
    if (c.maxLength !== undefined && v.length > c.maxLength) return `Enter at most ${c.maxLength} characters`;
    return null;
  },
  format: (_c, v) => v.split(/\r?\n/),
});
