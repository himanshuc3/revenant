import { AlignLeftOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import { ConfigItem, OptionalNumber } from '../configControls';
import type { FieldView } from '../viewTypes';
import type { MultiLineTextConfig } from './model';

export const multiLineTextView: FieldView<MultiLineTextConfig, string> = {
  icon: <AlignLeftOutlined />,
  ConfigPanel: ({ config, onChange }) => (
    <>
      <ConfigItem label="Placeholder">
        <Input value={config.placeholder} onChange={(e) => onChange({ ...config, placeholder: e.target.value })} />
      </ConfigItem>
      <ConfigItem label="Min length">
        <OptionalNumber min={0} value={config.minLength} onChange={(minLength) => onChange({ ...config, minLength })} />
      </ConfigItem>
      <ConfigItem label="Max length">
        <OptionalNumber min={1} value={config.maxLength} onChange={(maxLength) => onChange({ ...config, maxLength })} />
      </ConfigItem>
      <ConfigItem label="Visible rows">
        <OptionalNumber
          min={1}
          max={20}
          precision={0}
          value={config.rows}
          onChange={(rows) => onChange({ ...config, rows: rows ?? 4 })}
        />
      </ConfigItem>
    </>
  ),
  Input: ({ config, value, onChange, disabled, hasError, inputId }) => (
    <Input.TextArea
      id={inputId}
      rows={config.rows}
      value={value ?? ''}
      placeholder={config.placeholder}
      disabled={disabled}
      status={hasError ? 'error' : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
};
