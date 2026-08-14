import { describe, expect, it } from 'vitest';
import { AndroidTouchController } from '../touch';

describe('AndroidTouchController', () => {
  it('supports direction plus action multitouch', () => {
    const touch = new AndroidTouchController({
      up: ['move.up'],
      action: ['interact'],
    });

    expect(touch.handle({ pointerId: 1, phase: 'down', controlId: 'up', timestampMs: 1 }).events)
      .toMatchObject([{ action: 'move.up', phase: 'pressed' }]);
    expect(touch.handle({ pointerId: 2, phase: 'down', controlId: 'action', timestampMs: 2 }).events)
      .toMatchObject([{ action: 'interact', phase: 'pressed' }]);
    expect(touch.getActivePointerCount()).toBe(2);
  });

  it('keeps a control pressed until every finger leaves it', () => {
    const touch = new AndroidTouchController({ action: ['interact'] });
    touch.handle({ pointerId: 1, phase: 'down', controlId: 'action', timestampMs: 1 });
    expect(touch.handle({ pointerId: 2, phase: 'down', controlId: 'action', timestampMs: 2 }).events)
      .toEqual([]);
    expect(touch.handle({ pointerId: 1, phase: 'up', timestampMs: 3 }).events).toEqual([]);
    expect(touch.handle({ pointerId: 2, phase: 'cancel', timestampMs: 4 }).events)
      .toMatchObject([{ action: 'interact', phase: 'released' }]);
  });

  it('slides between controls without churning a shared action', () => {
    const touch = new AndroidTouchController({ leftA: ['move.left'], leftB: ['move.left'] });
    touch.handle({ pointerId: 1, phase: 'down', controlId: 'leftA', timestampMs: 1 });
    expect(touch.handle({ pointerId: 1, phase: 'move', controlId: 'leftB', timestampMs: 2 }).events)
      .toEqual([]);
  });

  it('releaseAll clears stuck input after lifecycle loss', () => {
    const touch = new AndroidTouchController({ up: ['move.up'], action: ['interact'] });
    touch.handle({ pointerId: 1, phase: 'down', controlId: 'up', timestampMs: 1 });
    touch.handle({ pointerId: 2, phase: 'down', controlId: 'action', timestampMs: 2 });

    expect(touch.releaseAll(3).map(event => [event.action, event.phase])).toEqual([
      ['move.up', 'released'],
      ['interact', 'released'],
    ]);
    expect(touch.getActivePointerCount()).toBe(0);
  });
});
