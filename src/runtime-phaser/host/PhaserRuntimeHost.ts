import type { GameBundleV1 } from '../../runtime-core';
import { mountRuntimeDialogueSurface } from '../../runtime-ui';
import { normalizeVisualProfile } from '../../visual/visualProfile';
import { adaptManifestForPhaser, createRuntimeAssetManifest } from '../assets/manifestAdapter';
import { createPhaserRuntime } from '../createPhaserRuntime';
import type {
  PhaserGame,
  PhaserNamespace,
  PhaserRendererPreference,
  RuntimeRenderSnapshot,
  SimulationPort,
} from '../types';

export interface PhaserRuntimeHostOptions {
  container: HTMLElement;
  bundle: GameBundleV1;
  simulation: SimulationPort;
  width?: number;
  height?: number;
  renderer?: PhaserRendererPreference;
  maxFrameDeltaMs?: number;
  backgroundColor?: string;
  /** Optional observer used by embedders that own their DOM HUD. */
  onSnapshot?: (snapshot: RuntimeRenderSnapshot) => void;
  /** Same-origin base for project-relative catalog assets. Defaults to `./`. */
  assetBaseUrl?: string;
  /** Useful for embedders that already own a Phaser module and for isolated tests. */
  phaser?: PhaserNamespace;
  /** Refresh Phaser's FIT scale when the containing editor panel changes size. */
  autoResize?: boolean;
}

export interface PhaserRuntimeHost {
  readonly game: PhaserGame;
  readonly element: HTMLElement;
  readonly destroyed: boolean;
  /**
   * With dimensions, changes the authored logical viewport. Without them it
   * only refreshes FIT layout after the surrounding editor panel was resized.
   */
  resize(width?: number, height?: number): void;
  destroy(): void;
}

export interface PhaserHostViewport {
  width: number;
  height: number;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value as number) > 0 ? value as number : fallback;
}

export function resolvePhaserHostViewport(
  bundle: GameBundleV1,
  override: Partial<PhaserHostViewport> = {},
): PhaserHostViewport {
  const profile = normalizeVisualProfile(bundle.project.visualProfile);
  return {
    width: positiveInteger(override.width, profile.baseResolution.width),
    height: positiveInteger(override.height, profile.baseResolution.height),
  };
}

function createMountElement(container: HTMLElement): HTMLDivElement {
  const element = container.ownerDocument.createElement('div');
  element.dataset.rpgCreatorRuntime = 'phaser';
  element.style.width = '100%';
  element.style.height = '100%';
  element.style.minWidth = '0';
  element.style.minHeight = '0';
  element.style.overflow = 'hidden';
  element.style.position = 'relative';
  container.appendChild(element);
  return element;
}

/**
 * Owns one disposable Phaser instance mounted inside an editor-controlled
 * element. The caller keeps ownership of the GameBundle and simulation.
 */
export async function mountPhaserRuntime(
  options: PhaserRuntimeHostOptions,
): Promise<PhaserRuntimeHost> {
  const viewport = resolvePhaserHostViewport(options.bundle, options);
  const runtimeManifest = createRuntimeAssetManifest(options.bundle);
  const assetUrls = new Map(
    adaptManifestForPhaser(runtimeManifest, options.assetBaseUrl)
      .map(asset => [asset.key, asset.url] as const),
  );
  const portraitNames = new Map(
    (options.bundle.databases.actors ?? [])
      .filter(actor => actor.portraitAssetId)
      .map(actor => [actor.portraitAssetId as string, actor.name] as const),
  );
  const element = createMountElement(options.container);
  const dialogueSurface = mountRuntimeDialogueSurface(element);
  let game: PhaserGame;

  try {
    game = await createPhaserRuntime({
      parent: element,
      width: viewport.width,
      height: viewport.height,
      simulation: options.simulation,
      assetManifest: runtimeManifest,
      assetBaseUrl: options.assetBaseUrl,
      renderer: options.renderer,
      maxFrameDeltaMs: options.maxFrameDeltaMs,
      backgroundColor: options.backgroundColor,
      onSnapshot: snapshot => {
        const dialogue = snapshot.dialogue;
        dialogueSurface.render(dialogue ? {
          speaker: dialogue.speaker,
          text: dialogue.text,
          kind: dialogue.kind,
          choices: dialogue.choices,
          endingId: dialogue.endingId,
          ...(dialogue.portraitAssetId
            ? {
                portraitUrl: assetUrls.get(dialogue.portraitAssetId),
                portraitAlt: portraitNames.get(dialogue.portraitAssetId) ?? dialogue.speaker,
              }
            : {}),
        } : undefined);
        options.onSnapshot?.(snapshot);
      },
      phaser: options.phaser,
    });
  } catch (error) {
    dialogueSurface.destroy();
    element.remove();
    throw error;
  }

  let isDestroyed = false;
  const resize = (width?: number, height?: number): void => {
    if (isDestroyed) return;
    if (width === undefined && height === undefined) {
      game.scale?.refresh?.();
      return;
    }
    if (!Number.isInteger(width) || (width as number) <= 0
      || !Number.isInteger(height) || (height as number) <= 0) {
      throw new Error('Phaser runtime resize requires positive integer width and height.');
    }
    game.scale?.resize(width as number, height as number);
  };

  const ResizeObserverCtor = element.ownerDocument.defaultView?.ResizeObserver
    ?? globalThis.ResizeObserver;
  const resizeObserver = options.autoResize !== false && ResizeObserverCtor
    ? new ResizeObserverCtor(() => resize())
    : undefined;
  resizeObserver?.observe(options.container);

  return {
    game,
    element,
    get destroyed() {
      return isDestroyed;
    },
    resize,
    destroy(): void {
      if (isDestroyed) return;
      isDestroyed = true;
      resizeObserver?.disconnect();
      try {
        game.destroy(true);
      } finally {
        dialogueSurface.destroy();
        element.remove();
      }
    },
  };
}
