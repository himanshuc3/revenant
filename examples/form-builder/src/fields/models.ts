import { calculationModel } from './calculation/model';
import { dateModel } from './date/model';
import { fileUploadModel } from './fileUpload/model';
import { multiLineTextModel } from './multiLineText/model';
import { multiSelectModel } from './multiSelect/model';
import { numberModel } from './number/model';
import { sectionHeaderModel } from './sectionHeader/model';
import { singleLineTextModel } from './singleLineText/model';
import { singleSelectModel } from './singleSelect/model';
import type { FieldModel } from './types';

/**
 * Registration point #1 of 2 (the other is `views.ts`). The order here is the
 * order of the builder palette. FieldType / FieldConfig / FieldValue are all
 * derived from this object, so they update automatically.
 */
export const modelRegistry = {
  singleLineText: singleLineTextModel,
  multiLineText: multiLineTextModel,
  number: numberModel,
  date: dateModel,
  singleSelect: singleSelectModel,
  multiSelect: multiSelectModel,
  fileUpload: fileUploadModel,
  sectionHeader: sectionHeaderModel,
  calculation: calculationModel,
} as const;

export type ModelRegistry = typeof modelRegistry;
export type FieldType = keyof ModelRegistry;
export const FIELD_TYPES = Object.keys(modelRegistry) as FieldType[];

export type ConfigOf<K extends FieldType> = ReturnType<ModelRegistry[K]['createDefault']>;
/** The (non-empty) value type of a field; `undefined` for display-only fields. */
export type ValueOf<K extends FieldType> = ReturnType<ModelRegistry[K]['valueSchema']['parse']>;

/** Discriminated union of every field config, derived from the registry. */
export type FieldConfig = { [K in FieldType]: ConfigOf<K> }[FieldType];
export type FieldValue = Exclude<{ [K in FieldType]: ValueOf<K> }[FieldType], undefined>;

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && Object.hasOwn(modelRegistry, value);
}

/**
 * Dispatches on a config's `type`. The registry is a union of differently-typed
 * models, so this is the one place a cast is needed; callers stay fully typed.
 */
export function modelOf<C extends FieldConfig>(config: C): FieldModel<C, ValueOf<C['type'] & FieldType>> {
  return modelRegistry[config.type] as unknown as FieldModel<C, ValueOf<C['type'] & FieldType>>;
}

export function modelForType<K extends FieldType>(type: K): ModelRegistry[K] {
  return modelRegistry[type];
}
