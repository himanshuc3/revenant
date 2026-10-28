import { z } from 'zod';
import { baseFieldShape } from '../../domain/field';
import { defineModel } from '../define';

export const HEADER_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type HeaderSize = (typeof HEADER_SIZES)[number];

const schema = z.object({
  ...baseFieldShape,
  type: z.literal('sectionHeader'),
  /** A header captures nothing, so it can never be required. */
  required: z.literal(false),
  size: z.enum(HEADER_SIZES),
});

export type SectionHeaderConfig = z.infer<typeof schema>;

export const sectionHeaderModel = defineModel<SectionHeaderConfig, undefined>({
  type: 'sectionHeader',
  title: 'Section Header',
  description: 'A heading that groups fields',
  behaviour: 'display',
  conditionKind: null,
  configSchema: schema,
  valueSchema: z.undefined(),
  createDefault: (id) => ({
    id,
    type: 'sectionHeader',
    label: 'Section title',
    visible: true,
    required: false,
    rules: [],
    size: 'md',
  }),
  isEmpty: () => true,
  validateValue: () => null,
  format: () => [],
});
