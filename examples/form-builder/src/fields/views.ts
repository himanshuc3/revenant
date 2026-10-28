import { calculationView } from './calculation/view';
import { dateView } from './date/view';
import { fileUploadView } from './fileUpload/view';
import { multiLineTextView } from './multiLineText/view';
import { multiSelectView } from './multiSelect/view';
import { numberView } from './number/view';
import { sectionHeaderView } from './sectionHeader/view';
import { singleLineTextView } from './singleLineText/view';
import { singleSelectView } from './singleSelect/view';
import type { ConfigOf, FieldConfig, FieldType, ValueOf } from './models';
import type { FieldView } from './viewTypes';

/**
 * Registration point #2 of 2 (the other is `models.ts`). The mapped type makes
 * a missing or mistyped view a compile error.
 */
export const viewRegistry: { [K in FieldType]: FieldView<ConfigOf<K>, ValueOf<K>> } = {
  singleLineText: singleLineTextView,
  multiLineText: multiLineTextView,
  number: numberView,
  date: dateView,
  singleSelect: singleSelectView,
  multiSelect: multiSelectView,
  fileUpload: fileUploadView,
  sectionHeader: sectionHeaderView,
  calculation: calculationView,
};

/** Dispatches on a config's `type`; the single cast mirrors `modelOf`. */
export function viewOf<C extends FieldConfig>(config: C): FieldView<C, ValueOf<C['type']>> {
  return viewRegistry[config.type] as unknown as FieldView<C, ValueOf<C['type']>>;
}
