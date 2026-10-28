import { NumberOutlined } from '@ant-design/icons';
import { Input, InputNumber, Select } from 'antd';
import { ConfigItem, OptionalNumber } from '../configControls';
import type { FieldView } from '../viewTypes';
import type { NumberConfig } from './model';

export const numberView: FieldView<NumberConfig, number> = {
  icon: <NumberOutlined />,
  ConfigPanel: ({ config, onChange }) => (
    <>
      <ConfigItem label="Min value">
        <OptionalNumber placeholder="No minimum" value={config.min} onChange={(min) => onChange({ ...config, min })} />
      </ConfigItem>
      <ConfigItem label="Max value">
        <OptionalNumber placeholder="No maximum" value={config.max} onChange={(max) => onChange({ ...config, max })} />
      </ConfigItem>
      <ConfigItem label="Decimal places">
        <Select
          style={{ width: '100%' }}
          value={config.decimals}
          options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
          onChange={(decimals) => onChange({ ...config, decimals })}
        />
      </ConfigItem>
      <ConfigItem label="Prefix" help="e.g. $">
        <Input value={config.prefix} onChange={(e) => onChange({ ...config, prefix: e.target.value })} />
      </ConfigItem>
      <ConfigItem label="Suffix" help="e.g. kg">
        <Input value={config.suffix} onChange={(e) => onChange({ ...config, suffix: e.target.value })} />
      </ConfigItem>
    </>
  ),
  Input: ({ config, value, onChange, disabled, hasError, inputId }) => (
    <InputNumber
      id={inputId}
      style={{ width: '100%' }}
      value={value ?? null}
      precision={config.decimals}
      disabled={disabled}
      status={hasError ? 'error' : undefined}
      prefix={config.prefix || undefined}
      suffix={config.suffix || undefined}
      onChange={(v) => onChange(typeof v === 'number' ? v : undefined)}
    />
  ),
};
