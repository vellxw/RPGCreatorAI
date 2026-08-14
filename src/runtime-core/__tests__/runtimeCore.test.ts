import { describe, expect, it } from 'vitest';
import { InputRouter } from '../inputRouter';
import { resolvePluginPermissions, validatePluginManifest, type PluginManifestV1 } from '../plugins';
import { createPortableSave, parsePortableSave, serializePortableSave } from '../saveSchema';

describe('InputRouter', () => {
  it('keeps an action pressed until every bound source is released', () => {
    const router = new InputRouter({
      'keyboard:ArrowUp': ['move.up'],
      'gamepad:axis-up': ['move.up'],
    });

    expect(router.press('keyboard:ArrowUp', 1)[0]?.phase).toBe('pressed');
    expect(router.press('gamepad:axis-up', 2)).toEqual([]);
    expect(router.release('keyboard:ArrowUp', 3)).toEqual([]);
    expect(router.isPressed('move.up')).toBe(true);
    expect(router.release('gamepad:axis-up', 4)[0]?.phase).toBe('released');
    expect(router.isPressed('move.up')).toBe(false);
  });

  it('ignores key-repeat presses from the same source', () => {
    const router = new InputRouter({ 'keyboard:Enter': ['interact'] });
    router.press('keyboard:Enter', 1);
    expect(router.press('keyboard:Enter', 2)).toEqual([]);
  });
});

describe('portable save schema', () => {
  it('round-trips the native-compatible v2 shape as JSON', () => {
    const save = createPortableSave({
      currentMapId: 'town',
      player: { x: 4, y: 5, direction: 'down' },
    });
    expect(parsePortableSave(serializePortableSave(save))).toEqual(save);
  });

  it('rejects non-finite values', () => {
    const save = createPortableSave({
      currentMapId: 'town',
      player: { x: Number.NaN, y: 5, direction: 'down' },
    });
    expect(() => serializePortableSave(save)).toThrow('player.x');
  });

  it('round-trips versioned VN resume state while accepting pre-VN v2 saves', () => {
    const save = createPortableSave(
      { currentMapId: 'town', player: { x: 1, y: 2, direction: 'left' } },
      {
        visualNovel: {
          schemaVersion: 1,
          state: {
            sceneId: 'reunion',
            currentNodeId: 'answer',
            variables: { bond: 2, promise: true, route: 'archive' },
            visitedNodeIds: ['line', 'answer'],
            selectedChoiceIds: [],
          },
          selectedChoiceIndex: 1,
        },
      },
    );
    expect(parsePortableSave(serializePortableSave(save)).visualNovel).toEqual(save.visualNovel);

    const legacyV2 = JSON.stringify({
      schemaVersion: 2,
      currentMapId: 'town',
      player: { x: 1, y: 2, direction: 'left' },
      flags: {}, switches: {}, variables: {}, inventory: {}, gold: 0,
      party: [], actors: {}, quests: {},
    });
    expect(parsePortableSave(legacyV2).visualNovel).toBeUndefined();
  });
});

describe('plugin manifests and permissions', () => {
  const manifest: PluginManifestV1 = {
    schemaVersion: 1,
    id: 'example.weather',
    name: 'Weather',
    version: '1.0.0',
    entry: 'dist/plugin.js',
    permissions: ['runtime.state.read'],
    optionalPermissions: ['runtime.audio.play'],
  };

  it('validates a safe v1 manifest', () => {
    expect(validatePluginManifest(manifest)).toEqual([]);
  });

  it('rejects plugin entry paths with traversal or Windows stream syntax', () => {
    expect(validatePluginManifest({ ...manifest, entry: 'dist/../plugin.js' })).toContain(
      'entry must be a safe relative path.',
    );
    expect(validatePluginManifest({ ...manifest, entry: 'dist/plugin.js:secret' })).toContain(
      'entry must be a safe relative path.',
    );
  });

  it('denies permissions by default and requires every mandatory grant', () => {
    const denied = resolvePluginPermissions(manifest);
    expect(denied.canActivate).toBe(false);
    expect([...denied.allowed]).toEqual([]);

    const granted = resolvePluginPermissions(manifest, {
      pluginId: manifest.id,
      permissions: ['runtime.state.read'],
    });
    expect(granted.canActivate).toBe(true);
    expect([...granted.allowed]).toEqual(['runtime.state.read']);
    expect(granted.deniedOptional).toEqual(['runtime.audio.play']);
  });
});
