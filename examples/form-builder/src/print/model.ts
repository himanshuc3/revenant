import type { Instance } from '../domain/template';
import type { HeaderSize } from '../fields/sectionHeader/model';
import { modelOf } from '../fields/models';
import { resolveForm } from '../logic/resolve';

export const EMPTY_VALUE = '—';
export const FILE_NOTE = 'File contents are not embedded in this document.';

export type PrintItem =
  | { kind: 'header'; size: HeaderSize; label: string }
  | { kind: 'field'; label: string; lines: string[]; empty: boolean; note?: string };

export interface PrintModel {
  title: string;
  description: string;
  /** Preformatted so the document is identical wherever and whenever it's reprinted. */
  submittedAt: string;
  items: PrintItem[];
}

export function formatPrintTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
}

/**
 * Everything the PDF shows, derived purely from a stored instance: visible
 * fields only (hidden ones are omitted entirely), in form order, using each
 * field type's own `format`.
 */
export function buildPrintModel(instance: Instance): PrintModel {
  const template = instance.templateSnapshot;
  const state = resolveForm(template.fields, instance.values);
  const items: PrintItem[] = [];

  for (const field of template.fields) {
    const s = state[field.id];
    if (!s?.visible) continue;
    const model = modelOf(field);

    if (model.behaviour === 'display') {
      if (field.type === 'sectionHeader') items.push({ kind: 'header', size: field.size, label: field.label });
      continue;
    }

    const lines = s.value === undefined ? [] : model.format(field, s.value).filter((l) => l.trim() !== '');
    items.push({
      kind: 'field',
      label: field.label,
      lines: lines.length > 0 ? lines : [EMPTY_VALUE],
      empty: lines.length === 0,
      note: field.type === 'fileUpload' && lines.length > 0 ? FILE_NOTE : undefined,
    });
  }

  return {
    title: template.title || 'Untitled form',
    description: template.description ?? '',
    submittedAt: formatPrintTimestamp(instance.submittedAt ?? instance.updatedAt),
    items,
  };
}

/** Suggested file name (the browser's "Save as PDF" default). */
export function printTitle(instance: Instance): string {
  const stamp = (instance.submittedAt ?? instance.updatedAt).slice(0, 10);
  return `${instance.templateSnapshot.title || 'Form'} – ${stamp}`;
}
