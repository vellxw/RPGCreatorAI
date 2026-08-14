import { describe, expect, it } from 'vitest';
import { AndroidRendererFallbackController } from '../rendererFallback';

describe('AndroidRendererFallbackController', () => {
  it('reloads from a durable save and always handles renderer loss', () => {
    const fallback = new AndroidRendererFallbackController();
    expect(fallback.recordFailure({ timestampMs: 1, didCrash: true, hasRecoverySave: true }))
      .toMatchObject({
        handled: true,
        strategy: 'reload',
        restoreFrom: 'native-save',
        reason: 'renderer-crashed',
      });
  });

  it('stops automatic reloads before a crash loop', () => {
    const fallback = new AndroidRendererFallbackController({
      maxAutomaticRetries: 2,
      retryWindowMs: 1_000,
      baseDelayMs: 100,
    });
    expect(fallback.recordFailure({ timestampMs: 0, didCrash: false, hasRecoverySave: false }).delayMs)
      .toBe(100);
    expect(fallback.recordFailure({ timestampMs: 100, didCrash: false, hasRecoverySave: false }).delayMs)
      .toBe(200);
    expect(fallback.recordFailure({ timestampMs: 200, didCrash: false, hasRecoverySave: false }))
      .toMatchObject({ strategy: 'show-fallback', reason: 'retry-limit', restoreFrom: 'none' });
  });

  it('resets the retry budget only after a stable renderer interval', () => {
    const fallback = new AndroidRendererFallbackController({ stableAfterMs: 500 });
    fallback.recordFailure({ timestampMs: 100, didCrash: true, hasRecoverySave: false });
    expect(fallback.markHealthy(599)).toBe(false);
    expect(fallback.markHealthy(600)).toBe(true);
    expect(fallback.getFailureCount()).toBe(0);
  });

  it('starts a fresh retry window after old failures expire', () => {
    const fallback = new AndroidRendererFallbackController({ retryWindowMs: 100 });
    fallback.recordFailure({ timestampMs: 0, didCrash: true, hasRecoverySave: false });
    expect(fallback.recordFailure({ timestampMs: 101, didCrash: true, hasRecoverySave: false }).retryNumber)
      .toBe(1);
  });
});
