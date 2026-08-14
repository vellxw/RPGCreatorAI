import type { PhaserAssetDescriptor } from '../assets/manifestAdapter';
import type { PhaserNamespace } from '../types';

export function createBootScene(
  Phaser: PhaserNamespace,
  assets: readonly PhaserAssetDescriptor[],
  nextSceneKey = 'PlayScene',
) {
  const SceneBase = Phaser.Scene;
  return class BootScene extends SceneBase {
    constructor() {
      super({ key: 'BootScene' });
    }

    preload(): void {
      for (const asset of assets) {
        if (asset.type === 'audio') {
          this.load.audio(asset.key, asset.url);
        } else if (asset.type === 'spritesheet' && asset.frameWidth && asset.frameHeight) {
          this.load.spritesheet(asset.key, asset.url, {
            frameWidth: asset.frameWidth,
            frameHeight: asset.frameHeight,
          });
        } else {
          this.load.image(asset.key, asset.url);
        }
      }
    }

    create(): void {
      this.scene.start(nextSceneKey);
    }
  };
}

