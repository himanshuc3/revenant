import { CalculatorOutlined } from '@ant-design/icons';
import { Alert, Input, Select } from 'antd';
import { ConfigItem } from '../configControls';
import { formatNumber } from '../format';
import type { FieldView } from '../viewTypes';
import { AGGREGATIONS, AGGREGATION_LABELS, type CalculationConfig } from './model';

export const calculationView: FieldView<CalculationConfig, number> = {
  icon: <CalculatorOutlined />,
  ConfigPanel: ({ config, onChange, fields }) => {
    // Only Number fields qualify — in particular never another Calculation.
    const sources = fields.filter((f) => f.type === 'number');
    return (
      <>
        {sources.length === 0 && (
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Add a Number field first to use it as a source." />
        )}
        <ConfigItem label="Source fields">
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Choose Number fields"
            value={config.sourceIds.filter((id) => sources.some((s) => s.id === id))}
            options={sources.map((s) => ({ value: s.id, label: s.label || 'Untitled' }))}
            onChange={(sourceIds: string[]) => onChange({ ...config, sourceIds })}
          />
        </ConfigItem>
        <ConfigItem label="Aggregation">
          <Select
            style={{ width: '100%' }}
            value={config.aggregation}
            options={AGGREGATIONS.map((a) => ({ value: a, label: AGGREGATION_LABELS[a] }))}
            onChange={(aggregation) => onChange({ ...config, aggregation })}
          />
        </ConfigItem>
        <ConfigItem label="Decimal places">
          <Select
            style={{ width: '100%' }}
            value={config.decimals}
            options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
            onChange={(decimals) => onChange({ ...config, decimals })}
          />
        </ConfigItem>
      </>
    );
  },
  Input: ({ config, value, inputId }) => (
    <Input
      id={inputId}
      readOnly
      tabIndex={-1}
      value={value === undefined ? '' : formatNumber(value, config.decimals)}
      placeholder="—"
      style={{ background: '#fafafa' }}
      suffix={AGGREGATION_LABELS[config.aggregation]}
    />
  ),
};
