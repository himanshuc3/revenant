import { ArrowLeftOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, App as AntApp, Button, Input, Result, Space } from 'antd';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { FormPreview } from '../components/FormPreview';
import { createTemplate, type Template } from '../domain/template';
import { validateTemplate } from '../logic/template';
import { repository } from '../storage';
import { StorageError } from '../storage/repository';
import { Canvas } from './Canvas';
import { ConfigPanel } from './ConfigPanel';
import { Palette } from './Palette';
import { builderReducer, initBuilderState } from './reducer';

/** Resolves `/builder/new` or `/builder/:id` to a template, then mounts the editor. */
export function BuilderRoute() {
  const { templateId } = useParams();
  const [blank] = useState(createTemplate);
  const isNew = templateId === 'new';
  // Once a new template is saved the URL switches to its id; `blank` keeps the same id so the editor isn't remounted.
  const stored = templateId && !isNew ? repository.getTemplate(templateId) : undefined;
  const initial = isNew ? blank : (stored ?? (templateId === blank.id ? blank : undefined));

  if (!initial) {
    return <Result status="404" title="Template not found" extra={<Link to="/">Back to templates</Link>} />;
  }
  return <Builder key={initial.id} initial={initial} isNew={isNew} />;
}

function Builder({ initial, isNew }: { initial: Template; isNew: boolean }) {
  const navigate = useNavigate();
  const { message, modal } = AntApp.useApp();
  const [state, dispatch] = useReducer(builderReducer, undefined, () => initBuilderState(initial, isNew));
  const [previewing, setPreviewing] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const { template, selectedId, dirty } = state;

  // Read by the navigation blocker; also flipped synchronously on save so the redirect isn't blocked.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const issues = useMemo(() => validateTemplate(template), [template]);
  const shownIssues = attemptedSave ? issues : [];
  const selected = template.fields.find((f) => f.id === selectedId);

  const blocker = useBlocker(() => dirtyRef.current);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const m = modal.confirm({
      title: 'Discard unsaved changes?',
      content: 'Your changes to this template have not been saved.',
      okText: 'Discard',
      okButtonProps: { danger: true },
      cancelText: 'Keep editing',
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
    return () => m.destroy();
  }, [blocker, modal]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  function save() {
    setAttemptedSave(true);
    if (issues.length > 0) {
      const firstWithField = issues.find((i) => i.fieldId);
      if (firstWithField?.fieldId) dispatch({ type: 'select', id: firstWithField.fieldId });
      message.error(`Fix ${issues.length} issue${issues.length === 1 ? '' : 's'} before saving`);
      return;
    }
    try {
      const saved = repository.saveTemplate(template);
      dirtyRef.current = false;
      dispatch({ type: 'saved', template: saved });
      message.success('Template saved');
      if (isNew) navigate(`/builder/${saved.id}`, { replace: true });
    } catch (err) {
      message.error(err instanceof StorageError ? err.message : 'Could not save the template');
    }
  }

  return (
    <div className="builder-root">
      <div className="builder-bar">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          Back
        </Button>
        <Input
          aria-label="Form title"
          placeholder="Form title"
          variant="borderless"
          size="large"
          style={{ fontWeight: 600, fontSize: 18, flex: 1 }}
          value={template.title}
          status={attemptedSave && template.title.trim() === '' ? 'error' : undefined}
          onChange={(e) => dispatch({ type: 'setTitle', title: e.target.value })}
        />
        <Space>
          {dirty && <span style={{ color: '#8c8c8c', fontSize: 12 }}>Unsaved changes</span>}
          <Button icon={<EyeOutlined />} onClick={() => setPreviewing(true)}>
            Preview
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={save}>
            Save
          </Button>
        </Space>
      </div>

      <div className="builder-grid">
        <Palette onAdd={(fieldType) => dispatch({ type: 'addField', fieldType, afterId: selectedId })} />
        <div style={{ overflow: 'auto', paddingRight: 4 }}>
          {shownIssues.length > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ maxWidth: 720, margin: '0 auto 12px' }}
              message={`${shownIssues.length} issue${shownIssues.length === 1 ? '' : 's'} to fix`}
              description={
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {shownIssues.map((i, idx) => (
                    <li key={idx}>{i.message}</li>
                  ))}
                </ul>
              }
            />
          )}
          <Canvas template={template} selectedId={selectedId} issues={shownIssues} dispatch={dispatch} />
        </div>
        <div className="builder-config">
          <ConfigPanel
            field={selected}
            fields={template.fields}
            issues={shownIssues}
            onChange={(field) => dispatch({ type: 'updateField', field })}
          />
        </div>
      </div>

      <FormPreview template={template} open={previewing} onClose={() => setPreviewing(false)} />
    </div>
  );
}
