import { describe, expect, it } from 'vitest';
import { mergeDatabases } from '../../adapters/defaultDatabases';
import type { FullProjectState } from '../../adapters/types';
import type { EditorState } from '../../stores/editorStore';
import { initialEditorState } from '../../stores/editorStore';
import { buildPlaytestLaunchPlan } from '../playtestLaunchRequest';

function makeProjectState(): FullProjectState {
  return {
    project: {
      schemaVersion: 1,
      title: 'Launch Test',
      startMapId: 'town',
      startPosition: { x: 4, y: 5, direction: 'left' },
      maps: [
        { id: 'town', path: 'data/maps/town.json' },
        { id: 'house', path: 'data/maps/house.json' },
      ],
      database: { items: 'data/database/items.json' },
    },
    maps: {
      town: {
        schemaVersion: 1,
        id: 'town',
        name: 'Town',
        width: 10,
        height: 10,
        tileSize: 32,
        layers: [],
        events: [],
      },
      house: {
        schemaVersion: 1,
        id: 'house',
        name: 'House Interior',
        width: 8,
        height: 8,
        tileSize: 32,
        layers: [],
        events: [],
      },
    },
    items: { items: [] },
    databases: mergeDatabases(undefined),
  };
}

function makeEditorState(changes: Partial<EditorState>): EditorState {
  return { ...initialEditorState, ...changes };
}

describe('buildPlaytestLaunchPlan', () => {
  it('builds a current-map request for the selected map and describes the iteration spawn', () => {
    const plan = buildPlaytestLaunchPlan(
      makeEditorState({ playtestMode: 'currentMap', selectedMapId: 'house' }),
      makeProjectState(),
    );

    expect(plan.blocker).toBeUndefined();
    expect(plan.request).toEqual({ mode: 'currentMap', currentMapId: 'house' });
    expect(plan.targetLabel).toBe('House Interior (house)');
    expect(plan.spawnDescription).toContain('0,0,down');
  });

  it('keeps authored start position when current-map is already the project start map', () => {
    const plan = buildPlaytestLaunchPlan(
      makeEditorState({ playtestMode: 'currentMap', selectedMapId: 'town' }),
      makeProjectState(),
    );

    expect(plan.blocker).toBeUndefined();
    expect(plan.request).toEqual({ mode: 'currentMap', currentMapId: 'town' });
    expect(plan.spawnDescription).toContain('4,5,left');
  });

  it('blocks current-map launch before the session adapter when the selected map is stale', () => {
    const plan = buildPlaytestLaunchPlan(
      makeEditorState({ playtestMode: 'currentMap', selectedMapId: 'missing_map' }),
      makeProjectState(),
    );

    expect(plan.request).toBeUndefined();
    expect(plan.blocker).toContain("Current Map playtest cannot find selected map 'missing_map'");
  });
});
