import { describe, it, expect } from 'vitest';
import {
  previewControlsReducer,
  defaultPreviewControlsState,
  type PreviewControlsAction,
  type PreviewControlsState,
} from '../previewControls';

function dispatch(state: PreviewControlsState, action: PreviewControlsAction) {
  return previewControlsReducer(state, action);
}

describe('previewControlsReducer', () => {
  it('starts in the pending state with no decision', () => {
    expect(defaultPreviewControlsState.phase).toBe('pending');
    expect(defaultPreviewControlsState.decision).toBeNull();
    expect(defaultPreviewControlsState.decidedAt).toBeNull();
  });

  it('moves pending -> validating -> valid on a successful validation pass', () => {
    let s = dispatch(defaultPreviewControlsState, { type: 'beginValidation' });
    expect(s.phase).toBe('validating');
    s = dispatch(s, { type: 'validationSucceeded' });
    expect(s.phase).toBe('valid');
    expect(s.decision).toBeNull();
  });

  it('moves validating -> invalid when validation reports errors', () => {
    let s = dispatch(defaultPreviewControlsState, { type: 'beginValidation' });
    s = dispatch(s, { type: 'validationFailed', errors: ['Map width must be positive'] });
    expect(s.phase).toBe('invalid');
    expect(s.errors).toEqual(['Map width must be positive']);
  });

  it('allows apply only from valid', () => {
    expect(previewControlsReducer(defaultPreviewControlsState, { type: 'apply' }).phase).toBe('pending');
    let s = dispatch(defaultPreviewControlsState, { type: 'beginValidation' });
    s = dispatch(s, { type: 'validationSucceeded' });
    s = dispatch(s, { type: 'apply' });
    expect(s.phase).toBe('applied');
    expect(s.decision).toBe('applied');
    expect(s.decidedAt).not.toBeNull();
  });

  it('allows reject from pending, valid, or invalid', () => {
    let s = dispatch(defaultPreviewControlsState, { type: 'reject' });
    expect(s.phase).toBe('rejected');
    expect(s.decision).toBe('rejected');
    s = dispatch(defaultPreviewControlsState, { type: 'beginValidation' });
    s = dispatch(s, { type: 'validationSucceeded' });
    s = dispatch(s, { type: 'reject' });
    expect(s.phase).toBe('rejected');
    s = dispatch(defaultPreviewControlsState, { type: 'beginValidation' });
    s = dispatch(s, { type: 'validationFailed', errors: ['x'] });
    s = dispatch(s, { type: 'reject' });
    expect(s.phase).toBe('rejected');
  });

  it('does not allow apply from invalid', () => {
    let s = dispatch(defaultPreviewControlsState, { type: 'beginValidation' });
    s = dispatch(s, { type: 'validationFailed', errors: ['x'] });
    s = dispatch(s, { type: 'apply' });
    expect(s.phase).toBe('invalid');
    expect(s.decision).toBeNull();
  });

  it('does not allow apply twice (idempotent terminal state)', () => {
    let s = dispatch(defaultPreviewControlsState, { type: 'beginValidation' });
    s = dispatch(s, { type: 'validationSucceeded' });
    s = dispatch(s, { type: 'apply' });
    const decidedAt = s.decidedAt;
    s = dispatch(s, { type: 'apply' });
    expect(s.phase).toBe('applied');
    expect(s.decidedAt).toBe(decidedAt);
  });

  it('does not allow reject twice (idempotent terminal state)', () => {
    let s = dispatch(defaultPreviewControlsState, { type: 'reject' });
    const decidedAt = s.decidedAt;
    s = dispatch(s, { type: 'reject' });
    expect(s.phase).toBe('rejected');
    expect(s.decidedAt).toBe(decidedAt);
  });

  it('reset returns to default state', () => {
    let s = dispatch(defaultPreviewControlsState, { type: 'beginValidation' });
    s = dispatch(s, { type: 'validationSucceeded' });
    s = dispatch(s, { type: 'reset' });
    expect(s).toEqual(defaultPreviewControlsState);
  });

  it('does not record decidedAt when the action is not a terminal decision', () => {
    let s = dispatch(defaultPreviewControlsState, { type: 'beginValidation' });
    expect(s.decidedAt).toBeNull();
    s = dispatch(s, { type: 'validationSucceeded' });
    expect(s.decidedAt).toBeNull();
  });
});
