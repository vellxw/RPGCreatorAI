import { describe, expect, it } from 'vitest';
import {
  decideSaveAndPlaytest,
  type SaveAndPlaytestContext,
} from '../saveAndPlaytest';

const baseContext: SaveAndPlaytestContext = {
  dirty: true,
  errorCount: 0,
  warningCount: 0,
  runtimeAvailable: true,
};

describe('decideSaveAndPlaytest', () => {
  it('saves and launches the native runtime when validation is clean', () => {
    const outcome = decideSaveAndPlaytest(baseContext);
    expect(outcome.kind).toBe('saved-and-playtested');
    expect(outcome.dirty).toBe(false);
    expect(outcome.errorCount).toBe(0);
  });

  it('blocks save and surfaces a clear recovery message when there are errors', () => {
    const outcome = decideSaveAndPlaytest({ ...baseContext, errorCount: 2 });
    expect(outcome.kind).toBe('save-blocked');
    expect(outcome.errorCount).toBe(2);
    expect(outcome.message).toContain('Validation is blocking the save');
  });

  it('falls back to the in-editor playtest view when the runtime is not available', () => {
    const outcome = decideSaveAndPlaytest({ ...baseContext, runtimeAvailable: false });
    expect(outcome.kind).toBe('saved-and-routed');
    expect(outcome.dirty).toBe(false);
    expect(outcome.message).toContain('native runtime is not available');
  });

  it('propagates warning count even when the save succeeds', () => {
    const outcome = decideSaveAndPlaytest({ ...baseContext, warningCount: 3 });
    expect(outcome.warningCount).toBe(3);
    expect(outcome.kind).toBe('saved-and-playtested');
  });
});
