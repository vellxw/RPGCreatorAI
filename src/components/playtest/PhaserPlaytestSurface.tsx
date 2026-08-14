import { AlertTriangle, Gamepad2, Loader2, RotateCcw } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  PhaserRendererPreference,
  RuntimeAssetManifest,
  RuntimeRenderSnapshot,
  SimulationPort,
} from '../../runtime-phaser';
import { adaptManifestForPhaser } from '../../runtime-phaser';
import { Button } from '../ui/Button';
import {
  usePhaserPlaytest,
  type PhaserRuntimeFactory,
} from './usePhaserPlaytest';

const EMPTY_ASSET_MANIFEST: RuntimeAssetManifest = { schemaVersion: 1, assets: [] };

export interface PhaserPlaytestSurfaceProps {
  simulation?: SimulationPort | null;
  assetManifest?: RuntimeAssetManifest | unknown;
  assetBaseUrl?: string;
  width?: number;
  height?: number;
  renderer?: PhaserRendererPreference;
  backgroundColor?: string;
  className?: string;
  emptyState?: ReactNode;
  errorFallback?: ReactNode;
  onError?: (error: Error) => void;
  /** Intended for deterministic host tests; production uses the lazy Phaser runtime. */
  runtimeFactory?: PhaserRuntimeFactory;
}

/**
 * Self-contained browser playtest surface. It deliberately does not start or
 * replace the native playtest process, so both launch paths can coexist.
 */
export function PhaserPlaytestSurface({
  simulation,
  assetManifest = EMPTY_ASSET_MANIFEST,
  assetBaseUrl,
  width = 960,
  height = 540,
  renderer = 'auto',
  backgroundColor = '#0c0e14',
  className = '',
  emptyState,
  errorFallback,
  onError,
  runtimeFactory,
}: PhaserPlaytestSurfaceProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const dialogueKeyRef = useRef('');
  const [dialogue, setDialogue] = useState<RuntimeRenderSnapshot['dialogue']>();
  const handleSnapshot = useCallback((snapshot: RuntimeRenderSnapshot) => {
    const next = snapshot.dialogue;
    const key = next
      ? `${next.eventId}\u0000${next.kind ?? 'dialogue'}\u0000${next.speaker ?? ''}\u0000${next.text}\u0000${next.portraitAssetId ?? ''}\u0000${next.endingId ?? ''}\u0000${JSON.stringify(next.choices ?? [])}`
      : '';
    if (dialogueKeyRef.current === key) return;
    dialogueKeyRef.current = key;
    setDialogue(next);
  }, []);
  const portraitUrl = useMemo(() => {
    if (!dialogue?.portraitAssetId) return undefined;
    try {
      return adaptManifestForPhaser(assetManifest, assetBaseUrl)
        .find(asset => asset.key === dialogue.portraitAssetId)?.url;
    } catch {
      // The runtime hook reports malformed manifests through its own error UI.
      return undefined;
    }
  }, [assetBaseUrl, assetManifest, dialogue?.portraitAssetId]);
  const { status, error, retry } = usePhaserPlaytest({
    mountRef,
    enabled: simulation != null,
    simulation: simulation as SimulationPort,
    assetManifest,
    assetBaseUrl,
    width,
    height,
    renderer,
    backgroundColor,
    onSnapshot: handleSnapshot,
    onError,
    runtimeFactory,
  });

  return (
    <section
      aria-label="Browser playtest"
      className={`relative isolate overflow-hidden rounded-lg border border-slate-700 bg-slate-950 ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        ref={mountRef}
        data-testid="phaser-playtest-mount"
        className="absolute inset-0 [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full"
        aria-hidden={status !== 'running'}
      />

      {status === 'running' && (
        <p className="sr-only" role="status" aria-live="polite">
          Browser playtest is running. Use the arrow keys or WASD to move and Enter to interact.
        </p>
      )}

      {status === 'running' && dialogue && (
        <section
          className={`pointer-events-none absolute inset-x-[clamp(12px,4vw,48px)] bottom-[clamp(12px,3vh,32px)] z-30 grid min-h-[clamp(92px,19vh,172px)] items-end gap-[clamp(10px,2vw,24px)] border border-rose-300/50 bg-[linear-gradient(180deg,rgba(37,11,16,.94),rgba(18,8,12,.98))] p-[clamp(12px,2vw,24px)] text-stone-100 shadow-2xl ${dialogue.kind === 'choice' ? 'grid-cols-[1fr]' : 'grid-cols-[minmax(70px,18%)_1fr]'}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {dialogue.kind !== 'choice' && (
            <div className="relative h-[clamp(74px,17vh,150px)] overflow-hidden border border-white/15 bg-slate-950/80">
              <span className="absolute inset-0 grid place-items-center font-serif text-[clamp(24px,6vw,56px)] font-bold text-rose-300/70" aria-hidden="true">
                {Array.from(dialogue.speaker?.trim() || '?')[0]?.toLocaleUpperCase() ?? '?'}
              </span>
              {portraitUrl && (
                <img
                  key={portraitUrl}
                  src={portraitUrl}
                  alt={dialogue.speaker ? `Retrato de ${dialogue.speaker}` : 'Retrato del personaje'}
                  className="absolute inset-0 h-full w-full object-contain object-bottom"
                  onError={event => { event.currentTarget.hidden = true; }}
                />
              )}
            </div>
          )}
          <div className="min-w-0 self-center">
            {dialogue.speaker && (
              <strong className="mb-2 block text-[clamp(12px,1.8vw,18px)] uppercase tracking-[.08em] text-rose-200">
                {dialogue.speaker}
              </strong>
            )}
            <p className="m-0 text-pretty font-serif text-[clamp(14px,2.2vw,22px)] font-medium leading-relaxed">
              {dialogue.text}
            </p>
            {dialogue.choices && dialogue.choices.length > 0 && (
              <ol className="mt-3 grid list-none gap-2 p-0" aria-label="Opciones de diálogo">
                {dialogue.choices.map(choice => (
                  <li
                    key={choice.id}
                    aria-current={choice.selected ? 'true' : 'false'}
                    className={`border-l-[3px] px-2 py-1 text-[clamp(13px,1.8vw,18px)] font-semibold leading-snug ${choice.selected ? 'border-rose-200 bg-rose-200/15 text-stone-50' : 'border-transparent text-stone-300'}`}
                  >
                    <span aria-hidden="true">{choice.selected ? '▶' : ' '}</span>{' '}
                    {choice.text}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {status === 'mounting' && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/90 text-sm text-slate-200"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          Starting browser playtest…
        </div>
      )}

      {status === 'empty' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-slate-300">
          <Gamepad2 size={30} className="text-slate-500" aria-hidden="true" />
          {emptyState ?? (
            <div>
              <p className="text-sm font-semibold text-slate-200">Nothing to play yet</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Compile the current project before opening the embedded playtest.
              </p>
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center"
          role="alert"
        >
          <AlertTriangle size={28} className="text-amber-400" aria-hidden="true" />
          {errorFallback ?? (
            <div>
              <p className="text-sm font-semibold text-slate-100">Browser playtest could not start</p>
              <p className="mt-1 max-w-lg text-xs leading-5 text-slate-400">
                {error?.message ?? 'The renderer returned an unknown error.'}
              </p>
            </div>
          )}
          <Button size="sm" onClick={retry} icon={<RotateCcw size={14} />}>
            Try again
          </Button>
          <p className="text-[11px] text-slate-500">The native playtest remains available.</p>
        </div>
      )}
    </section>
  );
}
