import { z } from 'zod';
import { baseFieldShape, FileMetaSchema, type FileMeta } from '../../domain/field';
import { defineModel } from '../define';
import { formatFile } from '../format';

/** "pdf, .JPG ,png" → [".pdf", ".jpg", ".png"] (lower-cased, dotted, de-duplicated). */
export function parseAccept(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[,\s]+/)) {
    const ext = raw.trim().toLowerCase();
    if (!ext || ext === '.') continue;
    const dotted = ext.startsWith('.') ? ext : `.${ext}`;
    if (!out.includes(dotted)) out.push(dotted);
  }
  return out;
}

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i < 0 ? '' : filename.slice(i).toLowerCase();
}

const schema = z.object({
  ...baseFieldShape,
  type: z.literal('fileUpload'),
  required: z.boolean(),
  /** Normalised extensions; empty means "any file". */
  accept: z.array(z.string().regex(/^\.[a-z0-9]+$/, 'Use extensions like .pdf')),
  maxFiles: z.number().int().min(1).max(50),
});

export type FileUploadConfig = z.infer<typeof schema>;

export const fileUploadModel = defineModel<FileUploadConfig, FileMeta[]>({
  type: 'fileUpload',
  title: 'File Upload',
  description: 'Attach files (metadata only)',
  behaviour: 'input',
  conditionKind: null,
  configSchema: schema,
  valueSchema: z.array(FileMetaSchema),
  createDefault: (id) => ({
    id,
    type: 'fileUpload',
    label: 'File upload',
    visible: true,
    required: false,
    rules: [],
    accept: [],
    maxFiles: 3,
  }),
  isEmpty: (v) => v === undefined || v.length === 0,
  validateValue: (c, v) => {
    if (v.length > c.maxFiles) return `Attach at most ${c.maxFiles} file${c.maxFiles === 1 ? '' : 's'}`;
    if (c.accept.length > 0) {
      const bad = v.find((f) => !c.accept.includes(extensionOf(f.name)));
      if (bad) return `${bad.name} is not an allowed type (${c.accept.join(', ')})`;
    }
    return null;
  },
  format: (_c, v) => v.map(formatFile),
});
