import { Button, Empty, Modal, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { Template, Values } from '../domain/template';
import { createDraftInstance } from '../domain/instance';
import { resolveForm } from '../logic/resolve';
import { validateForm } from '../logic/validate';
import { FormRenderer } from './FormRenderer';

/** Lets a builder try the form as a respondent would. Nothing here is persisted. */
export function FormPreview({ template, open, onClose }: { template: Template; open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      title={`Preview — ${template.title || 'Untitled form'}`}
      destroyOnHidden
    >
      <PreviewBody template={template} />
    </Modal>
  );
}

function PreviewBody({ template }: { template: Template }) {
  const [values, setValues] = useState<Values>(() => createDraftInstance(template).values);
  const [checked, setChecked] = useState(false);
  const state = useMemo(() => resolveForm(template.fields, values), [template.fields, values]);
  const errors = useMemo(() => validateForm(template.fields, values, state), [template.fields, values, state]);
  const shown = checked ? errors : {};
  const errorCount = Object.keys(errors).length;

  if (template.fields.length === 0) return <Empty description="This form has no fields yet" />;

  return (
    <>
      <Typography.Paragraph type="secondary">
        This is a sandbox: answers are not saved.
      </Typography.Paragraph>
      <FormRenderer
        fields={template.fields}
        values={values}
        state={state}
        errors={shown}
        idPrefix="preview"
        onChange={(id, value) =>
          setValues((prev) => {
            const next = { ...prev };
            if (value === undefined) delete next[id];
            else next[id] = value;
            return next;
          })
        }
      />
      <Space>
        <Button type="primary" onClick={() => setChecked(true)}>
          Check validation
        </Button>
        <Button
          onClick={() => {
            setValues(createDraftInstance(template).values);
            setChecked(false);
          }}
        >
          Reset
        </Button>
        {checked && (
          <Typography.Text type={errorCount ? 'danger' : 'success'}>
            {errorCount ? `${errorCount} field${errorCount === 1 ? '' : 's'} need attention` : 'Looks good'}
          </Typography.Text>
        )}
      </Space>
    </>
  );
}
