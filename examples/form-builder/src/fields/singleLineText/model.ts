import { z } from 'zod';
import { baseFieldShape, checkOrdered, optionalCount } from '../../domain/field';
import { defineModel } from '../define';

const schema = z
  .object({
    ...baseFieldShape,
    type: z.literal('singleLineText'),
    required: z.boolean(),
    placeholder: z.string(),
    minLength: optionalCount(0),
    maxLength: optionalCount(1),
    prefix: z.string(),
    suffix: z.string(),
  })
  .superRefine((c, ctx) =>
    checkOrdered(ctx, c.minLength, c.maxLength, 'maxLength', 'Max length must be ≥ min length'),
  );

export type SingleLineTextConfig = z.infer<typeof schema>;

export const singleLineTextModel = defineModel<SingleLineTextConfig, string>({
  type: 'singleLineText',
  title: 'Single Line Text',
  description: 'A short, one-line answer',
  behaviour: 'input',
  conditionKind: 'text',
  configSchema: schema,
  valueSchema: z.string(),
  createDefault: (id) => ({
    id,
    type: 'singleLineText',
    label: 'Single line text',
    visible: true,
    required: false,
    rules: [],
    placeholder: '',
    prefix: '',
    suffix: '',
  }),
  isEmpty: (v) => v === undefined || v.trim() === '',
  validateValue: (c, v) => {
    const len = v.length;
    if (c.minLength !== undefined && len < c.minLength) return `Enter at least ${c.minLength} characters`;
    if (c.maxLength !== undefined && len > c.maxLength) return `Enter at most ${c.maxLength} characters`;
    return null;
  },
  format: (c, v) => [`${c.prefix}${v}${c.suffix}`],
});
