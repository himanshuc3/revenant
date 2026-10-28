import { Alert, Empty, Form, Input, Switch, Tabs, Tag } from 'antd';
import { ConfigItem } from '../fields/configControls';
import { modelOf, type FieldConfig } from '../fields/models';
import { viewOf } from '../fields/views';
import type { TemplateIssue } from '../logic/template';
import { RulesEditor } from './RulesEditor';

interface ConfigPanelProps {
  field: FieldConfig | undefined;
  fields: readonly FieldConfig[];
  issues: readonly TemplateIssue[];
  onChange: (field: FieldConfig) => void;
}

export function ConfigPanel({ field, fields, issues, onChange }: ConfigPanelProps) {
  if (!field) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a field to configure it" style={{ marginTop: 60 }} />;
  }
  const model = modelOf(field);
  const TypeSettings = viewOf(field).ConfigPanel;
  const mine = issues.filter((i) => i.fieldId === field.id);
  const hasRules = field.rules.length > 0;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Tag color="purple">{model.title}</Tag>
      </div>

      {mine.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="Fix before saving"
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {mine.map((i, idx) => (
                <li key={idx}>{i.message}</li>
              ))}
            </ul>
          }
        />
      )}

      {/* keyed by field so switching selection resets any panel-local state */}
      <Tabs
        key={field.id}
        size="small"
        items={[
          {
            key: 'settings',
            label: 'Settings',
            children: (
              <Form layout="vertical" component="div">
                <ConfigItem label="Label">
                  <Input
                    value={field.label}
                    status={field.label.trim() === '' ? 'error' : undefined}
                    onChange={(e) => onChange({ ...field, label: e.target.value })}
                  />
                </ConfigItem>
                {model.behaviour === 'input' && (
                  <ConfigItem label="Required" inline>
                    <Switch
                      checked={field.required}
                      onChange={(required) => onChange({ ...field, required } as FieldConfig)}
                    />
                  </ConfigItem>
                )}
                <TypeSettings config={field} onChange={onChange} fields={fields} />
              </Form>
            ),
          },
          {
            key: 'logic',
            label: hasRules ? `Logic (${field.rules.length})` : 'Logic',
            children: (
              <Form layout="vertical" component="div">
                <ConfigItem label="Visible by default" inline>
                  <Switch checked={field.visible} onChange={(visible) => onChange({ ...field, visible })} />
                </ConfigItem>
                {model.behaviour === 'input' && (
                  <p style={{ marginTop: -4, fontSize: 12, color: '#8c8c8c' }}>
                    "Required" on the Settings tab is the default required state.
                  </p>
                )}
                <RulesEditor field={field} fields={fields} onChange={onChange} />
              </Form>
            ),
          },
        ]}
      />
    </div>
  );
}
