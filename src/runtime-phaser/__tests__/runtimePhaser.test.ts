import { describe, expect, it, vi } from 'vitest';
import {
  adaptManifestForPhaser,
  createRuntimeAssetManifest,
  resolvePhaserAssetUrl,
} from '../assets/manifestAdapter';
import { PhaserRendererBridge } from '../rendererBridge';
import { PhaserPresentationCueAdapter } from '../presentationCueAdapter';
import { createPlayScene } from '../scenes/PlayScene';
import type { PhaserNamespace, PhaserSceneLike, RuntimeRenderSnapshot } from '../types';

describe('Phaser runtime boundary', () => {
  it('preserves stable keys and prefers browser-ready source assets', () => {
    expect(adaptManifestForPhaser({
      schemaVersion: 1,
      assets: [{
        runtimeKey: 'hero.walk.down',
        kind: 'spritesheet',
        sourcePath: 'assets/generated/web/hero.png',
        runtimePath: 'assets/generated/runtime/hero.bmp',
        frameWidth: 32,
        frameHeight: 48,
      }],
    })).toEqual([{
      key: 'hero.walk.down',
      type: 'spritesheet',
      url: './assets/generated/web/hero.png',
      frameWidth: 32,
      frameHeight: 48,
    }]);
  });

  it('resolves horror portraits, backgrounds, and sprites below an offline appassets base', () => {
    const assets = adaptManifestForPhaser({
      schemaVersion: 1,
      assets: [
        { runtimeKey: 'portrait.damian', kind: 'image', runtimePath: 'assets/portraits/damian.webp' },
        { runtimeKey: 'background.facility-lobby', kind: 'image', runtimePath: 'assets/backgrounds/lobby.webp' },
        {
          runtimeKey: 'sprite.damian.walk.down',
          kind: 'spritesheet',
          runtimePath: 'assets/sprites/damian_walk_down.webp',
          frameWidth: 48,
          frameHeight: 64,
        },
      ],
    }, '/assets/www/');

    expect(assets.map(asset => [asset.key, asset.url])).toEqual([
      ['portrait.damian', '/assets/www/assets/portraits/damian.webp'],
      ['background.facility-lobby', '/assets/www/assets/backgrounds/lobby.webp'],
      ['sprite.damian.walk.down', '/assets/www/assets/sprites/damian_walk_down.webp'],
    ]);
  });

  it('rejects network bases and escaping catalog paths', () => {
    expect(() => resolvePhaserAssetUrl('assets/portrait.webp', 'https://cdn.invalid/game/'))
      .toThrow('current offline origin');
    expect(() => resolvePhaserAssetUrl('../portrait.webp'))
      .toThrow('Invalid Phaser asset path');
  });

  it('bounds frame time while leaving simulation state in the supplied port', () => {
    const simulation = {
      advance: vi.fn(),
      getRenderSnapshot: vi.fn(() => ({ world: { width: 320, height: 180 }, sprites: [] })),
      handleInput: vi.fn(),
    };
    const bridge = new PhaserRendererBridge(simulation, 100);

    bridge.advance(250);
    bridge.input('interact', 'pressed', 42);

    expect(simulation.advance).toHaveBeenCalledWith(100);
    expect(simulation.handleInput).toHaveBeenCalledWith('interact', 'pressed', 42);
  });

  it('derives the renderer manifest from approved bundle assets', () => {
    expect(createRuntimeAssetManifest({
      schemaVersion: 1,
      project: {} as never,
      maps: {},
      items: {} as never,
      databases: {} as never,
      assets: {
        schemaVersion: 3,
        assets: [{
          id: 'hero.walk.down',
          name: 'Hero',
          kind: 'spritesheet',
          path: 'assets/generated/web/hero.png',
          source: 'generated',
          runtimeCompatible: true,
          frameWidth: 48,
          frameHeight: 64,
          frames: 4,
          width: 192,
          height: 64,
          durationMs: 500,
        }],
      },
    })).toMatchObject({
      schemaVersion: 3,
      assets: [{
        runtimeKey: 'hero.walk.down',
        sourcePath: 'assets/generated/web/hero.png',
        width: 192,
        height: 64,
        frameWidth: 48,
        durationMs: 500,
      }],
    });
  });

  it('derives missing strip dimensions from the compiled animation clip', () => {
    const manifest = createRuntimeAssetManifest({
      schemaVersion: 1,
      project: {} as never,
      maps: {},
      items: {} as never,
      databases: {
        animations: {
          sets: [{
            id: 'actor.damian',
            clips: [{
              action: 'walk',
              direction: 'down',
              asset: 'sprite.damian.walk.down',
              frameSize: { width: 48, height: 64 },
              frameCount: 4,
              fps: 8,
              loop: true,
              anchor: { x: 24, y: 62 },
            }],
          }],
        },
      } as never,
      assets: {
        schemaVersion: 1,
        assets: [{
          id: 'sprite.damian.walk.down',
          name: 'Damián walk down',
          kind: 'spritesheet',
          path: 'assets/sprites/damian_walk_down.webp',
          source: 'generated',
          runtimeCompatible: true,
        }],
      },
    });

    expect(adaptManifestForPhaser(manifest)).toEqual([{
      key: 'sprite.damian.walk.down',
      type: 'spritesheet',
      url: './assets/sprites/damian_walk_down.webp',
      frameWidth: 48,
      frameHeight: 64,
    }]);
  });

  it('recreates disposable views when strip keys change and uses a safe missing-texture shape', () => {
    let snapshot: RuntimeRenderSnapshot = {
      world: { width: 320, height: 180 },
      sprites: [{ id: 'player', assetKey: 'actor.idle.down', x: 32, y: 64, frame: 0 }],
    };
    const simulation = {
      advance: vi.fn(),
      getRenderSnapshot: vi.fn(() => snapshot),
      handleInput: vi.fn(),
    };
    const bridge = new PhaserRendererBridge(simulation);
    const images: Array<Record<string, ReturnType<typeof vi.fn>>> = [];
    const rectangles: Array<Record<string, ReturnType<typeof vi.fn>>> = [];
    const makeObject = () => {
      const object: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const method of [
        'setPosition', 'setDisplaySize', 'setDepth', 'setVisible', 'setFlipX',
        'setAlpha', 'setOrigin', 'setFrame',
      ]) object[method] = vi.fn(() => object);
      object.destroy = vi.fn();
      return object;
    };
    class FakeScene {
      textures = { exists: (key: string) => key !== 'missing.threat' };
      add = {
        image: vi.fn(() => { const object = makeObject(); images.push(object); return object; }),
        rectangle: vi.fn(() => { const object = makeObject(); rectangles.push(object); return object; }),
      };
      cameras = { main: {
        setBackgroundColor: vi.fn(), setBounds: vi.fn(), setZoom: vi.fn(),
        startFollow: vi.fn(), stopFollow: vi.fn(),
      } };
      input = { keyboard: { on: vi.fn(), off: vi.fn() } };
      events = { once: vi.fn() };
      load = { image: vi.fn(), spritesheet: vi.fn(), audio: vi.fn() };
      scene = { start: vi.fn() };
    }
    const Phaser = {
      AUTO: 0,
      CANVAS: 1,
      WEBGL: 2,
      Scene: FakeScene,
      Game: class { destroy(): void {} },
    } as unknown as PhaserNamespace;
    const PlayScene = createPlayScene(Phaser, bridge, '#11151d');
    const scene = new PlayScene();

    scene.create();
    expect(images).toHaveLength(1);
    expect(images[0].setFrame).toHaveBeenCalledWith(0);

    snapshot = {
      world: { width: 320, height: 180 },
      sprites: [{ id: 'player', assetKey: 'actor.walk.down', x: 32, y: 64, frame: 1 }],
    };
    scene.update(0, 16);
    expect(images).toHaveLength(2);
    expect(images[0].destroy).toHaveBeenCalledOnce();
    expect(images[1].setFrame).toHaveBeenCalledWith(1);

    snapshot = {
      world: { width: 320, height: 180 },
      sprites: [{ id: 'player', assetKey: 'missing.threat', x: 32, y: 64 }],
    };
    scene.update(16, 16);
    expect(rectangles).toHaveLength(1);
    expect(images[1].destroy).toHaveBeenCalledOnce();
  });

  it('adapts VN audio and transitions using only preloaded local assets', () => {
    const sound = {
      volume: 1,
      play: vi.fn(),
      stop: vi.fn(),
      setVolume: vi.fn(function setVolume(this: { volume: number }, volume: number) {
        this.volume = volume;
        return this;
      }),
      destroy: vi.fn(),
    };
    const background = {
      setPosition: vi.fn(), setDisplaySize: vi.fn(), setDepth: vi.fn(),
      setVisible: vi.fn(), setAlpha: vi.fn(), setOrigin: vi.fn(),
      setScrollFactor: vi.fn(), destroy: vi.fn(),
    };
    const addSound = vi.fn(() => sound);
    const addImage = vi.fn(() => background);
    const fadeIn = vi.fn();
    const scene = {
      cache: { audio: { exists: (key: string) => key === 'bgm.promise' } },
      textures: { exists: (key: string) => key === 'background.archive' },
      sound: { add: addSound },
      add: { image: addImage },
      cameras: { main: { width: 960, height: 540, fadeIn, flash: vi.fn() } },
    } as unknown as PhaserSceneLike;
    const adapter = new PhaserPresentationCueAdapter(scene);

    adapter.apply([
      { type: 'audio', channel: 'bgm', action: 'play', assetId: 'bgm.promise', volume: 0.6, loop: true },
      { type: 'transition', style: 'dissolve', durationMs: 300, backgroundAssetId: 'background.archive' },
      { type: 'audio', channel: 'sfx', action: 'play', assetId: 'missing.remote', volume: 1 },
    ]);

    expect(addSound).toHaveBeenCalledOnce();
    expect(sound.play).toHaveBeenCalledWith({ volume: 0.6, loop: true });
    expect(addImage).toHaveBeenCalledWith(480, 270, 'background.archive');
    expect(background.setScrollFactor).toHaveBeenCalledWith(0, 0);
    expect(background.setDepth).toHaveBeenCalledWith(9_000);
    expect(fadeIn).toHaveBeenCalledWith(300, 0, 0, 0);

    adapter.apply([{ type: 'audio', channel: 'bgm', action: 'fade', volume: 0, fadeMs: 0 }]);
    expect(sound.stop).toHaveBeenCalledOnce();
    adapter.apply([{ type: 'transition', style: 'cut', clearBackground: true }]);
    expect(background.destroy).toHaveBeenCalledOnce();
    adapter.destroy();
    expect(background.destroy).toHaveBeenCalledOnce();
  });
});
