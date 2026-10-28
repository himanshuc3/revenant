import { CalendarOutlined } from '@ant-design/icons';
import { DatePicker, Switch } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { ConfigItem } from '../configControls';
import type { FieldView } from '../viewTypes';
import type { DateConfig } from './model';

const FORMAT = 'YYYY-MM-DD';
const toDayjs = (iso: string | undefined): Dayjs | null => {
  if (!iso) return null;
  const d = dayjs(iso, FORMAT, true);
  return d.isValid() ? d : null;
};

export const dateView: FieldView<DateConfig, string> = {
  icon: <CalendarOutlined />,
  ConfigPanel: ({ config, onChange }) => (
    <>
      <ConfigItem label="Pre-fill with today's date" inline>
        <Switch checked={config.prefillToday} onChange={(prefillToday) => onChange({ ...config, prefillToday })} />
      </ConfigItem>
      <ConfigItem label="Min date">
        <DatePicker
          style={{ width: '100%' }}
          value={toDayjs(config.min)}
          onChange={(d) => onChange({ ...config, min: d ? d.format(FORMAT) : undefined })}
        />
      </ConfigItem>
      <ConfigItem label="Max date">
        <DatePicker
          style={{ width: '100%' }}
          value={toDayjs(config.max)}
          onChange={(d) => onChange({ ...config, max: d ? d.format(FORMAT) : undefined })}
        />
      </ConfigItem>
    </>
  ),
  Input: ({ config, value, onChange, disabled, hasError, inputId }) => (
    <DatePicker
      id={inputId}
      style={{ width: '100%' }}
      value={toDayjs(value)}
      disabled={disabled}
      status={hasError ? 'error' : undefined}
      disabledDate={(d) => {
        const iso = d.format(FORMAT);
        return (config.min !== undefined && iso < config.min) || (config.max !== undefined && iso > config.max);
      }}
      onChange={(d) => onChange(d ? d.format(FORMAT) : undefined)}
    />
  ),
};
