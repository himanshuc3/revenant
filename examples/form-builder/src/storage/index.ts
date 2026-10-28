import { useMemo, useSyncExternalStore } from 'react';
import type { Instance, Template } from '../domain/template';
import { createRepository, INSTANCES_KEY, TEMPLATES_KEY, type LoadReport } from './repository';

export const repository = createRepository(window.localStorage);

// Keep tabs in sync: another tab writing our keys re-renders subscribers here.
window.addEventListener('storage', (e) => {
  if (e.key === null || e.key === TEMPLATES_KEY || e.key === INSTANCES_KEY) {
    repository.notifyExternalChange();
  }
});

function useRepositoryVersion(): number {
  return useSyncExternalStore(repository.subscribe, repository.getVersion);
}

export function useTemplates(): LoadReport<Template> {
  const version = useRepositoryVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the invalidation key
  return useMemo(() => repository.loadTemplates(), [version]);
}

export function useInstances(templateId?: string): LoadReport<Instance> {
  const version = useRepositoryVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the invalidation key
  return useMemo(() => repository.loadInstances(templateId), [version, templateId]);
}

export function useInstance(id: string | undefined): Instance | undefined {
  const version = useRepositoryVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the invalidation key
  return useMemo(() => (id ? repository.getInstance(id) : undefined), [version, id]);
}
