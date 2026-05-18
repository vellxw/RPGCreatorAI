import { describe, it, expect } from 'vitest';
import {
  flattenCommands,
  initialProjectStoreState,
  projectReducer,
  type ProjectStoreState,
} from '../projectStore';
import type { FullProjectState } from '../../adapters/types';
import type { GameEvent, MapData } from '../../types/project';
import { mergeDatabases } from '../../adapters/defaultDatabases';

function loadedState(): ProjectStoreState {
  const event: GameEvent = {
    id: 'old_man',
    type: 'npc',
    x: 5,
    y: 5,
    solid: true,
    trigger: 'interact',
    commands: [
      {
        type: 'ifFlag',
        flag: 'talked',
        equals: false,
        then: [{ type: 'showText', text: 'Hello' }],
        else: [{ type: 'showText', text: 'Bye' }],
      },
    ],
  };
  const map: MapData = {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    width: 10,
    height: 10,
    tileSize: 32,
    layers: [
      { name: 'ground', type: 'visual', tiles: new Array(100).fill(1) },
      { name: 'collision', type: 'collision', tiles: new Array(100).fill(0) },
    ],
    events: [event],
  };
  const payload: FullProjectState = {
    project: {
      schemaVersion: 1,
      title: 'Test',
      startMapId: 'town',
      startPosition: { x: 0, y: 0, direction: 'down' },
      maps: [{ id: 'town', path: 'data/maps/town.json' }],
      database: { items: 'data/database/items.json' },
    },
    maps: { town: map },
    items: { items: [{ id: 'potion', name: 'Potion', description: '', type: 'consumable' }] },
    databases: mergeDatabases(undefined),
  };
  return projectReducer(initialProjectStoreState, { type: 'LOAD_PROJECT', payload });
}

