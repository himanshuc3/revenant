import type { ComponentType, ReactNode } from 'react';
import type { FieldConfig } from './models';
import type { BaseConfig } from './types';

export interface InputProps<C extends BaseConfig, V> {
  config: C;
  /** Raw value for input fields; computed value for calculation fields. */
  value: V | undefined;
  onChange: (value: V | undefined) => void;
  /** Effective required state (after conditional rules). */
  required: boolean;
  disabled?: boolean;
  hasError?: boolean;
  /** DOM id for label association. */
  inputId: string;
}

export interface ConfigPanelProps<C extends BaseConfig> {
  config: C;
  onChange: (next: C) => void;
  /** Every field in the template, for panels that reference siblings (e.g. calculation sources). */
  fields: readonly FieldConfig[];
}

/** The React side of a field type. Pairs 1:1 with its `FieldModel`. */
export interface FieldView<C extends BaseConfig, V> {
  icon: ReactNode;
  /** Type-specific settings. Label / required / visibility / rules are shared and live in the builder. */
  ConfigPanel: ComponentType<ConfigPanelProps<C>>;
  Input: ComponentType<InputProps<C, V>>;
}
