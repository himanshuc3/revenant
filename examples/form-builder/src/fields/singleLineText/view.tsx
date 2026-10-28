import { FontSizeOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import { ConfigItem, OptionalNumber } from '../configControls';
import type { FieldView } from '../viewTypes';
import type { SingleLineTextConfig } from './model';

export const singleLineTextView: FieldView<SingleLineTextConfig, string> = {
  icon: <FontSizeOutlined />,
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
      <ConfigItem label="Prefix text" help="Shown before the input, e.g. https://">
        <Input value={config.prefix} onChange={(e) => onChange({ ...config, prefix: e.target.value })} />
      </ConfigItem>
      <ConfigItem label="Suffix text" help="Shown after the input, e.g. .com">
        <Input value={config.suffix} onChange={(e) => onChange({ ...config, suffix: e.target.value })} />
      </ConfigItem>
    </>
  ),
  Input: ({ config, value, onChange, disabled, hasError, inputId }) => (
    <Input
      id={inputId}
      value={value ?? ''}
      placeholder={config.placeholder}
      disabled={disabled}
      status={hasError ? 'error' : undefined}
      prefix={config.prefix || undefined}
      suffix={config.suffix || undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
};