describe('projectReducer', () => {
  it('LOAD_PROJECT clears dirty and validates', () => {
    const s = loadedState();
    expect(s.dirty).toBe(false);
    expect(s.maps.town.events[0].id).toBe('old_man');
    expect(s.errors).toEqual([]);
  });

  it('UPDATE_EVENT changes fields and marks dirty', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_EVENT',
      mapId: 'town',
      eventId: 'old_man',
      changes: { x: 7, trigger: 'touch' },
    });
    expect(s2.dirty).toBe(true);
    expect(s2.maps.town.events[0].x).toBe(7);
    expect(s2.maps.town.events[0].trigger).toBe('touch');
    // original state untouched (immutability)
    expect(s1.maps.town.events[0].x).toBe(5);
  });

  it('UNDO and REDO restore prior project snapshots', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_EVENT',
      mapId: 'town',
      eventId: 'old_man',
      changes: { x: 7 },
    });
    const s3 = projectReducer(s2, { type: 'UNDO' });
    expect(s3.maps.town.events[0].x).toBe(5);
    expect(s3.canRedo).toBe(true);

    const s4 = projectReducer(s3, { type: 'REDO' });
    expect(s4.maps.town.events[0].x).toBe(7);
    expect(s4.canUndo).toBe(true);
  });

  it('coalesces a paint stroke into one undo step', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, { type: 'BEGIN_STROKE' });
    const s3 = projectReducer(s2, {
      type: 'PAINT_TILE',
      mapId: 'town',
      layerName: 'ground',
      x: 0,
      y: 0,
      tile: 2,
    });
    const s4 = projectReducer(s3, {
      type: 'PAINT_TILE',
      mapId: 'town',
      layerName: 'ground',
      x: 1,
      y: 0,
      tile: 2,
    });
    const s5 = projectReducer(s4, { type: 'END_STROKE' });
    const s6 = projectReducer(s5, { type: 'UNDO' });
    expect(s6.maps.town.layers[0].tiles[0]).toBe(1);
    expect(s6.maps.town.layers[0].tiles[1]).toBe(1);
  });

  it('coalesces a drag stroke into one undo step', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, { type: 'BEGIN_STROKE' });
    const s3 = projectReducer(s2, {
      type: 'UPDATE_EVENT',
      mapId: 'town',
      eventId: 'old_man',
      changes: { x: 6, y: 5 },
    });
    const s4 = projectReducer(s3, {
      type: 'UPDATE_EVENT',
      mapId: 'town',
      eventId: 'old_man',
      changes: { x: 7, y: 5 },
    });
    const s5 = projectReducer(s4, { type: 'END_STROKE' });
    const s6 = projectReducer(s5, { type: 'UNDO' });

    expect(s6.maps.town.events[0]).toMatchObject({ x: 5, y: 5 });
  });

  it('new edits clear the redo stack after undo', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_EVENT',
      mapId: 'town',
      eventId: 'old_man',
      changes: { x: 7 },
    });
    const s3 = projectReducer(s2, { type: 'UNDO' });
    const s4 = projectReducer(s3, {
      type: 'UPDATE_EVENT',
      mapId: 'town',
      eventId: 'old_man',
      changes: { x: 9 },
    });
    expect(s4.canRedo).toBe(false);
  });

  it('RENAME_EVENT renames when target id is free', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'RENAME_EVENT',
      mapId: 'town',
      oldId: 'old_man',
      newId: 'wise_man',
    });
    expect(s2.maps.town.events[0].id).toBe('wise_man');
  });

  it('RENAME_EVENT refuses to overwrite an existing id', () => {
    const s1 = loadedState();
    s1.maps.town.events.push({
      id: 'guard',
      type: 'npc',
      x: 1,
      y: 1,
      solid: false,
      trigger: 'interact',
      commands: [],
    });
    const s2 = projectReducer(s1, {
      type: 'RENAME_EVENT',
      mapId: 'town',
      oldId: 'old_man',
      newId: 'guard',
    });
    expect(s2).toBe(s1); // unchanged
  });

  it('ADD_COMMAND appends and marks dirty', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'ADD_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      command: { type: 'showText', text: 'Added' },
    });
    expect(s2.maps.town.events[0].commands).toHaveLength(2);
    expect(s2.dirty).toBe(true);
  });

  it('UPDATE_COMMAND replaces a top-level command', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [0],
      command: { type: 'showText', text: 'Replaced' },
    });
    expect(s2.maps.town.events[0].commands[0].type).toBe('showText');
  });

  it('UPDATE_COMMAND replaces a nested command in then-branch', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [0, 0, 0],
      command: { type: 'showText', text: 'Then-branch new' },
    });
    const ifCmd = s2.maps.town.events[0].commands[0];
    if (ifCmd.type !== 'ifFlag') throw new Error('expected ifFlag');
    expect((ifCmd.then[0] as { text: string }).text).toBe('Then-branch new');
  });

  it('REMOVE_COMMAND deletes a top-level command', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'REMOVE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [0],
    });
    expect(s2.maps.town.events[0].commands).toHaveLength(0);
  });

  it('MARK_SAVED clears dirty', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'UPDATE_EVENT',
      mapId: 'town',
      eventId: 'old_man',
      changes: { x: 8 },
    });
    expect(s1.dirty).toBe(true);
    const s2 = projectReducer(s1, { type: 'MARK_SAVED' });
    expect(s2.dirty).toBe(false);
    expect(s2.lastSavedAt).toBeTruthy();
  });

  it('PAINT_TILE updates map layers immutably', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'PAINT_TILE',
      mapId: 'town',
      layerName: 'ground',
      x: 2,
      y: 3,
      tile: 2,
    });
    expect(s2.maps.town.layers[0].tiles[32]).toBe(2);
    expect(s1.maps.town.layers[0].tiles[32]).toBe(1);
  });

  it('ADD_EVENT, DUPLICATE_EVENT, and REMOVE_EVENT manage event CRUD', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'ADD_EVENT',
      mapId: 'town',
      event: {
        id: 'chest_1',
        type: 'chest',
        x: 2,
        y: 2,
        solid: true,
        trigger: 'interact',
        commands: [],
      },
    });
    expect(s2.maps.town.events.map(e => e.id)).toContain('chest_1');

    const s3 = projectReducer(s2, {
      type: 'DUPLICATE_EVENT',
      mapId: 'town',
      eventId: 'chest_1',
      newId: 'chest_2',
      x: 3,
      y: 2,
    });
    expect(s3.maps.town.events.map(e => e.id)).toContain('chest_2');
    expect(s3.maps.town.events.find(e => e.id === 'chest_2')?.x).toBe(3);

    const s4 = projectReducer(s3, {
      type: 'REMOVE_EVENT',
      mapId: 'town',
      eventId: 'chest_1',
    });
    expect(s4.maps.town.events.map(e => e.id)).not.toContain('chest_1');
  });

  it('REPLACE_MAP swaps authored scene data while preserving undo support', () => {
    const s1 = loadedState();
    const replacement: MapData = {
      schemaVersion: 1,
      id: 'town',
      name: 'Town',
      width: 4,
      height: 4,
      tileSize: 32,
      layers: [
        { name: 'ground', type: 'visual', tiles: new Array(16).fill(6) },
        { name: 'collision', type: 'collision', tiles: new Array(16).fill(0) },
      ],
      events: [],
    };

    const s2 = projectReducer(s1, {
      type: 'REPLACE_MAP',
      mapId: 'town',
      map: replacement,
    });
    expect(s2.maps.town.width).toBe(4);
    expect(s2.maps.town.layers[0].tiles[0]).toBe(6);

    const s3 = projectReducer(s2, { type: 'UNDO' });
    expect(s3.maps.town.width).toBe(10);
  });

  it('VALIDATE refreshes errors/warnings', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_EVENT',
      mapId: 'town',
      eventId: 'old_man',
      changes: { x: 999 }, // out of bounds
    });
    const s3 = projectReducer(s2, { type: 'VALIDATE' });
    expect(s3.errors.length).toBeGreaterThan(0);
  });
});

describe('flattenCommands', () => {
  it('walks ifFlag branches in order', () => {
    const flat = flattenCommands([
      {
        type: 'ifFlag',
        flag: 'f',
        equals: true,
        then: [{ type: 'showText', text: 'a' }],
        else: [{ type: 'showText', text: 'b' }],
      },
      { type: 'setFlag', flag: 'g', value: true },
    ]);
    const types = flat.map(f => f.command.type);
    expect(types).toEqual(['ifFlag', 'showText', 'showText', 'setFlag']);
    expect(flat[0].depth).toBe(0);
    expect(flat[1].depth).toBe(1);
    expect(flat[3].path).toEqual([1]);
  });
});
