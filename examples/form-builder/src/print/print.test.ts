import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDraftInstance } from '../domain/instance';
import { createField } from '../domain/template';
import type { Instance } from '../domain/template';
import { num, rule, templateOf, text, withId } from '../logic/testing';
import { submittableValues, resolveForm } from '../logic/resolve';
import { buildPrintModel, EMPTY_VALUE, FILE_NOTE, printTitle } from './model';
import { printInstance, renderPrintDocument } from './printInstance';

const yes = { kind: 'text', operator: 'equals', value: 'yes' } as const;

function submit(instance: Instance, values: Instance['values']): Instance {
  const state = resolveForm(instance.templateSnapshot.fields, values);
  return {
    ...instance,
    status: 'submitted',
    submittedAt: '2026-03-14T10:30:00.000Z',
    values: submittableValues(instance.templateSnapshot.fields, state),
  };
}

function build() {
  const sel = withId(createField('multiSelect'), 'topics', { label: 'Topics' });
  const file = withId(createField('fileUpload'), 'doc', { label: 'Attachment' });
  const calc = withId(createField('calculation'), 'total', { label: 'Total', sourceIds: ['a', 'b'] });
  const template = {
    ...templateOf([
      withId(createField('sectionHeader'), 'h1', { label: 'About you', size: 'xl' }),
      text('name', { label: 'Name' }),
      text('toggle', { label: 'Toggle' }),
      text('secret', { label: 'Secret', rules: [rule('toggle', yes, 'hide')] }),
      text('optional', { label: 'Nickname' }),
      withId(createField('sectionHeader'), 'h2', { label: 'Money', size: 'xs' }),
      num('a', { label: 'A' }),
      num('b', { label: 'B' }),
      calc,
      sel,
      file,
    ]),
    title: 'Intake <form>',
    description: 'Please answer all',
  };
  return { template, sel };
}

describe('buildPrintModel', () => {
  it('lists visible fields in form order, omitting hidden ones and their values', () => {
    const { template } = build();
    const inst = submit(createDraftInstance(template), { name: 'Ada', toggle: 'yes', secret: 'TOP-SECRET' });
    const model = buildPrintModel(inst);
    expect(model.title).toBe('Intake <form>');
    const labels = model.items.map((i) => i.label);
    expect(labels).toEqual(['About you', 'Name', 'Toggle', 'Nickname', 'Money', 'A', 'B', 'Total', 'Topics', 'Attachment']);
    expect(JSON.stringify(model)).not.toContain('TOP-SECRET');
    expect(labels).not.toContain('Secret');
  });

  it('shows a dash for empty fields, keeps header sizes, and formats computed values', () => {
    const { template } = build();
    const inst = submit(createDraftInstance(template), { name: 'Ada', a: 1.5, b: 2 });
    const items = buildPrintModel(inst).items;
    expect(items[0]).toEqual({ kind: 'header', size: 'xl', label: 'About you' });
    expect(items.find((i) => i.label === 'Money')).toMatchObject({ kind: 'header', size: 'xs' });
    expect(items.find((i) => i.label === 'Nickname')).toMatchObject({ lines: [EMPTY_VALUE], empty: true });
    expect(items.find((i) => i.label === 'Total')).toMatchObject({ lines: ['3.50'] });
  });

  it('prints multi-select as one line per choice and files as metadata plus a note', () => {
    const { template, sel } = build();
    const [o1, o2] = sel.options;
    const inst = submit(createDraftInstance(template), {
      topics: [o1!.id, o2!.id],
      doc: [{ name: 'cv.pdf', size: 2048, type: 'application/pdf' }],
    });
    const items = buildPrintModel(inst).items;
    expect(items.find((i) => i.label === 'Topics')).toMatchObject({ lines: [o1!.label, o2!.label] });
    expect(items.find((i) => i.label === 'Attachment')).toMatchObject({
      lines: ['cv.pdf (2.0 KB, application/pdf)'],
      note: FILE_NOTE,
    });
  });

  it('is built from the snapshot, so later template edits cannot change an old export', () => {
    const { template } = build();
    const inst = submit(createDraftInstance(template), { name: 'Ada' });
    const before = buildPrintModel(inst);
    expect(buildPrintModel({ ...inst })).toEqual(before);
    expect(printTitle(inst)).toBe('Intake <form> – 2026-03-14');
  });
});

describe('renderPrintDocument', () => {
  it('produces a complete document, escapes user text, and never contains hidden values', () => {
    const { template } = build();
    const inst = submit(createDraftInstance(template), { name: '<script>x</script>', toggle: 'yes', secret: 'TOP-SECRET' });
    const html = renderPrintDocument(inst);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Intake &lt;form&gt; – 2026-03-14</title>');
    expect(html).toContain('@page');
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('TOP-SECRET');
    expect(html).toContain('Submitted March 14, 2026');
  });
});

describe('printInstance', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('prints from a hidden iframe, retitles the page meanwhile, then cleans up', () => {
    const { template } = build();
    const inst = submit(createDraftInstance(template), { name: 'Ada' });
    document.title = 'Form Builder';

    const print = vi.fn();
    const append = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      const added = append(node);
      if (node instanceof HTMLIFrameElement && node.contentWindow) node.contentWindow.print = print;
      return added;
    });

    printInstance(inst);
    const iframe = document.querySelector('iframe')!;
    expect(iframe).toBeTruthy();
    expect(iframe.contentDocument?.body.textContent).toContain('Ada');
    expect(print).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.title).toBe('Intake <form> – 2026-03-14');

    iframe.contentWindow!.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe('Form Builder');
    expect(document.querySelector('iframe')).toBeNull();
    vi.restoreAllMocks();
  });
});
