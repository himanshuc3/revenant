import { describe, expect, it } from 'vitest';
import type { Condition } from '../domain/conditions';
import { createField } from '../domain/template';
import { evaluateCondition } from './conditions';
import { findCycle, evaluationOrder } from './graph';
import { resolveForm, submittableValues } from './resolve';
import { cleanReferences, validateTemplate } from './template';
import { num, rule, templateOf, text, withId } from './testing';
import { REQUIRED_MESSAGE, validateForm } from './validate';

describe('evaluateCondition', () => {
  const t = (operator: 'equals' | 'notEquals' | 'contains', value: string): Condition => ({ kind: 'text', operator, value });
  it('text operators are case/space-insensitive', () => {
    expect(evaluateCondition(t('equals', 'Yes'), ' yes ')).toBe(true);
    expect(evaluateCondition(t('notEquals', 'yes'), 'no')).toBe(true);
    expect(evaluateCondition(t('contains', 'ell'), 'Hello')).toBe(true);
    expect(evaluateCondition(t('contains', 'xyz'), 'Hello')).toBe(false);
  });

  it('never matches when the target has no value, even for negative operators', () => {
    expect(evaluateCondition(t('notEquals', 'yes'), undefined)).toBe(false);
    expect(evaluateCondition(t('notEquals', 'yes'), '  ')).toBe(false);
    expect(evaluateCondition({ kind: 'multiSelect', operator: 'containsNone', value: ['a'] }, [])).toBe(false);
    expect(evaluateCondition({ kind: 'singleSelect', operator: 'notEquals', value: 'a' }, undefined)).toBe(false);
  });

  it('number operators incl. inclusive range, and 0 is a real value', () => {
    const n = (operator: 'equals' | 'greaterThan' | 'lessThan', value: number): Condition => ({ kind: 'number', operator, value });
    expect(evaluateCondition(n('equals', 0), 0)).toBe(true);
    expect(evaluateCondition(n('greaterThan', 5), 5)).toBe(false);
    expect(evaluateCondition(n('lessThan', 5), 4.9)).toBe(true);
    const range: Condition = { kind: 'number', operator: 'withinRange', value: { min: 1, max: 3 } };
    expect([0, 1, 2, 3, 4].map((v) => evaluateCondition(range, v))).toEqual([false, true, true, true, false]);
  });

  it('multi select any / all / none', () => {
    const m = (operator: 'containsAny' | 'containsAll' | 'containsNone', value: string[]): Condition => ({ kind: 'multiSelect', operator, value });
    expect(evaluateCondition(m('containsAny', ['a', 'z']), ['a', 'b'])).toBe(true);
    expect(evaluateCondition(m('containsAll', ['a', 'z']), ['a', 'b'])).toBe(false);
    expect(evaluateCondition(m('containsAll', ['a', 'b']), ['a', 'b', 'c'])).toBe(true);
    expect(evaluateCondition(m('containsNone', ['x', 'y']), ['a', 'b'])).toBe(true);
    expect(evaluateCondition(m('containsNone', ['a']), ['a', 'b'])).toBe(false);
  });

  it('date equals / before / after', () => {
    const d = (operator: 'equals' | 'before' | 'after'): Condition => ({ kind: 'date', operator, value: '2026-06-15' });
    expect(evaluateCondition(d('equals'), '2026-06-15')).toBe(true);
    expect(evaluateCondition(d('before'), '2026-06-14')).toBe(true);
    expect(evaluateCondition(d('before'), '2026-06-15')).toBe(false);
    expect(evaluateCondition(d('after'), '2027-01-01')).toBe(true);
  });

  it('ignores a value of the wrong shape instead of throwing', () => {
    expect(evaluateCondition({ kind: 'number', operator: 'equals', value: 1 }, '1')).toBe(false);
  });
});

