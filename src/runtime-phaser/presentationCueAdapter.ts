import type {
  RuntimeAudioCue,
  RuntimePresentationCue,
  RuntimeTransitionCue,
} from '../runtime-core';
import type { PhaserDisplayObject, PhaserSceneLike, PhaserSoundLike } from './types';

function unitInterval(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function boundedDuration(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(30_000, value))
    : 0;
}

/**
 * Disposable Phaser-only consumer for simulation cues. It never fetches an
 * asset: missing preloaded keys degrade to a deterministic no-op offline.
 */
export class PhaserPresentationCueAdapter {
  private readonly channels = new Map<RuntimeAudioCue['channel'], PhaserSoundLike>();
  private background?: PhaserDisplayObject;

  constructor(private readonly scene: PhaserSceneLike) {}

  apply(cues: readonly RuntimePresentationCue[]): void {
    for (const cue of cues) {
      if (cue.type === 'audio') this.applyAudio(cue);
      else this.applyTransition(cue);
    }
  }

  destroy(): void {
    for (const channel of [...this.channels.keys()]) this.stopChannel(channel);
    this.background?.destroy();
    this.background = undefined;
  }

  private applyAudio(cue: RuntimeAudioCue): void {
    if (cue.action === 'stop') {
      this.stopChannel(cue.channel);
      return;
    }
    if (cue.action === 'fade') {
      this.fadeChannel(cue);
      return;
    }
    if (!cue.assetId || !this.scene.sound) return;
    if (this.scene.cache?.audio && !this.scene.cache.audio.exists(cue.assetId)) return;

    this.stopChannel(cue.channel);
    const volume = unitInterval(cue.volume, 1);
    try {
      const sound = this.scene.sound.add(cue.assetId, { volume, loop: cue.loop ?? false });
      this.channels.set(cue.channel, sound);
      sound.play({ volume, loop: cue.loop ?? false });
    } catch {
      // A corrupt/unsupported local audio file must not block the VN scene.
      this.stopChannel(cue.channel);
    }
  }

  private fadeChannel(cue: RuntimeAudioCue): void {
    const sound = this.channels.get(cue.channel);
    if (!sound) return;
    const volume = unitInterval(cue.volume, 0);
    const duration = boundedDuration(cue.fadeMs);
    const finish = () => {
      sound.setVolume?.(volume);
      sound.volume = volume;
      if (volume === 0) this.stopChannel(cue.channel, sound);
    };
    if (duration > 0 && this.scene.tweens) {
      this.scene.tweens.add({ targets: sound, volume, duration, onComplete: finish });
    } else {
      finish();
    }
  }

  private stopChannel(channel: RuntimeAudioCue['channel'], expected?: PhaserSoundLike): void {
    const sound = this.channels.get(channel);
    if (!sound || (expected && sound !== expected)) return;
    try { sound.stop(); } catch { /* Offline fallback remains silent. */ }
    try { sound.destroy?.(); } catch { /* Optional Phaser cleanup. */ }
    this.channels.delete(channel);
  }

  private applyTransition(cue: RuntimeTransitionCue): void {
    if (cue.clearBackground) {
      this.background?.destroy();
      this.background = undefined;
    }
    if (cue.backgroundAssetId
      && (!this.scene.textures || this.scene.textures.exists(cue.backgroundAssetId))) {
      try {
        const width = this.scene.cameras.main.width ?? 960;
        const height = this.scene.cameras.main.height ?? 540;
        const next = this.scene.add.image(width / 2, height / 2, cue.backgroundAssetId);
        next.setOrigin?.(0.5, 0.5);
        next.setScrollFactor?.(0, 0);
        next.setDisplaySize?.(width, height);
        next.setDepth(9_000);
        this.background?.destroy();
        this.background = next;
      } catch {
        // Missing or undecodable local backgrounds leave the previous view intact.
      }
    }

    const duration = boundedDuration(cue.durationMs);
    if (cue.style === 'flash') {
      this.scene.cameras.main.flash?.(duration, 255, 255, 255);
    } else if (cue.style !== 'cut') {
      // Fade is the common offline-safe fallback for dissolve and slide too.
      this.scene.cameras.main.fadeIn?.(duration, 0, 0, 0);
    }
  }
}
