import type { BaseConfig, FieldModel } from './types';

/** Identity helper that gives each model full inference of its config/value types. */
export function defineModel<C extends BaseConfig, V>(model: FieldModel<C, V>): FieldModel<C, V> {
  return model;
}
