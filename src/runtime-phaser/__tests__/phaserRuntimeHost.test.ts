// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { GameBundleV1 } from '../../runtime-core';
import { mountPhaserRuntime, resolvePhaserHostViewport } from '../host/PhaserRuntimeHost';
import type { PhaserNamespace, SimulationPort } from '../types';

function bundle(width = 960, height = 540): GameBundleV1 {
  return {
    schemaVersion: 1,
    project: {
      schemaVersion: 1,
      title: 'Host fixture',
      startMapId: 'start',
      startPosition: { x: 0, y: 0, direction: 'down' },
      maps: [],
      database: { items: 'data/items.json' },
      visualProfile: { baseResolution: { width, height } },
    },
    maps: {},
    items: { items: [] },
    databases: {} as never,
  };
}

function simulation(): SimulationPort {
  return {
    advance: vi.fn(),
    getRenderSnapshot: vi.fn(() => ({ world: { width: 960, height: 540 }, sprites: [] })),
    handleInput: vi.fn(),
  };
}

describe('PhaserRuntimeHost', () => {
  it('resolves the authored viewport and accepts complete positive overrides', () => {
    expect(resolvePhaserHostViewport(bundle())).toEqual({ width: 960, height: 540 });
    expect(resolvePhaserHostViewport(bundle(), { width: 1280, height: 720 }))
      .toEqual({ width: 1280, height: 720 });
  });

  it('owns a nested mount and disposes the game idempotently', async () => {
    const destroy = vi.fn();
    const resize = vi.fn();
    const refresh = vi.fn();
    class FakeScene {}
    class FakeGame {
      scale = { resize, refresh };
      destroy = destroy;
    }
    const phaser = {
      AUTO: 0,
      CANVAS: 1,
      WEBGL: 2,
      Scene: FakeScene,
      Game: FakeGame,
    } as unknown as PhaserNamespace;
    const container = document.createElement('div');
    document.body.appendChild(container);

    const host = await mountPhaserRuntime({
      container,
      bundle: bundle(),
      simulation: simulation(),
      phaser,
      autoResize: false,
    });

    expect(container.contains(host.element)).toBe(true);
    host.resize();
    host.resize(1280, 720);
    expect(refresh).toHaveBeenCalledOnce();
    expect(resize).toHaveBeenCalledWith(1280, 720);

    host.destroy();
    host.destroy();
    expect(destroy).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledWith(true);
    expect(host.destroyed).toBe(true);
    expect(container.childElementCount).toBe(0);
  });
});