describe('resolveForm: visibility', () => {
  const yes: Condition = { kind: 'text', operator: 'equals', value: 'yes' };

  it('uses defaults when no rule matches', () => {
    const fields = [text('a'), text('b', { visible: false, rules: [rule('a', yes, 'show')] })];
    const s = resolveForm(fields, {});
    expect(s.a?.visible).toBe(true);
    expect(s.b?.visible).toBe(false);
  });

  it('shows and hides in real time as the target changes', () => {
    const fields = [text('a'), text('b', { visible: false, rules: [rule('a', yes, 'show')] })];
    expect(resolveForm(fields, { a: 'yes' }).b?.visible).toBe(true);
    expect(resolveForm(fields, { a: 'no' }).b?.visible).toBe(false);
    expect(resolveForm(fields, { a: '' }).b?.visible).toBe(false);
  });

  it('hide rule on a visible-by-default field', () => {
    const fields = [text('a'), text('b', { rules: [rule('a', yes, 'hide')] })];
    expect(resolveForm(fields, { a: 'yes' }).b?.visible).toBe(false);
    expect(resolveForm(fields, {}).b?.visible).toBe(true);
  });

  it('chained conditions: hiding A hides C', () => {
    // a --shows--> b --shows--> c
    const fields = [
      text('a'),
      text('b', { visible: false, rules: [rule('a', yes, 'show')] }),
      text('c', { visible: false, rules: [rule('b', yes, 'show')] }),
    ];
    const open = resolveForm(fields, { a: 'yes', b: 'yes' });
    expect(open.b?.visible && open.c?.visible).toBe(true);
    // user answered b, then changed a: b hides, so c must hide although b still holds "yes"
    const closed = resolveForm(fields, { a: 'no', b: 'yes' });
    expect(closed.b?.visible).toBe(false);
    expect(closed.c?.visible).toBe(false);
  });

  it('chains correctly when the dependent field is listed before its target', () => {
    const fields = [
      text('c', { visible: false, rules: [rule('b', yes, 'show')] }),
      text('b', { visible: false, rules: [rule('a', yes, 'show')] }),
      text('a'),
    ];
    const s = resolveForm(fields, { a: 'yes', b: 'yes' });
    expect(s.c?.visible).toBe(true);
    expect(resolveForm(fields, { a: 'no', b: 'yes' }).c?.visible).toBe(false);
  });

  it('last matching rule wins per axis', () => {
    const f = text('b', { rules: [rule('a', yes, 'hide'), rule('a', { kind: 'text', operator: 'contains', value: 'y' }, 'show')] });
    expect(resolveForm([text('a'), f], { a: 'yes' }).b?.visible).toBe(true);
    const g = text('b', { rules: [rule('a', { kind: 'text', operator: 'contains', value: 'y' }, 'show'), rule('a', yes, 'hide')] });
    expect(resolveForm([text('a'), g], { a: 'yes' }).b?.visible).toBe(false);
  });

  it('visibility and required rules are independent axes', () => {
    const f = text('b', { rules: [rule('a', yes, 'require'), rule('a', yes, 'hide')] });
    const s = resolveForm([text('a'), f], { a: 'yes' }).b;
    expect(s).toMatchObject({ visible: false, required: true });
  });

  it('ignores self-references and unknown targets (corrupt data) without throwing', () => {
    const f = text('a', { rules: [rule('a', yes, 'hide'), rule('ghost', yes, 'hide')] });
    expect(resolveForm([f], { a: 'yes' }).a?.visible).toBe(true);
  });

  it('terminates on a dependency cycle', () => {
    const a = text('a', { rules: [rule('b', yes, 'show')] });
    const b = text('b', { rules: [rule('a', yes, 'show')] });
    expect(() => resolveForm([a, b], { a: 'yes', b: 'yes' })).not.toThrow();
    expect(evaluationOrder([a, b])).toHaveLength(2);
    expect(findCycle([a, b])).not.toBeNull();
  });

  it('a rule on a number target compares numerically', () => {
    const f = text('b', { visible: false, rules: [rule('a', { kind: 'number', operator: 'greaterThan', value: 10 }, 'show')] });
    expect(resolveForm([num('a'), f], { a: 11 }).b?.visible).toBe(true);
    expect(resolveForm([num('a'), f], { a: 9 }).b?.visible).toBe(false);
  });

  it('a rule can target a calculation field', () => {
    const calc = withId(createField('calculation'), 'total', { label: 'total', sourceIds: ['a', 'b'] });
    const f = text('flag', { visible: false, rules: [rule('total', { kind: 'number', operator: 'greaterThan', value: 100 }, 'show')] });
    const fields = [num('a'), num('b'), calc, f];
    expect(resolveForm(fields, { a: 60, b: 50 }).flag?.visible).toBe(true);
    expect(resolveForm(fields, { a: 60, b: 10 }).flag?.visible).toBe(false);
  });
});

