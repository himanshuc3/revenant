import { z } from 'zod';
import { isoDate } from '../../domain/conditions';
import { baseFieldShape } from '../../domain/field';
import { defineModel } from '../define';
import { formatIsoDate } from '../format';

const schema = z
  .object({
    ...baseFieldShape,
    type: z.literal('date'),
    required: z.boolean(),
    prefillToday: z.boolean(),
    min: isoDate.optional(),
    max: isoDate.optional(),
  })
  .superRefine((c, ctx) => {
    if (c.min && c.max && c.min > c.max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['max'], message: 'Max date must not precede min date' });
    }
  });

export type DateConfig = z.infer<typeof schema>;

export const dateModel = defineModel<DateConfig, string>({
  type: 'date',
  title: 'Date',
  description: 'A calendar date',
  behaviour: 'input',
  conditionKind: 'date',
  configSchema: schema,
  valueSchema: isoDate,
  createDefault: (id) => ({
    id,
    type: 'date',
    label: 'Date',
    visible: true,
    required: false,
    rules: [],
    prefillToday: false,
  }),
  initialValue: (c, today) => (c.prefillToday ? today : undefined),
  isEmpty: (v) => v === undefined || v === '',
  validateValue: (c, v) => {
    if (c.min && v < c.min) return `Date must be on or after ${formatIsoDate(c.min)}`;
    if (c.max && v > c.max) return `Date must be on or before ${formatIsoDate(c.max)}`;
    return null;
  },
  format: (_c, v) => [formatIsoDate(v)],
});
