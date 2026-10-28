import { z } from 'zod';
import { baseFieldShape, checkOrdered } from '../../domain/field';
import { defineModel } from '../define';
import { formatNumber, hasAtMostDecimals } from '../format';

const schema = z
  .object({
    ...baseFieldShape,
    type: z.literal('number'),
    required: z.boolean(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    decimals: z.number().int().min(0).max(4),
    prefix: z.string(),
    suffix: z.string(),
  })
  .superRefine((c, ctx) => checkOrdered(ctx, c.min, c.max, 'max', 'Max value must be ≥ min value'));

export type NumberConfig = z.infer<typeof schema>;

export const numberModel = defineModel<NumberConfig, number>({
  type: 'number',
  title: 'Number',
  description: 'A numeric value',
  behaviour: 'input',
  conditionKind: 'number',
  configSchema: schema,
  valueSchema: z.number().finite(),
  createDefault: (id) => ({
    id,
    type: 'number',
    label: 'Number',
    visible: true,
    required: false,
    rules: [],
    decimals: 0,
    prefix: '',
    suffix: '',
  }),
  isEmpty: (v) => v === undefined || Number.isNaN(v),
  validateValue: (c, v) => {
    if (c.min !== undefined && v < c.min) return `Must be at least ${c.min}`;
    if (c.max !== undefined && v > c.max) return `Must be at most ${c.max}`;
    if (!hasAtMostDecimals(v, c.decimals)) {
      return c.decimals === 0 ? 'Must be a whole number' : `At most ${c.decimals} decimal places`;
    }
    return null;
  },
  format: (c, v) => [formatNumber(v, c.decimals, c.prefix, c.suffix)],
});