describe('required + validation', () => {
  const yes: Condition = { kind: 'text', operator: 'equals', value: 'yes' };

  it('flags an empty required visible field', () => {
    const fields = [text('a', { required: true })];
    expect(validateForm(fields, {})).toEqual({ a: REQUIRED_MESSAGE });
    expect(validateForm(fields, { a: 'x' })).toEqual({});
  });

  it('never validates a hidden field, even if it is required', () => {
    const fields = [text('a'), text('b', { required: true, rules: [rule('a', yes, 'hide')] })];
    expect(validateForm(fields, { a: 'yes' })).toEqual({});
    expect(validateForm(fields, { a: 'no' })).toEqual({ b: REQUIRED_MESSAGE });
  });

  it('hidden-but-required: hidden by default, required rule fires, still not validated', () => {
    const f = text('b', { visible: false, rules: [rule('a', yes, 'require')] });
    expect(validateForm([text('a'), f], { a: 'yes' })).toEqual({});
  });

  it('require / unrequire rules change the required state', () => {
    const req = text('b', { rules: [rule('a', yes, 'require')] });
    expect(validateForm([text('a'), req], { a: 'yes' })).toEqual({ b: REQUIRED_MESSAGE });
    expect(validateForm([text('a'), req], { a: 'no' })).toEqual({});
    const unreq = text('b', { required: true, rules: [rule('a', yes, 'unrequire')] });
    expect(validateForm([text('a'), unreq], { a: 'yes' })).toEqual({});
    expect(validateForm([text('a'), unreq], {})).toEqual({ b: REQUIRED_MESSAGE });
  });

  it('applies per-type constraints to non-empty values only', () => {
    const f = text('a', { minLength: 3 });
    expect(validateForm([f], {})).toEqual({});
    expect(validateForm([f], { a: 'ab' })['a']).toMatch(/at least 3/);
  });

  it('validates a required field only once it is revealed', () => {
    const f = text('b', { visible: false, required: true, rules: [rule('a', yes, 'show')] });
    expect(validateForm([text('a'), f], { a: 'no' })).toEqual({});
    expect(validateForm([text('a'), f], { a: 'yes' })).toEqual({ b: REQUIRED_MESSAGE });
  });
});

describe('submittableValues', () => {
  const yes: Condition = { kind: 'text', operator: 'equals', value: 'yes' };
  it("drops hidden fields' values but keeps them in the raw draft", () => {
    const fields = [text('a'), text('b', { rules: [rule('a', yes, 'hide')] })];
    const raw = { a: 'yes', b: 'secret' };
    const out = submittableValues(fields, resolveForm(fields, raw));
    expect(out).toEqual({ a: 'yes' });
    expect(raw.b).toBe('secret');
  });

  it('includes computed values and excludes empty ones', () => {
    const calc = withId(createField('calculation'), 'total', { sourceIds: ['a'] });
    const fields = [num('a'), num('b'), calc];
    expect(submittableValues(fields, resolveForm(fields, { a: 4 }))).toEqual({ a: 4, total: 4 });
  });
});

describe('calculation', () => {
  const calc = (aggregation: 'sum' | 'average' | 'minimum' | 'maximum', decimals = 2) =>
    withId(createField('calculation'), 'c', { sourceIds: ['a', 'b', 'x'], aggregation, decimals });
  const fields = (agg: 'sum' | 'average' | 'minimum' | 'maximum', decimals?: number) => [num('a'), num('b'), num('x'), calc(agg, decimals)];

  it('aggregates the filled sources in real time', () => {
    expect(resolveForm(fields('sum'), { a: 1, b: 2 }).c?.value).toBe(3);
    expect(resolveForm(fields('sum'), { a: 1, b: 2, x: 4 }).c?.value).toBe(7);
    expect(resolveForm(fields('average'), { a: 1, b: 2 }).c?.value).toBe(1.5);
    expect(resolveForm(fields('minimum'), { a: 5, b: 2 }).c?.value).toBe(2);
    expect(resolveForm(fields('maximum'), { a: 5, b: 2 }).c?.value).toBe(5);
  });

  it('is empty when no source has a value, and treats 0 as a value', () => {
    expect(resolveForm(fields('sum'), {}).c?.value).toBeUndefined();
    expect(resolveForm(fields('minimum'), { a: 0, b: 3 }).c?.value).toBe(0);
  });

  it('rounds to the configured decimals', () => {
    expect(resolveForm(fields('sum', 2), { a: 0.1, b: 0.2 }).c?.value).toBe(0.3);
    expect(resolveForm(fields('average', 0), { a: 1, b: 2 }).c?.value).toBe(2);
    expect(resolveForm(fields('sum', 2), { a: 1.005, b: 0 }).c?.value).toBe(1.01);
  });

  it('ignores hidden sources', () => {
    const yes: Condition = { kind: 'text', operator: 'equals', value: 'yes' };
    const hidden = num('b', { rules: [rule('t', yes, 'hide')] });
    const c = withId(createField('calculation'), 'c', { sourceIds: ['a', 'b'], aggregation: 'sum' });
    const fs = [text('t'), num('a'), hidden, c];
    expect(resolveForm(fs, { t: 'yes', a: 1, b: 100 }).c?.value).toBe(1);
    expect(resolveForm(fs, { t: 'no', a: 1, b: 100 }).c?.value).toBe(101);
  });

  it('ignores any stored value for the calculation itself (it is read-only)', () => {
    expect(resolveForm(fields('sum'), { a: 1, c: 999 }).c?.value).toBe(1);
  });
});

