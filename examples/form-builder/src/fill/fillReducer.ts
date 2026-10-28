import type { Values } from '../domain/template';
import type { FieldValue } from '../fields/models';

export interface FillState {
  /** Raw answers, including those of currently hidden fields (kept so a rule flipping back restores them). */
  values: Values;
  /** Fields the respondent has edited; their errors become visible. */
  touched: Record<string, true>;
  /** After a submit attempt every error is shown. */
  submitAttempted: boolean;
}

export type FillAction =
  | { type: 'set'; fieldId: string; value: FieldValue | undefined }
  | { type: 'submitAttempted' };

export const initFillState = (values: Values): FillState => ({ values, touched: {}, submitAttempted: false });

export function fillReducer(state: FillState, action: FillAction): FillState {
  switch (action.type) {
    case 'set': {
      const values = { ...state.values };
      if (action.value === undefined) delete values[action.fieldId];
      else values[action.fieldId] = action.value;
      return { ...state, values, touched: { ...state.touched, [action.fieldId]: true } };
    }
    case 'submitAttempted':
      return { ...state, submitAttempted: true };
  }
}

/** Errors the respondent should currently see. */
export function visibleErrors(state: FillState, errors: Record<string, string>): Record<string, string> {
  if (state.submitAttempted) return errors;
  return Object.fromEntries(Object.entries(errors).filter(([id]) => state.touched[id]));
}
