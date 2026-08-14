import { describe, expect, it } from 'vitest';
import { createNewProjectState } from '../../adapters/projectTemplates';
import { initialEditorState } from '../../stores/editorStore';
import type { MapData } from '../../types/project';
import {
  createPhaserPlaytestSession,
  findNearestOpenPlaytestTile,
  findSelectedEventPlaytestSpawn,
} from '../phaserPlaytestAdapter';

function smallMap(id: string): MapData {
  return {
    schemaVersion: 1,
    id,
    name: id,
    width: 3,
    height: 2,
    tileSize: 32,
    layers: [
      { name: 'ground', type: 'visual', role: 'ground', tiles: [1, 1, 1, 1, 1, 1] },
      { name: 'collision', type: 'collision', role: 'collision', tiles: [9, 0, 0, 0, 0, 0] },
    ],
    events: [],
  };
}

describe('findNearestOpenPlaytestTile', () => {
  it('uses deterministic row-major Manhattan ordering and avoids solid events', () => {
    const map = smallMap('cellar');
    map.events.push({
      id: 'guard',
      type: 'npc',
      x: 1,
      y: 0,
      solid: true,
      trigger: 'interact',
      commands: [],
    });

    expect(findNearestOpenPlaytestTile(map, { x: 0, y: 0 })).toEqual({ x: 0, y: 1 });
  });

  it('places selected-event playtests beside the event and facing it', () => {
    const map = smallMap('cellar');
    map.layers[1].tiles = [0, 0, 0, 0, 0, 0];
    expect(findSelectedEventPlaytestSpawn(map, { x: 1, y: 0 })).toEqual({
      x: 1,
      y: 1,
      direction: 'up',
    });
  });
});

describe('createPhaserPlaytestSession', () => {
  it('compiles project-start state and creates a Phaser-ready simulation boundary', () => {
    const project = createNewProjectState('Playtest adapter');
    project.project.visualProfile = {
      ...project.project.visualProfile,
      baseResolution: { width: 960, height: 540 },
    };
    const result = createPhaserPlaytestSession(project, initialEditorState);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.bundle.schemaVersion).toBe(1);
    expect(result.session.runtimeConfig.startOverride).toBeUndefined();
    expect(result.session.viewport).toEqual({ width: 960, height: 540 });
    expect(result.session.assetManifest.schemaVersion).toBe(1);
    expect(result.session.simulation.getState().mapId).toBe(project.project.startMapId);
  });

  it('repairs an occupied authored project start only in runtime configuration', () => {
    const project = createNewProjectState('Occupied project start');
    const start = project.project.startPosition;
    const map = project.maps[project.project.startMapId];
    const collision = map.layers.find(layer => layer.type === 'collision');
    if (!collision) throw new Error('Fixture has no collision layer.');
    collision.tiles[start.y * map.width + start.x] = 9;

    const result = createPhaserPlaytestSession(project, initialEditorState);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.runtimeConfig.startOverride).toEqual(expect.objectContaining({
      mapId: map.id,
      direction: start.direction,
    }));
    expect(result.session.runtimeConfig.startOverride).not.toMatchObject({ x: start.x, y: start.y });
    const override = result.session.runtimeConfig.startOverride!;
    expect(result.session.simulation.getState()).toMatchObject({
      mapId: override.mapId,
      player: { x: override.x, y: override.y, direction: override.direction },
    });
    expect(result.session.bundle.project.startPosition).toEqual(start);
  });

  it('preserves approved asset catalog data through the bundle and Phaser manifest', () => {
    const project = createNewProjectState('Asset catalog');
    project.assets = {
      schemaVersion: 7,
      assets: [{
        id: 'hero.walk.down',
        name: 'Hero walk down',
        kind: 'spritesheet',
        path: 'assets/characters/hero_walk_down.webp',
        source: 'generated',
        runtimeCompatible: true,
        width: 192,
        height: 64,
        frameWidth: 48,
        frameHeight: 64,
        frames: 4,
        durationMs: 500,
      }],
    };

    const result = createPhaserPlaytestSession(project, initialEditorState);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.bundle.assets).toEqual(project.assets);
    expect(result.session.assetManifest).toEqual({
      schemaVersion: 7,
      assets: [{
        runtimeKey: 'hero.walk.down',
        kind: 'spritesheet',
        runtimePath: 'assets/characters/hero_walk_down.webp',
        sourcePath: 'assets/characters/hero_walk_down.webp',
        width: 192,
        height: 64,
        frameWidth: 48,
        frameHeight: 64,
        frames: 4,
        durationMs: 500,
      }],
    });
  });

  it('creates a nearest-open override for current-map playtests without mutating authored start', () => {
    const project = createNewProjectState('Current map');
    project.maps.cellar = smallMap('cellar');
    project.project.maps.push({ id: 'cellar', path: 'data/maps/cellar.json' });
    const authoredStart = structuredClone(project.project.startPosition);

    const result = createPhaserPlaytestSession(project, {
      ...initialEditorState,
      playtestMode: 'currentMap',
      selectedMapId: 'cellar',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.runtimeConfig.startOverride).toEqual({
      mapId: 'cellar',
      x: 1,
      y: 0,
      direction: 'down',
    });
    expect(result.session.simulation.getState().player).toMatchObject({ x: 1, y: 0 });
    expect(project.project.startPosition).toEqual(authoredStart);
  });

  it('spawns near a selected solid event and uses the fresh project event', () => {
    const project = createNewProjectState('Selected event');
    const map = smallMap('cellar');
    const event = {
      id: 'patient-nine',
      type: 'npc' as const,
      x: 1,
      y: 0,
      solid: true,
      trigger: 'interact' as const,
      commands: [],
    };
    map.events.push(event);
    project.maps.cellar = map;
    project.project.maps.push({ id: 'cellar', path: 'data/maps/cellar.json' });

    const result = createPhaserPlaytestSession(project, {
      ...initialEditorState,
      playtestMode: 'selectedEvent',
      selectedMapId: 'cellar',
      selectedEventMapId: 'cellar',
      selectedEvent: { ...event, x: 2 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.runtimeConfig.startOverride).toEqual({
      mapId: 'cellar',
      x: 2,
      y: 0,
      direction: 'left',
    });
  });

  it('fails closed when bundle compilation rejects an unsafe path', () => {
    const project = createNewProjectState('Unsafe bundle');
    project.project.maps[0].path = '../town.json';

    const result = createPhaserPlaytestSession(project, initialEditorState);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'bundle-compile' });
  });

  it('reports maps without any open spawn instead of constructing a broken simulation', () => {
    const project = createNewProjectState('Blocked map');
    const blocked = smallMap('blocked');
    blocked.layers[1].tiles = new Array(6).fill(9);
    project.maps.blocked = blocked;
    project.project.maps.push({ id: 'blocked', path: 'data/maps/blocked.json' });

    const result = createPhaserPlaytestSession(project, {
      ...initialEditorState,
      playtestMode: 'currentMap',
      selectedMapId: 'blocked',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'no-open-spawn' }),
    ]);
  });
});
