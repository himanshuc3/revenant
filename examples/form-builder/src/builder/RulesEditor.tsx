import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Empty, Input, InputNumber, Select, Space, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import {
  defaultCondition,
  EFFECT_LABELS,
  EFFECTS,
  OPERATORS_BY_KIND,
  type Condition,
  type ConditionOf,
  type Effect,
  type Rule,
} from '../domain/conditions';
import { newId } from '../domain/ids';
import { modelOf, type FieldConfig } from '../fields/models';
import { findCycle } from '../logic/graph';

const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Re-shapes a condition's value when the operator changes (e.g. into / out of
 * "within range"). The operator is checked against the kind's table first, so
 * the per-kind narrowing below is backed by a runtime guarantee.
 */
function withOperator(condition: Condition, operator: string): Condition {
  if (!OPERATORS_BY_KIND[condition.kind].some((o) => o.operator === operator)) return condition;
  switch (condition.kind) {
    case 'number': {
      const current = typeof condition.value === 'number' ? condition.value : condition.value.min;
      return operator === 'withinRange'
        ? { kind: 'number', operator, value: { min: current, max: current } }
        : { kind: 'number', operator: operator as ConditionOf<'number'>['operator'] & ('equals' | 'greaterThan' | 'lessThan'), value: current };
    }
    case 'text':
      return { ...condition, operator: operator as ConditionOf<'text'>['operator'] };
    case 'singleSelect':
      return { ...condition, operator: operator as ConditionOf<'singleSelect'>['operator'] };
    case 'multiSelect':
      return { ...condition, operator: operator as ConditionOf<'multiSelect'>['operator'] };
    case 'date':
      return { ...condition, operator: operator as ConditionOf<'date'>['operator'] };
  }
}

function ValueEditor({
  condition,
  target,
  onChange,
}: {
  condition: Condition;
  target: FieldConfig | undefined;
  onChange: (c: Condition) => void;
}) {
  switch (condition.kind) {
    case 'text':
      return (
        <Input
          aria-label="Value"
          placeholder="Value"
          value={condition.value}
          status={condition.value.trim() === '' ? 'error' : undefined}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />
      );
    case 'number':
      if (condition.operator === 'withinRange') {
        const range = condition.value;
        return (
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              aria-label="Range minimum"
              placeholder="Min"
              style={{ width: '50%' }}
              value={range.min}
              onChange={(v) => onChange({ ...condition, value: { ...range, min: v ?? 0 } })}
            />
            <InputNumber
              aria-label="Range maximum"
              placeholder="Max"
              style={{ width: '50%' }}
              value={range.max}
              status={range.min > range.max ? 'error' : undefined}
              onChange={(v) => onChange({ ...condition, value: { ...range, max: v ?? 0 } })}
            />
          </Space.Compact>
        );
      }
      return (
        <InputNumber
          aria-label="Value"
          style={{ width: '100%' }}
          value={condition.value as number}
          onChange={(v) => onChange({ ...condition, value: v ?? 0 } as Condition)}
        />
      );
    case 'singleSelect': {
      const options = target?.type === 'singleSelect' ? target.options : [];
      return (
        <Select
          aria-label="Value"
          style={{ width: '100%' }}
          placeholder="Choose an option"
          value={condition.value || undefined}
          options={options.map((o) => ({ value: o.id, label: o.label }))}
          onChange={(value: string) => onChange({ ...condition, value })}
        />
      );
    }
    case 'multiSelect': {
      const options = target?.type === 'multiSelect' ? target.options : [];
      return (
        <Select
          aria-label="Value"
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="Choose options"
          value={condition.value}
          options={options.map((o) => ({ value: o.id, label: o.label }))}
          onChange={(value: string[]) => onChange({ ...condition, value })}
        />
      );
    }
    case 'date':
      return (
        <DatePicker
          aria-label="Value"
          style={{ width: '100%' }}
          value={condition.value ? dayjs(condition.value, DATE_FORMAT, true) : null}
          onChange={(d) => onChange({ ...condition, value: d ? d.format(DATE_FORMAT) : '' })}
        />
      );
  }
}