describe('validateTemplate', () => {
  const yes: Condition = { kind: 'text', operator: 'equals', value: 'yes' };
  const messages = (fs: Parameters<typeof templateOf>[0], title = 'T') =>
    validateTemplate({ ...templateOf(fs), title }).map((i) => i.message);

  it('accepts a sound template', () => {
    expect(messages([text('a'), text('b', { rules: [rule('a', yes, 'show')] })])).toEqual([]);
  });

  it('requires a title', () => {
    expect(messages([], '  ')).toEqual(['Give the form a title']);
  });

  it('rejects self reference, unknown target and non-targetable fields', () => {
    expect(messages([text('a', { rules: [rule('a', yes, 'hide')] })])[0]).toMatch(/itself/);
    expect(messages([text('a', { rules: [rule('zz', yes, 'hide')] })])[0]).toMatch(/choose a field/);
    const file = withId(createField('fileUpload'), 'f', { label: 'f' });
    expect(messages([file, text('a', { rules: [rule('f', yes, 'hide')] })])[0]).toMatch(/cannot be used/);
  });

  it('rejects a condition kind that does not match the target type', () => {
    const bad = text('b', { rules: [rule('a', { kind: 'date', operator: 'equals', value: '2026-01-01' }, 'show')] });
    expect(messages([text('a'), bad])[0]).toMatch(/cannot be used/);
  });

  it('rejects require effects on display / computed fields', () => {
    const header = withId(createField('sectionHeader'), 'h', { rules: [rule('a', yes, 'require')] });
    expect(messages([text('a'), header]).join()).toMatch(/cannot be marked required/);
  });

  it('detects circular dependencies', () => {
    const a = text('a', { rules: [rule('b', yes, 'show')] });
    const b = text('b', { rules: [rule('a', yes, 'show')] });
    expect(messages([a, b]).join()).toMatch(/Circular/);
  });

  it('a calculation may only use Number fields, never another calculation', () => {
    const inner = withId(createField('calculation'), 'in', { label: 'in', sourceIds: ['a'] });
    const outer = withId(createField('calculation'), 'out', { label: 'out', sourceIds: ['in'] });
    expect(messages([num('a'), inner, outer]).join()).toMatch(/not a Number field/);
    expect(messages([num('a'), inner])).toEqual([]);
  });

  it('flags an empty calculation and surfaces per-type config errors', () => {
    expect(messages([withId(createField('calculation'), 'c', { label: 'c' })]).join()).toMatch(/at least one Number/);
    expect(messages([num('a', { min: 5, max: 1 })]).join()).toMatch(/Max value/);
  });
});

describe('cleanReferences', () => {
  const yes: Condition = { kind: 'text', operator: 'equals', value: 'yes' };
  it('drops rules for deleted targets and calc sources', () => {
    const calc = withId(createField('calculation'), 'c', { sourceIds: ['a', 'gone'] });
    const cleaned = cleanReferences([num('a'), text('b', { rules: [rule('gone', yes, 'hide')] }), calc]);
    expect(cleaned[1]?.rules).toEqual([]);
    expect(cleaned[2]).toMatchObject({ sourceIds: ['a'] });
  });

  it('prunes removed options from select conditions', () => {
    const sel = withId(createField('multiSelect'), 'm', { label: 'm' });
    const [o1, o2] = sel.options;
    const dependent = text('t', {
      rules: [
        rule('m', { kind: 'multiSelect', operator: 'containsAny', value: [o1!.id, 'removed'] }, 'show'),
        rule('m', { kind: 'singleSelect', operator: 'equals', value: 'removed' }, 'show'),
      ],
    });
    const cleaned = cleanReferences([sel, dependent]);
    const rules = cleaned[1]!.rules;
    expect(rules).toHaveLength(2);
    expect(rules[0]?.condition).toMatchObject({ value: [o1!.id] });
    expect(o2).toBeDefined();
  });

  it('returns the same object when nothing needs repair', () => {
    const fields = [text('a'), text('b', { rules: [rule('a', yes, 'hide')] })];
    const cleaned = cleanReferences(fields);
    expect(cleaned[0]).toBe(fields[0]);
    expect(cleaned[1]).toBe(fields[1]);
  });
});
