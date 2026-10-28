import { CheckCircleOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Radio, Segmented, Select, Space } from 'antd';
import { ConfigItem, OptionsEditor } from '../configControls';
import type { FieldView, InputProps } from '../viewTypes';
import type { SelectDisplay, SingleSelectConfig } from './model';

const DISPLAY_LABELS: Record<SelectDisplay, string> = { radio: 'Radio', dropdown: 'Dropdown', tiles: 'Tiles' };

/**
 * All three display types share this one component's value handling — they only
 * differ in the control that renders the options — so selection, clearing and
 * required-validation behave identically by construction.
 */
function SingleSelectInput({ config, value, onChange, disabled, hasError, inputId }: InputProps<SingleSelectConfig, string>) {
  const selected = config.options.some((o) => o.id === value) ? value : undefined;

  let control;
  switch (config.display) {
    case 'dropdown':
      control = (
        <Select
          id={inputId}
          style={{ width: '100%' }}
          value={selected}
          placeholder="Select an option"
          disabled={disabled}
          status={hasError ? 'error' : undefined}
          options={config.options.map((o) => ({ value: o.id, label: o.label }))}
          onChange={(v: string) => onChange(v)}
        />
      );
      break;
    case 'tiles':
      control = (
        <Flex wrap gap={8} role="radiogroup" id={inputId}>
          {config.options.map((o) => {
            const active = o.id === selected;
            return (
              <Card
                key={o.id}
                size="small"
                hoverable={!disabled}
                role="radio"
                aria-checked={active}
                tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && onChange(o.id)}
                onKeyDown={(e) => {
                  if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onChange(o.id);
                  }
                }}
                style={{
                  minWidth: 120,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  borderColor: active ? '#4f46e5' : hasError ? '#ff4d4f' : undefined,
                  background: active ? '#eef2ff' : undefined,
                }}
              >
                <Space>
                  {active && <CheckCircleOutlined style={{ color: '#4f46e5' }} />}
                  {o.label}
                </Space>
              </Card>
            );
          })}
        </Flex>
      );
      break;
    case 'radio':
      control = (
        <Radio.Group
          id={inputId}
          value={selected}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as string)}
        >
          <Space direction="vertical">
            {config.options.map((o) => (
              <Radio key={o.id} value={o.id}>
                {o.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      );
      break;
  }

  return (
    <div>
      {control}
      {selected !== undefined && !disabled && (
        <Button type="link" size="small" style={{ paddingLeft: 0 }} onClick={() => onChange(undefined)}>
          Clear selection
        </Button>
      )}
    </div>
  );
}

export const singleSelectView: FieldView<SingleSelectConfig, string> = {
  icon: <CheckCircleOutlined />,
  ConfigPanel: ({ config, onChange }) => (
    <>
      <ConfigItem label="Display as">
        <Segmented
          block
          value={config.display}
          options={(Object.keys(DISPLAY_LABELS) as SelectDisplay[]).map((d) => ({ value: d, label: DISPLAY_LABELS[d] }))}
          onChange={(display) => onChange({ ...config, display })}
        />
      </ConfigItem>
      <ConfigItem label="Options">
        <OptionsEditor options={config.options} onChange={(options) => onChange({ ...config, options })} />
      </ConfigItem>
    </>
  ),
  Input: SingleSelectInput,
};