/** Would pointing `field` at `targetId` create a dependency loop? */
function wouldCreateCycle(fields: readonly FieldConfig[], field: FieldConfig, targetId: string): boolean {
  const probe: Rule = {
    id: 'probe',
    targetFieldId: targetId,
    effect: 'show',
    condition: defaultCondition('text'),
  };
  return findCycle(fields.map((f) => (f.id === field.id ? { ...f, rules: [...f.rules, probe] } : f))) !== null;
}

export function RulesEditor({
  field,
  fields,
  onChange,
}: {
  field: FieldConfig;
  fields: readonly FieldConfig[];
  onChange: (field: FieldConfig) => void;
}) {
  const behaviour = modelOf(field).behaviour;
  // Fields that can't be marked required only get show/hide effects.
  const effects: readonly Effect[] = behaviour === 'input' ? EFFECTS : ['show', 'hide'];

  // A field can never target itself, nor a field whose chain leads back to it.
  const candidates = fields.filter((f) => f.id !== field.id && modelOf(f).conditionKind !== null);
  const usable = candidates.filter((f) => !wouldCreateCycle(fields, field, f.id));

  const setRules = (rules: Rule[]) => onChange({ ...field, rules });
  const update = (id: string, patch: Partial<Rule>) =>
    setRules(field.rules.map((r) => (r.id === id ? ({ ...r, ...patch } as Rule) : r)));

  function addRule() {
    const target = usable[0];
    const kind = target ? modelOf(target).conditionKind : null;
    if (!target || !kind) return;
    setRules([...field.rules, { id: newId(), targetFieldId: target.id, effect: 'show', condition: defaultCondition(kind) }]);
  }

  function changeTarget(rule: Rule, targetId: string) {
    const target = fields.find((f) => f.id === targetId);
    const kind = target ? modelOf(target).conditionKind : null;
    if (!kind) return;
    // Same kind keeps the operator, but select values refer to the old target's options.
    const keepsShape = kind === rule.condition.kind && kind !== 'singleSelect' && kind !== 'multiSelect';
    update(rule.id, { targetFieldId: targetId, condition: keepsShape ? rule.condition : defaultCondition(kind) });
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Rules run top to bottom. If several match, the last one wins. With no match, the default state applies.
        A rule never matches while the field it checks is hidden or empty.
      </Typography.Text>

      {field.rules.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No rules" />}

      {field.rules.map((rule, i) => {
        const target = fields.find((f) => f.id === rule.targetFieldId);
        const kind = rule.condition.kind;
        return (
          <Card
            key={rule.id}
            size="small"
            title={`Rule ${i + 1}`}
            extra={
              <Button
                size="small"
                type="text"
                danger
                aria-label={`Remove rule ${i + 1}`}
                icon={<DeleteOutlined />}
                onClick={() => setRules(field.rules.filter((r) => r.id !== rule.id))}
              />
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Select
                aria-label="Field to check"
                style={{ width: '100%' }}
                value={target ? rule.targetFieldId : undefined}
                placeholder="When this field…"
                options={candidates.map((f) => {
                  const loop = !usable.includes(f) && f.id !== rule.targetFieldId;
                  return { value: f.id, label: loop ? `${f.label} (would loop)` : f.label, disabled: loop };
                })}
                onChange={(id: string) => changeTarget(rule, id)}
              />
              <Select
                aria-label="Operator"
                style={{ width: '100%' }}
                value={rule.condition.operator}
                options={OPERATORS_BY_KIND[kind].map((o) => ({ value: o.operator, label: o.label }))}
                onChange={(operator: string) =>
                  update(rule.id, { condition: withOperator(rule.condition, operator) })
                }
              />
              <ValueEditor
                condition={rule.condition}
                target={target}
                onChange={(condition) => update(rule.id, { condition })}
              />
              <Select
                aria-label="Effect"
                style={{ width: '100%' }}
                value={rule.effect}
                options={effects.map((e) => ({ value: e, label: `Then: ${EFFECT_LABELS[e]}` }))}
                onChange={(effect: Effect) => update(rule.id, { effect })}
              />
            </Space>
          </Card>
        );
      })}

      <Tooltip title={usable.length === 0 ? 'Add another field this one can depend on first' : undefined}>
        <span>
          <Button block type="dashed" icon={<PlusOutlined />} disabled={usable.length === 0} onClick={addRule}>
            Add rule
          </Button>
        </span>
      </Tooltip>
    </Space>
  );
}
