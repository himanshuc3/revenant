import { z } from 'zod';
import { baseFieldShape, checkOptions, checkOrdered, optionalCount, OptionSchema } from '../../domain/field';
import { newId } from '../../domain/ids';
import { defineModel } from '../define';

const schema = z
  .object({
    ...baseFieldShape,
    type: z.literal('multiSelect'),
    required: z.boolean(),
    options: z.array(OptionSchema).min(1, 'Add at least one option'),
    minSelections: optionalCount(0),
    maxSelections: optionalCount(1),
  })
  .superRefine((c, ctx) => {
    checkOptions(ctx, c.options);
    checkOrdered(ctx, c.minSelections, c.maxSelections, 'maxSelections', 'Max selections must be ≥ min selections');
    if (c.minSelections !== undefined && c.minSelections > c.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minSelections'],
        message: 'Min selections exceeds the number of options',
      });
    }
  });

export type MultiSelectConfig = z.infer<typeof schema>;

export const multiSelectModel = defineModel<MultiSelectConfig, string[]>({
  type: 'multiSelect',
  title: 'Multi Select',
  description: 'Pick several options',
  behaviour: 'input',
  conditionKind: 'multiSelect',
  configSchema: schema,
  valueSchema: z.array(z.string()),
  createDefault: (id) => ({
    id,
    type: 'multiSelect',
    label: 'Multi select',
    visible: true,
    required: false,
    rules: [],
    options: [
      { id: newId(), label: 'Option 1' },
      { id: newId(), label: 'Option 2' },
      { id: newId(), label: 'Option 3' },
    ],
  }),
  isEmpty: (v) => v === undefined || v.length === 0,
  validateValue: (c, v) => {
    if (v.some((id) => !c.options.some((o) => o.id === id))) return 'Choose only from the available options';
    if (c.minSelections !== undefined && v.length < c.minSelections) {
      return `Select at least ${c.minSelections}`;
    }
    if (c.maxSelections !== undefined && v.length > c.maxSelections) {
      return `Select at most ${c.maxSelections}`;
    }
    return null;
  },
  format: (c, v) => v.map((id) => c.options.find((o) => o.id === id)?.label ?? id),
});
