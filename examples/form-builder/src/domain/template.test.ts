import { describe, expect, it } from 'vitest';
import { FIELD_TYPES, modelForType } from '../fields/models';
import { parseAccept } from '../fields/fileUpload/model';
import { createField, createTemplate, InstanceSchema, TemplateSchema } from './template';

describe('field model schemas', () => {
  // A fresh Calculation has no sources yet, so it is intentionally incomplete (see below).
  it.each(FIELD_TYPES.filter((t) => t !== 'calculation'))(
    'default config of %s satisfies its own schema',
    (type) => {
      const config = createField(type);
      const parsed = modelForType(type).configSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    },
  );

  it('flags a calculation without source fields as incomplete', () => {
    const calc = createField('calculation');
    expect(modelForType('calculation').configSchema.safeParse(calc).success).toBe(false);
    expect(
      modelForType('calculation').configSchema.safeParse({ ...calc, sourceIds: ['a'] }).success,
    ).toBe(true);
  });

  it('rejects min > max for text length, number and date', () => {
    const text = { ...createField('singleLineText'), minLength: 10, maxLength: 5 };
    expect(modelForType('singleLineText').configSchema.safeParse(text).success).toBe(false);
    const num = { ...createField('number'), min: 5, max: 1 };
    expect(modelForType('number').configSchema.safeParse(num).success).toBe(false);
    const date = { ...createField('date'), min: '2026-02-01', max: '2026-01-01' };
    expect(modelForType('date').configSchema.safeParse(date).success).toBe(false);
  });

  it('limits number decimals to 0-4', () => {
    const num = { ...createField('number'), decimals: 5 };
    expect(modelForType('number').configSchema.safeParse(num).success).toBe(false);
  });

  it('requires a label and unique option labels', () => {
    const noLabel = { ...createField('number'), label: '  ' };
    expect(modelForType('number').configSchema.safeParse(noLabel).success).toBe(false);
    const sel = createField('singleSelect');
    const dup = { ...sel, options: [sel.options[0]!, { ...sel.options[1]!, label: sel.options[0]!.label.toUpperCase() }] };
    expect(modelForType('singleSelect').configSchema.safeParse(dup).success).toBe(false);
  });

  it('never allows a required header or calculation', () => {
    const header = { ...createField('sectionHeader'), required: true };
    expect(modelForType('sectionHeader').configSchema.safeParse(header).success).toBe(false);
    const calc = { ...createField('calculation'), required: true };
    expect(modelForType('calculation').configSchema.safeParse(calc).success).toBe(false);
  });
});

describe('parseAccept', () => {
  it('normalises case, dots, separators and duplicates', () => {
    expect(parseAccept('pdf, .JPG ,png,.pdf,')).toEqual(['.pdf', '.jpg', '.png']);
    expect(parseAccept('')).toEqual([]);
  });
});

describe('TemplateSchema / InstanceSchema', () => {
  it('round-trips a template through JSON', () => {
    const t = { ...createTemplate(), fields: [createField('number'), createField('singleSelect')] };
    const parsed = TemplateSchema.parse(JSON.parse(JSON.stringify(t)));
    expect(parsed).toEqual(t);
  });

  it('rejects an unknown field type', () => {
    const t = { ...createTemplate(), fields: [{ id: 'x', type: 'hologram' }] };
    expect(TemplateSchema.safeParse(t).success).toBe(false);
  });

  it('drops invalid / unknown values when parsing an instance', () => {
    const num = createField('number');
    const template = { ...createTemplate(), fields: [num] };
    const inst = {
      id: 'i1',
      templateId: template.id,
      status: 'draft',
      templateSnapshot: template,
      values: { [num.id]: 'not-a-number', ghost: 5 },
      createdAt: template.createdAt,
      updatedAt: template.createdAt,
    };
    expect(InstanceSchema.parse(inst).values).toEqual({});
  });
});
