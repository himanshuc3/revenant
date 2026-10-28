import { z } from 'zod';
import { baseFieldShape, checkOptions, OptionSchema } from '../../domain/field';
import { newId } from '../../domain/ids';
import { defineModel } from '../define';

export const SELECT_DISPLAYS = ['radio', 'dropdown', 'tiles'] as const;
export type SelectDisplay = (typeof SELECT_DISPLAYS)[number];

const schema = z
  .object({
    ...baseFieldShape,
    type: z.literal('singleSelect'),
    required: z.boolean(),
    options: z.array(OptionSchema).min(1, 'Add at least one option'),
    display: z.enum(SELECT_DISPLAYS),
  })
  .superRefine((c, ctx) => checkOptions(ctx, c.options));

export type SingleSelectConfig = z.infer<typeof schema>;

export const singleSelectModel = defineModel<SingleSelectConfig, string>({
  type: 'singleSelect',
  title: 'Single Select',
  description: 'Pick one option',
  behaviour: 'input',
  conditionKind: 'singleSelect',
  configSchema: schema,
  valueSchema: z.string(),
  createDefault: (id) => ({
    id,
    type: 'singleSelect',
    label: 'Single select',
    visible: true,
    required: false,
    rules: [],
    display: 'radio',
    options: [
      { id: newId(), label: 'Option 1' },
      { id: newId(), label: 'Option 2' },
    ],
  }),
  isEmpty: (v) => v === undefined || v === '',
  validateValue: (c, v) => (c.options.some((o) => o.id === v) ? null : 'Choose one of the available options'),
  format: (c, v) => [c.options.find((o) => o.id === v)?.label ?? v],
});
