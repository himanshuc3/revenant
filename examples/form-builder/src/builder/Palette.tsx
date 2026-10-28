import { Card, List, Typography } from 'antd';
import { FIELD_TYPES, modelForType, type FieldType } from '../fields/models';
import { viewRegistry } from '../fields/views';

export function Palette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <Card size="small" title="Field types" styles={{ body: { padding: 0 } }} style={{ height: '100%', overflow: 'auto' }}>
      <List
        dataSource={FIELD_TYPES}
        renderItem={(type) => {
          const model = modelForType(type);
          return (
            <List.Item
              role="button"
              tabIndex={0}
              aria-label={`Add ${model.title}`}
              style={{ cursor: 'pointer', padding: '10px 16px' }}
              onClick={() => onAdd(type)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAdd(type);
                }
              }}
            >
              <List.Item.Meta
                avatar={<span style={{ fontSize: 18, color: '#4f46e5' }}>{viewRegistry[type].icon}</span>}
                title={model.title}
                description={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{model.description}</Typography.Text>}
              />
            </List.Item>
          );
        }}
      />
    </Card>
  );
}
