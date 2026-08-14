import type { RuntimeInputAction } from '../../runtime-core';
import { PhaserPresentationCueAdapter } from '../presentationCueAdapter';
import { PhaserRendererBridge } from '../rendererBridge';
import type { PhaserDisplayObject, PhaserNamespace, RuntimeRenderSnapshot } from '../types';

const KEY_ACTIONS: Readonly<Record<string, RuntimeInputAction>> = {
  ArrowUp: 'move.up', KeyW: 'move.up',
  ArrowDown: 'move.down', KeyS: 'move.down',
  ArrowLeft: 'move.left', KeyA: 'move.left',
  ArrowRight: 'move.right', KeyD: 'move.right',
  Enter: 'interact', Space: 'interact', KeyE: 'interact',
  Escape: 'cancel', KeyX: 'cancel',
  KeyM: 'menu', ShiftLeft: 'dash', ShiftRight: 'dash', KeyP: 'pause',
};

interface RenderedObject {
  object: PhaserDisplayObject;
  assetKey: string;
  fallback: boolean;
}

function fallbackColor(id: string): number {
  if (id.startsWith('background:')) return 0x151821;
  if (id === 'player') return 0x4d7c8a;
  return 0x8a3045;
}

export function createPlayScene(
  Phaser: PhaserNamespace,
  bridge: PhaserRendererBridge,
  defaultBackgroundColor: string,
  onSnapshot?: (snapshot: RuntimeRenderSnapshot) => void,
) {
  const SceneBase = Phaser.Scene;
  return class PlayScene extends SceneBase {
    private readonly objects = new Map<string, RenderedObject>();
    private presentationCues?: PhaserPresentationCueAdapter;
    private readonly onKeyDown = (event: KeyboardEvent) => this.forwardKey(event, 'pressed');
    private readonly onKeyUp = (event: KeyboardEvent) => this.forwardKey(event, 'released');

    constructor() {
      super({ key: 'PlayScene' });
    }

    create(): void {
      this.presentationCues = new PhaserPresentationCueAdapter(this);
      const keyboard = this.input.keyboard;
      keyboard?.on('keydown', this.onKeyDown);
      keyboard?.on('keyup', this.onKeyUp);
      this.events.once('shutdown', () => {
        keyboard?.off('keydown', this.onKeyDown);
        keyboard?.off('keyup', this.onKeyUp);
        this.presentationCues?.destroy();
        this.presentationCues = undefined;
        for (const rendered of this.objects.values()) rendered.object.destroy();
        this.objects.clear();
      });
      this.renderSnapshot(bridge.snapshot());
      this.presentationCues?.apply(bridge.drainPresentationCues());
    }

    update(_time: number, delta: number): void {
      this.renderSnapshot(bridge.advance(delta));
      this.presentationCues?.apply(bridge.drainPresentationCues());
    }

    private forwardKey(event: KeyboardEvent, phase: 'pressed' | 'released'): void {
      const action = KEY_ACTIONS[event.code];
      if (!action || (phase === 'pressed' && event.repeat)) return;
      event.preventDefault();
      bridge.input(action, phase, event.timeStamp);
    }

    private renderSnapshot(snapshot: RuntimeRenderSnapshot): void {
      onSnapshot?.(snapshot);
      this.cameras.main.setBackgroundColor(snapshot.backgroundColor ?? defaultBackgroundColor);
      this.cameras.main.setBounds(0, 0, snapshot.world.width, snapshot.world.height);
      this.cameras.main.setZoom(snapshot.camera?.zoom ?? 1);

      const liveIds = new Set(snapshot.sprites.map((sprite) => sprite.id));
      for (const [id, rendered] of this.objects) {
        if (!liveIds.has(id)) {
          rendered.object.destroy();
          this.objects.delete(id);
        }
      }

      for (const sprite of snapshot.sprites) {
        const fallback = this.textures ? !this.textures.exists(sprite.assetKey) : false;
        let rendered = this.objects.get(sprite.id);
        // A direction/action change can select a different horizontal strip.
        // Phaser Image objects retain their original texture, so recreate only
        // that disposable view object when the stable manifest key changes.
        if (rendered && (rendered.assetKey !== sprite.assetKey || rendered.fallback !== fallback)) {
          rendered.object.destroy();
          this.objects.delete(sprite.id);
          rendered = undefined;
        }
        if (!rendered) {
          const object = fallback
            ? this.add.rectangle(
                sprite.x,
                sprite.y,
                sprite.width ?? 32,
                sprite.height ?? 32,
                fallbackColor(sprite.id),
              )
            : this.add.image(sprite.x, sprite.y, sprite.assetKey, sprite.frame);
          rendered = { object, assetKey: sprite.assetKey, fallback };
          this.objects.set(sprite.id, rendered);
        }
        const object = rendered.object;
        object
          .setPosition(Math.round(sprite.x), Math.round(sprite.y))
          .setDepth(sprite.depth ?? 0)
          .setVisible(sprite.visible ?? true)
          .setAlpha(sprite.alpha ?? 1);
        object.setFlipX?.(sprite.flipX ?? false);
        object.setOrigin?.(sprite.originX ?? 0.5, sprite.originY ?? 0.5);
        if (sprite.width && sprite.height) object.setDisplaySize?.(sprite.width, sprite.height);
        if (!fallback && sprite.frame !== undefined) object.setFrame?.(sprite.frame);
      }

      if (snapshot.camera?.mode === 'follow-player' && snapshot.camera.followEntityId) {
        const target = this.objects.get(snapshot.camera.followEntityId)?.object;
        if (target) this.cameras.main.startFollow(target, true);
      } else {
        this.cameras.main.stopFollow();
      }
    }
  };
}
