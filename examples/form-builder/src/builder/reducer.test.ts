import { describe, expect, it } from 'vitest';
import { createField, createTemplate } from '../domain/template';
import { rule, text, withId } from '../logic/testing';
import { builderReducer, initBuilderState } from './reducer';

const yes = { kind: 'text', operator: 'equals', value: 'yes' } as const;
const stateWith = (fields: ReturnType<typeof text>[]) => initBuilderState({ ...createTemplate(), fields });

describe('builderReducer', () => {
  it('adds a field after the given one and selects it', () => {
    let s = stateWith([text('a'), text('b')]);
    s = builderReducer(s, { type: 'addField', fieldType: 'number', afterId: 'a' });
    expect(s.template.fields.map((f) => f.id).slice(0, 1)).toEqual(['a']);
    expect(s.template.fields[1]?.type).toBe('number');
    expect(s.selectedId).toBe(s.template.fields[1]?.id);
    expect(s.dirty).toBe(true);
  });

  it('appends when no anchor is given', () => {
    const s = builderReducer(stateWith([text('a')]), { type: 'addField', fieldType: 'date' });
    expect(s.template.fields.map((f) => f.type)).toEqual(['singleLineText', 'date']);
  });

  it('moves up/down and ignores moves past the ends', () => {
    let s = stateWith([text('a'), text('b'), text('c')]);
    s = builderReducer(s, { type: 'moveField', id: 'c', delta: -1 });
    expect(s.template.fields.map((f) => f.id)).toEqual(['a', 'c', 'b']);
    const same = builderReducer(s, { type: 'moveField', id: 'a', delta: -1 });
    expect(same).toBe(s);
  });

  it('reorders by index (drag and drop)', () => {
    const s = builderReducer(stateWith([text('a'), text('b'), text('c')]), { type: 'moveFieldTo', id: 'a', toIndex: 2 });
    expect(s.template.fields.map((f) => f.id)).toEqual(['b', 'c', 'a']);
  });

  it('removing a field prunes rules and calc sources that referenced it, and reselects', () => {
    const calc = withId(createField('calculation'), 'c', { sourceIds: ['n', 'm'] });
    const dependent = text('b', { rules: [rule('n', yes, 'hide')] });
    const n = withId(createField('number'), 'n');
    const m = withId(createField('number'), 'm');
    let s = initBuilderState({ ...createTemplate(), fields: [n, m, dependent, calc] });
    s = builderReducer(s, { type: 'select', id: 'n' });
    s = builderReducer(s, { type: 'removeField', id: 'n' });
    expect(s.template.fields.map((f) => f.id)).toEqual(['m', 'b', 'c']);
    expect(s.template.fields[1]?.rules).toEqual([]);
    expect(s.template.fields[2]).toMatchObject({ sourceIds: ['m'] });
    expect(s.selectedId).toBe('m');
  });

  it('removing an option prunes select rules that used it', () => {
    const sel = withId(createField('singleSelect'), 's');
    const [o1, o2] = sel.options;
    const dependent = text('t', {
      rules: [rule('s', { kind: 'singleSelect', operator: 'equals', value: o1!.id }, 'show')],
    });
    let s = initBuilderState({ ...createTemplate(), fields: [sel, dependent] });
    s = builderReducer(s, { type: 'updateField', field: { ...sel, options: [o2!] } });
    expect(s.template.fields[1]?.rules).toEqual([]);
  });

  it('duplicates with fresh ids but the same targets', () => {
    const a = text('a');
    const b = text('b', { rules: [rule('a', yes, 'hide')] });
    const s = builderReducer(stateWith([a, b]), { type: 'duplicateField', id: 'b' });
    const copy = s.template.fields[2]!;
    expect(copy.id).not.toBe('b');
    expect(copy.label).toBe('b (copy)');
    expect(copy.rules[0]?.targetFieldId).toBe('a');
    expect(copy.rules[0]?.id).not.toBe(b.rules[0]?.id);
  });

  it('marks clean after save', () => {
    let s = builderReducer(stateWith([text('a')]), { type: 'setTitle', title: 'X' });
    expect(s.dirty).toBe(true);
    s = builderReducer(s, { type: 'saved', template: s.template });
    expect(s.dirty).toBe(false);
  });
});
