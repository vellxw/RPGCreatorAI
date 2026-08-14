export interface AndroidRendererFailure {
  timestampMs: number;
  didCrash: boolean;
  /** A native mirror or durable autosave exists outside the failed renderer. */
  hasRecoverySave: boolean;
}

export type AndroidRendererFallbackStrategy = 'reload' | 'show-fallback';

export interface AndroidRendererFallbackDecision {
  /** Native WebViewClient implementations should return this value. */
  handled: true;
  strategy: AndroidRendererFallbackStrategy;
  disposeRenderer: true;
  releaseAllInput: true;
  retryNumber: number;
  delayMs: number;
  restoreFrom: 'native-save' | 'clean-start' | 'none';
  reason: 'renderer-crashed' | 'renderer-killed' | 'retry-limit';
}

export interface AndroidRendererFallbackOptions {
  maxAutomaticRetries: number;
  retryWindowMs: number;
  stableAfterMs: number;
  baseDelayMs: number;
}

const DEFAULT_OPTIONS: AndroidRendererFallbackOptions = {
  maxAutomaticRetries: 2,
  retryWindowMs: 30_000,
  stableAfterMs: 10_000,
  baseDelayMs: 250,
};

/**
 * Bounded renderer recovery policy for `onRenderProcessGone` or an equivalent
 * Capacitor host event. It always marks the failure handled, but stops
 * automatic reloads before they become a crash loop.
 */
export class AndroidRendererFallbackController {
  private readonly options: AndroidRendererFallbackOptions;
  private failures: number[] = [];
  private lastFailureMs?: number;

  constructor(options: Partial<AndroidRendererFallbackOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    assertOptions(this.options);
  }

  recordFailure(failure: AndroidRendererFailure): AndroidRendererFallbackDecision {
    assertTimestamp(failure.timestampMs);
    const windowStart = failure.timestampMs - this.options.retryWindowMs;
    this.failures = this.failures.filter(timestamp => timestamp >= windowStart);
    this.failures.push(failure.timestampMs);
    this.lastFailureMs = failure.timestampMs;

    const retryNumber = this.failures.length;
    if (retryNumber > this.options.maxAutomaticRetries) {
      return {
        handled: true,
        strategy: 'show-fallback',
        disposeRenderer: true,
        releaseAllInput: true,
        retryNumber,
        delayMs: 0,
        restoreFrom: 'none',
        reason: 'retry-limit',
      };
    }

    return {
      handled: true,
      strategy: 'reload',
      disposeRenderer: true,
      releaseAllInput: true,
      retryNumber,
      delayMs: this.options.baseDelayMs * Math.pow(2, retryNumber - 1),
      restoreFrom: failure.hasRecoverySave ? 'native-save' : 'clean-start',
      reason: failure.didCrash ? 'renderer-crashed' : 'renderer-killed',
    };
  }

  /** Clears the retry budget only after a renderer remained healthy long enough. */
  markHealthy(timestampMs: number): boolean {
    assertTimestamp(timestampMs);
    if (this.lastFailureMs === undefined) return true;
    if (timestampMs - this.lastFailureMs < this.options.stableAfterMs) return false;
    this.failures = [];
    this.lastFailureMs = undefined;
    return true;
  }

  getFailureCount(): number {
    return this.failures.length;
  }
}

function assertOptions(options: AndroidRendererFallbackOptions): void {
  if (!Number.isSafeInteger(options.maxAutomaticRetries) || options.maxAutomaticRetries < 0) {
    throw new Error('Android renderer maxAutomaticRetries must be a non-negative integer.');
  }
  for (const [name, value] of Object.entries({
    retryWindowMs: options.retryWindowMs,
    stableAfterMs: options.stableAfterMs,
    baseDelayMs: options.baseDelayMs,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Android renderer ${name} must be a non-negative finite number.`);
    }
  }
}

function assertTimestamp(timestampMs: number): void {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new Error('Android renderer timestampMs must be a non-negative finite number.');
  }
}
