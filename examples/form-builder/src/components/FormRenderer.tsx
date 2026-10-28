import { Form } from 'antd';
import type { Values } from '../domain/template';
import { modelOf, type FieldConfig, type FieldValue } from '../fields/models';
import { viewOf } from '../fields/views';
import type { FieldErrors } from '../logic/validate';
import type { FormState } from '../logic/resolve';

export interface FormRendererProps {
  fields: readonly FieldConfig[];
  /** Raw values keyed by field id. */
  values: Values;
  /** Resolved visibility / required / computed values (see `resolveForm`). */
  state: FormState;
  /** Errors to display (the caller decides when they become visible). */
  errors: FieldErrors;
  onChange: (fieldId: string, value: FieldValue | undefined) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * Renders a template. Purely presentational: all logic (visibility, required,
 * calculation) arrives via `state`, so Preview and Fill Mode share this verbatim.
 */
export function FormRenderer({ fields, values, state, errors, onChange, disabled, idPrefix = 'f' }: FormRendererProps) {
  return (
    <Form layout="vertical" requiredMark component="div">
      {fields.map((field) => {
        const s = state[field.id];
        if (!s?.visible) return null;
        const behaviour = modelOf(field).behaviour;
        const View = viewOf(field).Input;
        const inputId = `${idPrefix}-${field.id}`;
        const error = errors[field.id];

        if (behaviour === 'display') {
          return (
            <div key={field.id} style={{ margin: '20px 0 8px' }}>
              <View
                config={field}
                value={undefined}
                onChange={() => undefined}
                required={false}
                inputId={inputId}
              />
            </div>
          );
        }

        const value = behaviour === 'computed' ? s.value : values[field.id];
        return (
          <Form.Item
            key={field.id}
            label={field.label}
            htmlFor={inputId}
            required={s.required}
            validateStatus={error ? 'error' : undefined}
            help={error}
          >
            <View
              config={field}
              value={value}
              onChange={(v) => onChange(field.id, v)}
              required={s.required}
              disabled={disabled}
              hasError={Boolean(error)}
              inputId={inputId}
            />
          </Form.Item>
        );
      })}
    </Form>
  );
}
