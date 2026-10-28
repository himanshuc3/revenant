import { describe, expect, it } from 'vitest';
import { fillReducer, initFillState, visibleErrors } from './fillReducer';

describe('fillReducer', () => {
  it('sets and deletes values, marking the field touched', () => {
    let s = initFillState({});
    s = fillReducer(s, { type: 'set', fieldId: 'a', value: 'x' });
    expect(s.values).toEqual({ a: 'x' });
    expect(s.touched).toEqual({ a: true });
    s = fillReducer(s, { type: 'set', fieldId: 'a', value: undefined });
    expect(s.values).toEqual({});
  });

  it('shows no errors on first paint, then only touched ones, then all after a submit attempt', () => {
    const errors = { a: 'req', b: 'req' };
    let s = initFillState({});
    expect(visibleErrors(s, errors)).toEqual({});
    s = fillReducer(s, { type: 'set', fieldId: 'a', value: undefined });
    expect(visibleErrors(s, errors)).toEqual({ a: 'req' });
    s = fillReducer(s, { type: 'submitAttempted' });
    expect(visibleErrors(s, errors)).toEqual(errors);
  });
});
