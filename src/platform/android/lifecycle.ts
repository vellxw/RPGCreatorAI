export type AndroidLifecycleState = 'cold' | 'foreground' | 'background' | 'destroyed';

export type AndroidMemoryPressure =
  | 'ui-hidden'
  | 'running-low'
  | 'running-critical'
  | 'complete';

export type AndroidLifecycleSignal =
  | { type: 'resume'; timestampMs: number }
  | { type: 'pause'; timestampMs: number; reason?: string }
  | { type: 'stop'; timestampMs: number; reason?: string }
  | { type: 'trim-memory'; timestampMs: number; level: AndroidMemoryPressure }
  | { type: 'destroy'; timestampMs: number };

export type AndroidLifecycleEffect =
  | { type: 'input.release-all'; timestampMs: number }
  | { type: 'save.flush'; timestampMs: number; reason: string }
  | { type: 'runtime.suspend'; timestampMs: number; reason: string }
  | { type: 'audio.suspend'; timestampMs: number; reason: string }
  | { type: 'runtime.resume'; timestampMs: number }
  | { type: 'audio.resume-after-gesture'; timestampMs: number }
  | { type: 'cache.trim'; timestampMs: number; level: AndroidMemoryPressure }
  | { type: 'runtime.destroy'; timestampMs: number };

export interface AndroidLifecycleTransition {
  sequence: number;
  previous: AndroidLifecycleState;
  state: AndroidLifecycleState;
  effects: readonly AndroidLifecycleEffect[];
}

/**
 * Pure lifecycle policy shared by a WebView host and a Capacitor adapter.
 *
 * Native callbacks may be duplicated (`onPause` followed by `onStop`), so
 * transitions are idempotent. Audio is never resumed from a lifecycle
 * callback: the host must wait for a new trusted user gesture.
 */
export class AndroidLifecycleController {
  private state: AndroidLifecycleState = 'cold';
  private sequence = 0;

  getState(): AndroidLifecycleState {
    return this.state;
  }

  dispatch(signal: AndroidLifecycleSignal): AndroidLifecycleTransition {
    assertTimestamp(signal.timestampMs);
    const previous = this.state;
    const effects: AndroidLifecycleEffect[] = [];

    if (this.state === 'destroyed') {
      return this.transition(previous, effects);
    }

    switch (signal.type) {
      case 'resume':
        if (this.state !== 'foreground') {
          this.state = 'foreground';
          effects.push(
            { type: 'input.release-all', timestampMs: signal.timestampMs },
            { type: 'runtime.resume', timestampMs: signal.timestampMs },
            { type: 'audio.resume-after-gesture', timestampMs: signal.timestampMs },
          );
        }
        break;

      case 'pause':
      case 'stop': {
        if (this.state === 'foreground') {
          const reason = signal.reason?.trim() || signal.type;
          this.state = 'background';
          effects.push(...quiesceEffects(signal.timestampMs, reason));
        } else if (this.state === 'cold') {
          this.state = 'background';
        }
        break;
      }

      case 'trim-memory':
        if (signal.level === 'ui-hidden' && this.state === 'foreground') {
          this.state = 'background';
          effects.push(...quiesceEffects(signal.timestampMs, 'trim-memory:ui-hidden'));
        }
        effects.push({
          type: 'cache.trim',
          timestampMs: signal.timestampMs,
          level: signal.level,
        });
        break;

      case 'destroy':
        if (this.state === 'foreground') {
          effects.push(...quiesceEffects(signal.timestampMs, 'destroy'));
        }
        this.state = 'destroyed';
        effects.push({ type: 'runtime.destroy', timestampMs: signal.timestampMs });
        break;
    }

    return this.transition(previous, effects);
  }

  private transition(
    previous: AndroidLifecycleState,
    effects: readonly AndroidLifecycleEffect[],
  ): AndroidLifecycleTransition {
    return {
      sequence: ++this.sequence,
      previous,
      state: this.state,
      effects,
    };
  }
}

function quiesceEffects(timestampMs: number, reason: string): AndroidLifecycleEffect[] {
  return [
    { type: 'input.release-all', timestampMs },
    { type: 'save.flush', timestampMs, reason },
    { type: 'runtime.suspend', timestampMs, reason },
    { type: 'audio.suspend', timestampMs, reason },
  ];
}

function assertTimestamp(timestampMs: number): void {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new Error('Android lifecycle timestampMs must be a non-negative finite number.');
  }
}
