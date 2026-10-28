import { beforeEach, describe, expect, it } from 'vitest';
import { createDraftInstance } from '../domain/instance';
import { createField, createTemplate } from '../domain/template';
import { createRepository, INSTANCES_KEY, StorageError, TEMPLATES_KEY } from './repository';

class MemoryStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

let store: MemoryStore;
let repo: ReturnType<typeof createRepository>;
beforeEach(() => {
  store = new MemoryStore();
  repo = createRepository(store);
});

describe('repository', () => {
  it('persists and reloads a template', () => {
    const t = { ...createTemplate(), title: 'Survey', fields: [createField('number')] };
    repo.saveTemplate(t);
    const reloaded = createRepository(store).getTemplate(t.id);
    expect(reloaded?.title).toBe('Survey');
    expect(reloaded?.fields).toHaveLength(1);
  });

  it('skips corrupt entries without throwing and reports them', () => {
    repo.saveTemplate(createTemplate());
    const record = JSON.parse(store.data.get(TEMPLATES_KEY)!) as Record<string, unknown>;
    record['bad'] = { id: 'bad', fields: 'nope' };
    store.data.set(TEMPLATES_KEY, JSON.stringify(record));
    const report = repo.loadTemplates();
    expect(report.items).toHaveLength(1);
    expect(report.skipped).toBe(1);
  });

  it('survives wholly invalid JSON', () => {
    store.data.set(TEMPLATES_KEY, '{not json');
    expect(repo.loadTemplates()).toEqual({ items: [], skipped: 1 });
  });

  it('deleting a template cascades to its instances only', () => {
    const a = repo.saveTemplate(createTemplate());
    const b = repo.saveTemplate(createTemplate());
    repo.saveInstance(createDraftInstance(a));
    repo.saveInstance(createDraftInstance(b));
    repo.deleteTemplate(a.id);
    expect(repo.loadInstances().items.map((i) => i.templateId)).toEqual([b.id]);
    expect(store.data.has(INSTANCES_KEY)).toBe(true);
  });

  it('wraps quota errors in StorageError', () => {
    const full = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    expect(() => createRepository(full).saveTemplate(createTemplate())).toThrow(StorageError);
  });

  it('notifies subscribers on write', () => {
    let calls = 0;
    repo.subscribe(() => (calls += 1));
    repo.saveTemplate(createTemplate());
    expect(calls).toBe(1);
    expect(repo.getVersion()).toBe(1);
  });
});

describe('createDraftInstance', () => {
  it('prefills date fields flagged prefillToday and snapshots the template', () => {
    const date = { ...createField('date'), prefillToday: true };
    const plain = createField('date');
    const t = { ...createTemplate(), fields: [date, plain] };
    const inst = createDraftInstance(t, new Date(2026, 9, 5));
    expect(inst.values[date.id]).toBe('2026-10-05');
    expect(inst.values[plain.id]).toBeUndefined();
    expect(inst.templateSnapshot).toEqual(t);
    expect(inst.templateSnapshot).not.toBe(t);
    expect(inst.status).toBe('draft');
  });
});
