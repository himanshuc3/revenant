import { ArrowLeftOutlined, CheckCircleFilled } from '@ant-design/icons';
import { Alert, App as AntApp, Button, Card, Result, Space, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FormRenderer } from '../components/FormRenderer';
import type { Instance, Values } from '../domain/template';
import { fillReducer, initFillState, visibleErrors } from '../fill/fillReducer';
import { resolveForm, submittableValues } from '../logic/resolve';
import { validateForm } from '../logic/validate';
import { printInstance } from '../print/printInstance';
import { repository, useInstance } from '../storage';
import { StorageError } from '../storage/repository';

const AUTOSAVE_MS = 500;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
}

export function FillPage() {
  const { instanceId } = useParams();
  const instance = useInstance(instanceId);

  if (!instance) {
    return (
      <Result
        status="404"
        title="Response not found"
        extra={
          <Link to="/">
            <Button type="primary">Back to templates</Button>
          </Link>
        }
      />
    );
  }
  return <FillForm key={instance.id} instance={instance} />;
}

type SaveState = 'idle' | 'saving' | 'saved';

function FillForm({ instance }: { instance: Instance }) {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const template = instance.templateSnapshot;
  const submitted = instance.status === 'submitted';

  const [fill, dispatch] = useReducer(fillReducer, instance.values, initFillState);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Everything the form shows is derived from the frozen snapshot + raw answers.
  const state = useMemo(() => resolveForm(template.fields, fill.values), [template.fields, fill.values]);
  const errors = useMemo(
    () => validateForm(template.fields, fill.values, state),
    [template.fields, fill.values, state],
  );

  // ---- autosave (drafts only) -------------------------------------------------
  const instanceRef = useRef(instance);
  const valuesRef = useRef<Values>(fill.values);
  const dirtyRef = useRef(false);
  useEffect(() => {
    instanceRef.current = instance;
  }, [instance]);

  const flush = useRef(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    try {
      repository.saveInstance({ ...instanceRef.current, values: valuesRef.current });
      setSaveState('saved');
    } catch (err) {
      dirtyRef.current = true;
      message.error(err instanceof StorageError ? err.message : 'Could not save your draft');
    }
  });

  const firstRun = useRef(true);
  useEffect(() => {
    valuesRef.current = fill.values;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (submitted) return;
    dirtyRef.current = true;
    const timer = setTimeout(() => flush.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [fill.values, submitted]);

  useEffect(() => {
    const save = flush.current;
    window.addEventListener('beforeunload', save);
    return () => {
      window.removeEventListener('beforeunload', save);
      save(); // leaving the page (Back, link, unmount) never loses the last keystrokes
    };
  }, []);

  // ---- submit -----------------------------------------------------------------
  function submit() {
    dispatch({ type: 'submitAttempted' });
    const count = Object.keys(errors).length;
    if (count > 0) {
      message.error(`Please fix ${count} field${count === 1 ? '' : 's'} before submitting`);
      // Wait for the errors to render, then bring the first one into view.
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>('.ant-form-item-has-error');
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        first?.querySelector<HTMLElement>('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true });
      });
      return;
    }
    try {
      dirtyRef.current = false; // the submitted copy supersedes any pending draft save
      repository.saveInstance({
        ...instance,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        // Only visible fields' values leave the form; hidden answers are discarded here.
        values: submittableValues(template.fields, state),
      });
      window.scrollTo({ top: 0 });
    } catch (err) {
      dirtyRef.current = true;
      message.error(err instanceof StorageError ? err.message : 'Could not submit the form');
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 8 }}>
        Templates
      </Button>

      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          {template.title || 'Untitled form'}
        </Typography.Title>
        {template.description && (
          <Typography.Paragraph type="secondary">{template.description}</Typography.Paragraph>
        )}

        {submitted && instance.submittedAt && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleFilled />}
            style={{ marginBottom: 16 }}
            message={`Submitted ${formatTimestamp(instance.submittedAt)}`}
            description="This response is saved and can no longer be edited."
          />
        )}

        <FormRenderer
          fields={template.fields}
          values={fill.values}
          state={state}
          errors={submitted ? {} : visibleErrors(fill, errors)}
          disabled={submitted}
          onChange={(fieldId, value) => {
            setSaveState('saving');
            dispatch({ type: 'set', fieldId, value });
          }}
        />

        {submitted ? (
          <Space wrap>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                try {
                  printInstance(instance);
                } catch (err) {
                  message.error(err instanceof Error ? err.message : 'Could not open the print preview');
                }
              }}
            >
              Download PDF
            </Button>
            <Link to={`/templates/${instance.templateId}/responses`}>
              <Button>View all responses</Button>
            </Link>
          </Space>
        ) : (
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button type="primary" size="large" onClick={submit}>
              Submit
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {saveState === 'saving' ? 'Saving draft…' : saveState === 'saved' ? 'Draft saved' : 'Changes save automatically'}
            </Typography.Text>
          </Space>
        )}
      </Card>
    </div>
  );
}
