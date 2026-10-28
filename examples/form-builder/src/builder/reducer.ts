import { newId } from '../domain/ids';
import { createField, type Template } from '../domain/template';
import type { FieldConfig, FieldType } from '../fields/models';
import { cleanReferences } from '../logic/template';

export interface BuilderState {
  template: Template;
  selectedId: string | null;
  dirty: boolean;
}

export type BuilderAction =
  | { type: 'setTitle'; title: string }
  | { type: 'setDescription'; description: string }
  | { type: 'addField'; fieldType: FieldType; afterId?: string | null }
  | { type: 'updateField'; field: FieldConfig }
  | { type: 'removeField'; id: string }
  | { type: 'duplicateField'; id: string }
  | { type: 'moveField'; id: string; delta: -1 | 1 }
  | { type: 'moveFieldTo'; id: string; toIndex: number }
  | { type: 'select'; id: string | null }
  | { type: 'saved'; template: Template };

export function initBuilderState(template: Template, dirty = false): BuilderState {
  return { template, selectedId: template.fields[0]?.id ?? null, dirty };
}

/** Applies a field-list change, repairing any references it broke. */
function withFields(state: BuilderState, fields: FieldConfig[], selectedId = state.selectedId): BuilderState {
  return {
    template: { ...state.template, fields: cleanReferences(fields) },
    selectedId,
    dirty: true,
  };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const { fields } = state.template;
  switch (action.type) {
    case 'setTitle':
      return { ...state, dirty: true, template: { ...state.template, title: action.title } };
    case 'setDescription':
      return { ...state, dirty: true, template: { ...state.template, description: action.description } };
    case 'addField': {
      const field = createField(action.fieldType);
      const at = action.afterId ? fields.findIndex((f) => f.id === action.afterId) + 1 : fields.length;
      const next = [...fields.slice(0, at), field, ...fields.slice(at)];
      return withFields(state, next, field.id);
    }
    case 'updateField':
      return withFields(
        state,
        fields.map((f) => (f.id === action.field.id ? action.field : f)),
      );
    case 'removeField': {
      const index = fields.findIndex((f) => f.id === action.id);
      if (index < 0) return state;
      const next = fields.filter((f) => f.id !== action.id);
      const selectedId =
        state.selectedId === action.id ? (next[Math.min(index, next.length - 1)]?.id ?? null) : state.selectedId;
      return withFields(state, next, selectedId);
    }
    case 'duplicateField': {
      const index = fields.findIndex((f) => f.id === action.id);
      const source = fields[index];
      if (!source) return state;
      // Fresh ids for the copy, its rules and its options; rules keep pointing at the same targets.
      const copy = {
        ...structuredClone(source),
        id: newId(),
        label: `${source.label} (copy)`,
        rules: source.rules.map((r) => ({ ...structuredClone(r), id: newId() })),
      } as FieldConfig;
      const next = [...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)];
      return withFields(state, next, copy.id);
    }
    case 'moveField': {
      const from = fields.findIndex((f) => f.id === action.id);
      const to = from + action.delta;
      if (from < 0 || to < 0 || to >= fields.length) return state;
      return builderReducer(state, { type: 'moveFieldTo', id: action.id, toIndex: to });
    }
    case 'moveFieldTo': {
      const from = fields.findIndex((f) => f.id === action.id);
      const moving = fields[from];
      if (!moving || from === action.toIndex) return state;
      const next = fields.filter((f) => f.id !== action.id);
      next.splice(Math.max(0, Math.min(action.toIndex, next.length)), 0, moving);
      return withFields(state, next);
    }
    case 'select':
      return { ...state, selectedId: action.id };
    case 'saved':
      return { ...state, template: action.template, dirty: false };
  }
}
