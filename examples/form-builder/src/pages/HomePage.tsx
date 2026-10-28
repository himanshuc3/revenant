import { DeleteOutlined, EditOutlined, FileAddOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App as AntApp, Button, Card, Col, Empty, Popconfirm, Row, Space, Tag, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { createDraftInstance } from '../domain/instance';
import type { Template } from '../domain/template';
import { modelOf } from '../fields/models';
import { repository, useInstances, useTemplates } from '../storage';
import { StorageError } from '../storage/repository';

/** Section headers are layout, not data, so they don't count toward "number of fields". */
export function countDataFields(template: Template): number {
  return template.fields.filter((f) => modelOf(f).behaviour !== 'display').length;
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

function formatModified(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function HomePage() {
  /**
   * Loading the local storage and saving state for new response in that,
   * instead of in-memory
   */
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { items: templates, skipped } = useTemplates();
  const { items: instances } = useInstances();

  const submittedCount = (templateId: string) =>
    instances.filter((i) => i.templateId === templateId && i.status === 'submitted').length;

  function newResponse(template: Template) {
    try {
      const draft = repository.saveInstance(createDraftInstance(template));
      navigate(`/fill/${draft.id}`);
    } catch (err) {
      message.error(err instanceof StorageError ? err.message : 'Could not start a new response');
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Templates
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/builder/new')}>
          New Template
        </Button>
      </Space>

      {skipped > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${skipped} saved item${skipped === 1 ? '' : 's'} could not be read and ${skipped === 1 ? 'was' : 'were'} skipped.`}
        />
      )}

      {templates.length === 0 ? (
        <Empty description="No templates yet" style={{ marginTop: 80 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/builder/new')}>
            Create your first template
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {templates.map((t) => {
            const responses = instances.filter((i) => i.templateId === t.id).length;
            return (
              <Col key={t.id} xs={24} sm={12} lg={8}>
                <Card
                  hoverable
                  onClick={() => navigate(`/builder/${t.id}`)}
                  actions={[
                    <Button
                      key="fill"
                      type="link"
                      size="small"
                      icon={<FileAddOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        newResponse(t);
                      }}
                    >
                      New Response
                    </Button>,
                    <Button key="edit" type="link" size="small" icon={<EditOutlined />}>
                      Edit
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="Delete this template?"
                      description={
                        responses > 0
                          ? `Its ${responses} response${responses === 1 ? '' : 's'} will be deleted too.`
                          : undefined
                      }
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        repository.deleteTemplate(t.id);
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>
                        Delete
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <Typography.Title level={5} ellipsis style={{ marginTop: 0 }}>
                    {t.title || 'Untitled form'}
                  </Typography.Title>
                  <Space size={[4, 8]} wrap>
                    <Tag>{plural(countDataFields(t), 'field')}</Tag>
                    <Link to={`/templates/${t.id}/responses`} onClick={(e) => e.stopPropagation()}>
                      <Tag color="blue" style={{ cursor: 'pointer' }}>
                        {submittedCount(t.id)} filled
                      </Tag>
                    </Link>
                  </Space>
                  <Typography.Paragraph type="secondary" style={{ margin: '12px 0 0', fontSize: 12 }}>
                    Modified {formatModified(t.updatedAt)}
                  </Typography.Paragraph>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
