import { FontColorsOutlined } from '@ant-design/icons';
import { Segmented, Typography } from 'antd';
import { ConfigItem } from '../configControls';
import type { FieldView } from '../viewTypes';
import { HEADER_SIZES, type HeaderSize, type SectionHeaderConfig } from './model';

/** Each size maps to a distinct heading level (XL = h1 … XS = h5). */
export const HEADER_LEVEL: Record<HeaderSize, 1 | 2 | 3 | 4 | 5> = { xl: 1, lg: 2, md: 3, sm: 4, xs: 5 };

export const sectionHeaderView: FieldView<SectionHeaderConfig, undefined> = {
  icon: <FontColorsOutlined />,
  ConfigPanel: ({ config, onChange }) => (
    <ConfigItem label="Size">
      <Segmented
        block
        value={config.size}
        options={HEADER_SIZES.map((s) => ({ value: s, label: s.toUpperCase() }))}
        onChange={(size) => onChange({ ...config, size })}
      />
    </ConfigItem>
  ),
  Input: ({ config }) => (
    <Typography.Title level={HEADER_LEVEL[config.size]} style={{ margin: 0 }}>
      {config.label}
    </Typography.Title>
  ),
};
