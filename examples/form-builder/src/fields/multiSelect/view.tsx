import { CheckSquareOutlined } from '@ant-design/icons';
import { Checkbox, Space } from 'antd';
import { ConfigItem, OptionalNumber, OptionsEditor } from '../configControls';
import type { FieldView } from '../viewTypes';
import type { MultiSelectConfig } from './model';

export const multiSelectView: FieldView<MultiSelectConfig, string[]> = {
  icon: <CheckSquareOutlined />,
  ConfigPanel: ({ config, onChange }) => (
    <>
      <ConfigItem label="Options">
        <OptionsEditor options={config.options} onChange={(options) => onChange({ ...config, options })} />
      </ConfigItem>
      <ConfigItem label="Min selections">
        <OptionalNumber
          min={0}
          precision={0}
          placeholder="No minimum"
          value={config.minSelections}
          onChange={(minSelections) => onChange({ ...config, minSelections })}
        />
      </ConfigItem>
      <ConfigItem label="Max selections">
        <OptionalNumber
          min={1}
          precision={0}
          placeholder="No maximum"
          value={config.maxSelections}
          onChange={(maxSelections) => onChange({ ...config, maxSelections })}
        />
      </ConfigItem>
    </>
  ),
  Input: ({ config, value, onChange, disabled }) => (
    <Checkbox.Group
      value={value ?? []}
      disabled={disabled}
      onChange={(checked) => onChange(checked.length > 0 ? (checked as string[]) : undefined)}
    >
      <Space direction="vertical">
        {config.options.map((o) => (
          <Checkbox key={o.id} value={o.id}>
            {o.label}
          </Checkbox>
        ))}
      </Space>
    </Checkbox.Group>
  ),
};
