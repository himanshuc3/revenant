import type { z } from 'zod';
import { InstanceSchema, TemplateSchema, type Instance, type Template } from '../domain/template';

export const TEMPLATES_KEY = 'fb:v1:templates';
export const INSTANCES_KEY = 'fb:v1:instances';

export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export interface LoadReport<T> {
  items: T[];
  /** Entries that failed validation and were skipped (left untouched in storage). */
  skipped: number;
}

/**
 * Typed persistence over a key/value store. Every read is validated with Zod, so
 * hand-edited or older data can never crash the UI — bad entries are skipped and counted.
 */
export function createRepository(store: KeyValueStore) {
  const listeners = new Set<() => void>();
  let version = 0;

  function notify() {
    version += 1;
    listeners.forEach((l) => l());
  }

  function readRecord<T>(key: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): LoadReport<T> {
    let raw: string | null;
    try {
      raw = store.getItem(key);
    } catch {
      return { items: [], skipped: 0 };
    }
    if (!raw) return { items: [], skipped: 0 };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { items: [], skipped: 1 };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { items: [], skipped: 1 };
    }
    const items: T[] = [];
    let skipped = 0;
    for (const value of Object.values(parsed)) {
      const result = schema.safeParse(value);
      if (result.success) items.push(result.data);
      else skipped += 1;
    }
    return { items, skipped };
  }

  function readRaw(key: string): Record<string, unknown> {
    try {
      const raw = store.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  function writeRaw(key: string, record: Record<string, unknown>) {
    try {
      store.setItem(key, JSON.stringify(record));
    } catch (err) {
      throw new StorageError('Could not save: browser storage is full or unavailable.', err);
    }
  }

  const byUpdatedDesc = <T extends { updatedAt: string }>(a: T, b: T) => b.updatedAt.localeCompare(a.updatedAt);

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => version,
    /** Call when another tab changes storage. */
    notifyExternalChange: notify,

    loadTemplates(): LoadReport<Template> {
      const report = readRecord(TEMPLATES_KEY, TemplateSchema);
      return { ...report, items: report.items.sort(byUpdatedDesc) };
    },
    getTemplate(id: string): Template | undefined {
      return readRecord(TEMPLATES_KEY, TemplateSchema).items.find((t) => t.id === id);
    },
    saveTemplate(template: Template): Template {
      const saved = { ...template, updatedAt: new Date().toISOString() };
      const record = readRaw(TEMPLATES_KEY);
      record[saved.id] = saved;
      writeRaw(TEMPLATES_KEY, record);
      notify();
      return saved;
    },
    /** Removes a template and every response (draft or submitted) made from it. */
    deleteTemplate(id: string): void {
      const templates = readRaw(TEMPLATES_KEY);
      delete templates[id];
      const instances = readRaw(INSTANCES_KEY);
      for (const [key, value] of Object.entries(instances)) {
        if ((value as { templateId?: unknown } | null)?.templateId === id) delete instances[key];
      }
      writeRaw(INSTANCES_KEY, instances);
      writeRaw(TEMPLATES_KEY, templates);
      notify();
    },

    loadInstances(templateId?: string): LoadReport<Instance> {
      const report = readRecord(INSTANCES_KEY, InstanceSchema);
      const items = templateId ? report.items.filter((i) => i.templateId === templateId) : report.items;
      return { ...report, items: items.sort(byUpdatedDesc) };
    },
    getInstance(id: string): Instance | undefined {
      return readRecord(INSTANCES_KEY, InstanceSchema).items.find((i) => i.id === id);
    },
    saveInstance(instance: Instance): Instance {
      const saved = { ...instance, updatedAt: new Date().toISOString() };
      const record = readRaw(INSTANCES_KEY);
      record[saved.id] = saved;
      writeRaw(INSTANCES_KEY, record);
      notify();
      return saved;
    },
    deleteInstance(id: string): void {
      const record = readRaw(INSTANCES_KEY);
      delete record[id];
      writeRaw(INSTANCES_KEY, record);
      notify();
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
