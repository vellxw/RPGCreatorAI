import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  createPhaserRuntime,
  type PhaserGame,
  type PhaserRuntimeOptions,
} from '../../runtime-phaser';

export type PhaserPlaytestStatus = 'empty' | 'mounting' | 'running' | 'error';

export interface PhaserPlaytestState {
  status: PhaserPlaytestStatus;
  error: Error | null;
  retry: () => void;
}

export type PhaserRuntimeFactory = (options: PhaserRuntimeOptions) => Promise<PhaserGame>;

export interface UsePhaserPlaytestOptions extends Omit<PhaserRuntimeOptions, 'parent'> {
  mountRef: RefObject<HTMLDivElement | null>;
  enabled?: boolean;
  runtimeFactory?: PhaserRuntimeFactory;
  onError?: (error: Error) => void;
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/** Owns the complete lifecycle of one embedded Phaser instance. */
export function usePhaserPlaytest({
  mountRef,
  enabled = true,
  runtimeFactory = createPhaserRuntime,
  onError,
  ...runtimeOptions
}: UsePhaserPlaytestOptions): PhaserPlaytestState {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<PhaserPlaytestStatus>(enabled ? 'mounting' : 'empty');
  const [error, setError] = useState<Error | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled || !runtimeOptions.simulation) {
      setStatus('empty');
      setError(null);
      return;
    }

    const parent = mountRef.current;
    if (!parent) return;

    let disposed = false;
    let game: PhaserGame | null = null;
    setStatus('mounting');
    setError(null);

    void runtimeFactory({ ...runtimeOptions, parent })
      .then(instance => {
        if (disposed) {
          instance.destroy(true);
          return;
        }
        game = instance;
        setStatus('running');
      })
      .catch(cause => {
        if (disposed) return;
        const nextError = asError(cause);
        setError(nextError);
        setStatus('error');
        onErrorRef.current?.(nextError);
      });

    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, [
    attempt,
    enabled,
    mountRef,
    runtimeFactory,
    runtimeOptions.assetManifest,
    runtimeOptions.assetBaseUrl,
    runtimeOptions.backgroundColor,
    runtimeOptions.height,
    runtimeOptions.maxFrameDeltaMs,
    runtimeOptions.onSnapshot,
    runtimeOptions.phaser,
    runtimeOptions.renderer,
    runtimeOptions.simulation,
    runtimeOptions.width,
  ]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { status, error, retry };
}
