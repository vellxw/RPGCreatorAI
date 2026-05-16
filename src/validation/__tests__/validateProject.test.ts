import { describe, it, expect } from 'vitest';
import { validateProject, validateUniqueEventIds } from '../validateProject';
import type { FullProjectState } from '../../adapters/types';
import type { GameEvent, MapData } from '../../types/project';
import { mergeDatabases } from '../../adapters/defaultDatabases';

function makeMap(overrides: Partial<MapData> = {}): MapData {
  const width = overrides.width ?? 4;
  const height = overrides.height ?? 4;
  return {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    width,
    height,
    tileSize: 32,
    layers: [
      { name: 'ground', type: 'visual', tiles: new Array(width * height).fill(1) },
      { name: 'collision', type: 'collision', tiles: new Array(width * height).fill(0) },
    ],
    events: [],
    ...overrides,
  };
}

function makeProject(maps: Record<string, MapData>): FullProjectState {
  return {
    project: {
      schemaVersion: 1,
      title: 'Test',
      startMapId: Object.keys(maps)[0] ?? '',
      startPosition: { x: 0, y: 0, direction: 'down' },
      maps: Object.keys(maps).map(id => ({ id, path: `data/maps/${id}.json` })),
      database: { items: 'data/database/items.json' },
    },
    maps,
    items: { items: [{ id: 'potion', name: 'Potion', description: '', type: 'consumable' }] },
    databases: mergeDatabases(undefined),
  };
}

describe('validateProject', () => {
  it('returns no errors for a clean project', () => {
    const project = makeProject({ town: makeMap() });
    const report = validateProject(project);
    expect(report.errors).toEqual([]);
  });

  it('flags out-of-bounds start position', () => {
    const project = makeProject({ town: makeMap({ width: 2, height: 2 }) });
    project.project.startPosition = { x: 10, y: 10, direction: 'down' };
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('startPosition'))).toBe(true);
  });

  it('flags missing start map', () => {
    const project = makeProject({ town: makeMap() });
    project.project.startMapId = 'doesnotexist';
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('startMapId'))).toBe(true);
  });

  it('flags duplicate event IDs in a map', () => {
    const event: GameEvent = {
      id: 'dup',
      type: 'npc',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [],
    };
    const map = makeMap({ events: [event, { ...event }] });
    const project = makeProject({ town: map });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('duplicate id'))).toBe(true);
  });

  it('flags out-of-bounds event positions', () => {
    const event: GameEvent = {
      id: 'wanderer',
      type: 'npc',
      x: 99,
      y: 99,
      solid: false,
      trigger: 'interact',
      commands: [],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('out of map bounds'))).toBe(true);
  });

  it('flags transferMap pointing at unknown map', () => {
    const event: GameEvent = {
      id: 'door',
      type: 'transfer',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'touch',
      commands: [
        { type: 'transferMap', mapId: 'nowhere', x: 0, y: 0, direction: 'down' },
      ],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown map'))).toBe(true);
  });

  it('flags addItem referencing unknown item', () => {
    const event: GameEvent = {
      id: 'chest',
      type: 'chest',
      x: 0,
      y: 0,
      solid: true,
      trigger: 'interact',
      commands: [{ type: 'addItem', itemId: 'mythical_sword', amount: 1 }],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown item'))).toBe(true);
  });

  it('flags layer tile count mismatch', () => {
    const map = makeMap({ width: 4, height: 4 });
    map.layers[0].tiles = [1, 2, 3]; // wrong length
    const project = makeProject({ town: map });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('tiles'))).toBe(true);
  });

  it('flags invalid trigger', () => {
    const event: GameEvent = {
      id: 'bad',
      type: 'npc',
      x: 0,
      y: 0,
      solid: false,
      // @ts-expect-error -- intentionally invalid for test
      trigger: 'wave',
      commands: [],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('invalid trigger'))).toBe(true);
  });
});

describe('validateUniqueEventIds', () => {
  it('returns nothing when ids are unique', () => {
    const map = makeMap({
      events: [
        { id: 'a', type: 'npc', x: 0, y: 0, solid: false, trigger: 'interact', commands: [] },
        { id: 'b', type: 'npc', x: 1, y: 0, solid: false, trigger: 'interact', commands: [] },
      ],
    });
    expect(validateUniqueEventIds(map)).toEqual([]);
  });

  it('reports duplicates exactly once', () => {
    const map = makeMap({
      events: [
        { id: 'a', type: 'npc', x: 0, y: 0, solid: false, trigger: 'interact', commands: [] },
        { id: 'a', type: 'npc', x: 1, y: 0, solid: false, trigger: 'interact', commands: [] },
        { id: 'a', type: 'npc', x: 2, y: 0, solid: false, trigger: 'interact', commands: [] },
      ],
    });
    const out = validateUniqueEventIds(map);
    expect(out).toHaveLength(1);
    expect(out[0].message).toContain('3 events with duplicate id "a"');
  });
});
