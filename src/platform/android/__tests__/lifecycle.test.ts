import { describe, expect, it } from 'vitest';
import { AndroidLifecycleController } from '../lifecycle';

describe('AndroidLifecycleController', () => {
  it('quiesces once across the normal onPause/onStop pair', () => {
    const lifecycle = new AndroidLifecycleController();
    lifecycle.dispatch({ type: 'resume', timestampMs: 1 });

    const paused = lifecycle.dispatch({ type: 'pause', timestampMs: 2, reason: 'home' });
    expect(paused.state).toBe('background');
    expect(paused.effects.map(effect => effect.type)).toEqual([
      'input.release-all',
      'save.flush',
      'runtime.suspend',
      'audio.suspend',
    ]);

    expect(lifecycle.dispatch({ type: 'stop', timestampMs: 3 }).effects).toEqual([]);
  });

  it('requires a trusted gesture before audio resumes', () => {
    const lifecycle = new AndroidLifecycleController();
    const resumed = lifecycle.dispatch({ type: 'resume', timestampMs: 10 });

    expect(resumed.effects.map(effect => effect.type)).toEqual([
      'input.release-all',
      'runtime.resume',
      'audio.resume-after-gesture',
    ]);
    expect(lifecycle.dispatch({ type: 'resume', timestampMs: 11 }).effects).toEqual([]);
  });

  it('treats UI-hidden memory pressure as a background boundary and trims caches', () => {
    const lifecycle = new AndroidLifecycleController();
    lifecycle.dispatch({ type: 'resume', timestampMs: 1 });
    const transition = lifecycle.dispatch({
      type: 'trim-memory',
      timestampMs: 2,
      level: 'ui-hidden',
    });

    expect(transition.state).toBe('background');
    expect(transition.effects.at(-1)).toEqual({
      type: 'cache.trim',
      timestampMs: 2,
      level: 'ui-hidden',
    });
  });

  it('makes destroy terminal', () => {
    const lifecycle = new AndroidLifecycleController();
    lifecycle.dispatch({ type: 'resume', timestampMs: 1 });
    const destroyed = lifecycle.dispatch({ type: 'destroy', timestampMs: 2 });
    expect(destroyed.effects.at(-1)?.type).toBe('runtime.destroy');
    expect(lifecycle.dispatch({ type: 'resume', timestampMs: 3 }).state).toBe('destroyed');
  });
});
