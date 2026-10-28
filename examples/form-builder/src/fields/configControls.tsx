import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, InputNumber, Space } from 'antd';
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import type { Option } from '../domain/field';
import { newId } from '../domain/ids';

/**
 * Consistent label + control row used by every config panel. The control gets a
 * generated id and the label points at it, so labels are announced and clickable.
 */
export function ConfigItem({
  label,
  help,
  children,
  inline,
}: {
  label: ReactNode;
  help?: ReactNode;
  children: ReactNode;
  inline?: boolean;
}) {
  const id = useId();
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children;
  return (
    <Form.Item label={label} htmlFor={id} extra={help} style={{ marginBottom: 12 }} layout={inline ? 'horizontal' : 'vertical'}>
      {control}
    </Form.Item>
  );
}

/** An optional numeric setting: cleared input means "no limit". */
export function OptionalNumber({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = 'No limit',
  precision,
}: {
  id?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  precision?: number;
}) {
  return (
    <InputNumber
      id={id}
      style={{ width: '100%' }}
      value={value ?? null}
      min={min}
      max={max}
      precision={precision}
      placeholder={placeholder}
      onChange={(v) => onChange(typeof v === 'number' ? v : undefined)}
    />
  );
}

/** Edits an ordered list of options: rename, add, remove, reorder. */
export function OptionsEditor({
  options,
  onChange,
}: {
  options: readonly Option[];
  onChange: (options: Option[]) => void;
}) {
  const update = (i: number, label: string) =>
    onChange(options.map((o, idx) => (idx === i ? { ...o, label } : o)));
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));
  const move = (i: number, delta: -1 | 1) => {
    const next = [...options];
    const target = i + delta;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target]!, next[i]!];
    onChange(next);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={6}>
      {options.map((o, i) => (
        <Space.Compact key={o.id} style={{ width: '100%' }}>
          <Input
            value={o.label}
            aria-label={`Option ${i + 1}`}
            status={o.label.trim() === '' ? 'error' : undefined}
            onChange={(e) => update(i, e.target.value)}
          />
          <Button aria-label={`Move option ${i + 1} up`} icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, -1)} />
          <Button
            aria-label={`Move option ${i + 1} down`}
            icon={<ArrowDownOutlined />}
            disabled={i === options.length - 1}
            onClick={() => move(i, 1)}
          />
          <Button
            aria-label={`Remove option ${i + 1}`}
            icon={<DeleteOutlined />}
            danger
            disabled={options.length <= 1}
            onClick={() => remove(i)}
          />
        </Space.Compact>
      ))}
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => onChange([...options, { id: newId(), label: `Option ${options.length + 1}` }])}
      >
        Add option
      </Button>
    </Space>
  );
}
