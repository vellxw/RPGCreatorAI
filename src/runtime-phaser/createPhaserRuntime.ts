import { adaptManifestForPhaser } from './assets/manifestAdapter';
import { resolvePhaserRenderer } from './capabilities/canvasFallback';
import { PhaserRendererBridge } from './rendererBridge';
import { createBootScene } from './scenes/BootScene';
import { createPlayScene } from './scenes/PlayScene';
import type { PhaserGame, PhaserNamespace, PhaserRuntimeOptions } from './types';

let phaserModulePromise: Promise<PhaserNamespace> | null = null;

async function loadPhaser(): Promise<PhaserNamespace> {
  if (!phaserModulePromise) {
    // Phaser is shipped as a lazy Vite chunk so the editor's startup path does
    // not pay for the renderer until a browser playtest requests it. Reuse the
    // same promise when multiple playtests mount concurrently.
    phaserModulePromise = import('phaser')
      .then((module) => (module.default ?? module) as unknown as PhaserNamespace)
      .catch((cause) => {
        phaserModulePromise = null;
        throw new Error('Phaser runtime is unavailable. Add the `phaser` package or inject options.phaser.', { cause });
      });
  }

  return phaserModulePromise;
}

/** Mounts an optional Phaser view without changing the React editor or native runtime. */
export async function createPhaserRuntime(options: PhaserRuntimeOptions): Promise<PhaserGame> {
  const Phaser = options.phaser ?? await loadPhaser();
  const bridge = new PhaserRendererBridge(options.simulation, options.maxFrameDeltaMs);
  const assets = adaptManifestForPhaser(options.assetManifest, options.assetBaseUrl);
  const BootScene = createBootScene(Phaser, assets);
  const PlayScene = createPlayScene(
    Phaser,
    bridge,
    options.backgroundColor ?? '#0c0e14',
    options.onSnapshot,
  );
  const scale = Phaser.Scale;

  return new Phaser.Game({
    type: resolvePhaserRenderer(Phaser, options.renderer),
    parent: options.parent,
    width: options.width,
    height: options.height,
    backgroundColor: options.backgroundColor ?? '#0c0e14',
    pixelArt: true,
    roundPixels: true,
    scene: [BootScene, PlayScene],
    scale: scale ? {
      mode: scale.FIT,
      autoCenter: scale.CENTER_BOTH,
      width: options.width,
      height: options.height,
    } : undefined,
  });
}
