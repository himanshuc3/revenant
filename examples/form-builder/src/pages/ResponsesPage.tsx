import { ArrowLeftOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, FileAddOutlined } from '@ant-design/icons';
import { App as AntApp, Button, Card, Empty, List, Popconfirm, Result, Space, Table, Tag, Typography } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createDraftInstance } from '../domain/instance';
import type { Instance } from '../domain/template';
import { printInstance } from '../print/printInstance';
import { repository, useInstances, useTemplates } from '../storage';
import { StorageError } from '../storage/repository';

const formatTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function ResponsesPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const template = useTemplates().items.find((t) => t.id === templateId);
  const { items } = useInstances(templateId);

  if (!template) {
    return (
      <Result
        status="404"
        title="Template not found"
        extra={
          <Link to="/">
            <Button type="primary">Back to templates</Button>
          </Link>
        }
      />
    );
  }

  const submitted = items
    .filter((i) => i.status === 'submitted')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const drafts = items.filter((i) => i.status === 'draft');

  function download(instance: Instance) {
    try {
      printInstance(instance);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not open the print preview');
    }
  }

  function newResponse() {
    if (!template) return;
    try {
      navigate(`/fill/${repository.saveInstance(createDraftInstance(template)).id}`);
    } catch (err) {
      message.error(err instanceof StorageError ? err.message : 'Could not start a new response');
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 8 }}>
        Templates
      </Button>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {template.title || 'Untitled form'}
          </Typography.Title>
          <Typography.Text type="secondary">Responses</Typography.Text>
        </div>
        <Button type="primary" icon={<FileAddOutlined />} onClick={newResponse}>
          New Response
        </Button>
      </Space>

      <Card title={`Submitted (${submitted.length})`} style={{ marginBottom: 16 }}>
        <Table<Instance>
          rowKey="id"
          dataSource={submitted}
          pagination={submitted.length > 10 ? { pageSize: 10 } : false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No submitted responses yet" /> }}
          columns={[
            { title: 'Submitted', key: 'submittedAt', render: (_, i) => formatTime(i.submittedAt ?? i.updatedAt) },
            {
              title: '',
              key: 'actions',
              align: 'right',
              render: (_, i) => (
                <Space>
                  <Link to={`/fill/${i.id}`}>
                    <Button size="small" icon={<EyeOutlined />}>
                      View
                    </Button>
                  </Link>
                  <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => download(i)}>
                    Re-download PDF
                  </Button>
                  <Popconfirm
                    title="Delete this response?"
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => repository.deleteInstance(i.id)}
                  >
                    <Button size="small" danger aria-label="Delete response" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {drafts.length > 0 && (
        <Card title={`In progress (${drafts.length})`}>
          <List
            dataSource={drafts}
            renderItem={(d) => (
              <List.Item
                actions={[
                  <Link key="resume" to={`/fill/${d.id}`}>
                    Resume
                  </Link>,
                  <Popconfirm
                    key="delete"
                    title="Discard this draft?"
                    okText="Discard"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => repository.deleteInstance(d.id)}
                  >
                    <Button type="link" danger size="small">
                      Discard
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <Space>
                  <Tag>Draft</Tag>
                  <Typography.Text type="secondary">Last edited {formatTime(d.updatedAt)}</Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
}
