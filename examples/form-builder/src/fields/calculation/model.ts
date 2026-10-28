import { z } from 'zod';
import { baseFieldShape } from '../../domain/field';
import { defineModel } from '../define';
import { formatNumber, roundTo } from '../format';

export const AGGREGATIONS = ['sum', 'average', 'minimum', 'maximum'] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];

export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: 'Sum',
  average: 'Average',
  minimum: 'Minimum',
  maximum: 'Maximum',
};

const schema = z.object({
  ...baseFieldShape,
  type: z.literal('calculation'),
  /** Read-only, so never required. */
  required: z.literal(false),
  sourceIds: z.array(z.string().min(1)).min(1, 'Choose at least one Number field'),
  aggregation: z.enum(AGGREGATIONS),
  decimals: z.number().int().min(0).max(4),
});

export type CalculationConfig = z.infer<typeof schema>;

export function aggregate(aggregation: Aggregation, values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  switch (aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'average':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'minimum':
      return Math.min(...values);
    case 'maximum':
      return Math.max(...values);
  }
}

export const calculationModel = defineModel<CalculationConfig, number>({
  type: 'calculation',
  title: 'Calculation',
  description: 'Computed from Number fields',
  behaviour: 'computed',
  conditionKind: 'number',
  configSchema: schema,
  valueSchema: z.number().finite(),
  createDefault: (id) => ({
    id,
    type: 'calculation',
    label: 'Calculation',
    visible: true,
    required: false,
    rules: [],
    sourceIds: [],
    aggregation: 'sum',
    decimals: 2,
  }),
  isEmpty: (v) => v === undefined || Number.isNaN(v),
  validateValue: () => null,
  format: (c, v) => [formatNumber(v, c.decimals)],
  sourceIds: (c) => c.sourceIds,
  compute: (c, resolve) => {
    const nums = c.sourceIds
      .map(resolve)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const result = aggregate(c.aggregation, nums);
    return result === undefined ? undefined : roundTo(result, c.decimals);
  },
});
