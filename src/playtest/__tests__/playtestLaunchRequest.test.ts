import { describe, expect, it } from 'vitest';
import { mergeDatabases } from '../../adapters/defaultDatabases';
import type { FullProjectState } from '../../adapters/types';
import type { EditorState } from '../../stores/editorStore';
import { initialEditorState } from '../../stores/editorStore';
import {
  buildPlaytestLaunchPlan,
  buildPlaytestProjectState,
  pickLaunchValidationError,
} from '../playtestLaunchRequest';

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
        events: [
          {
            id: 'npc_1',
            type: 'npc',
            x: 2,
            y: 3,
            solid: false,
            trigger: 'interact',
            commands: [{ type: 'showText', text: 'Hello' }],
          },
        ],
      },
    },
    items: { items: [] },
    databases: mergeDatabases(undefined),
    assets: {
      schemaVersion: 1,
      assets: [
        {
          id: 'hero_sheet',
          name: 'Hero Sheet',
          kind: 'spritesheet',
          path: 'assets/imported/spritesheets/hero-sheet.png',
          source: 'imported',
        },
      ],
    },
  };
}

function makeEditorState(changes: Partial<EditorState>): EditorState {
  return { ...initialEditorState, ...changes };
}

describe('buildPlaytestProjectState', () => {
  it('preserves the asset catalog in the native playtest snapshot', () => {
    const project = makeProjectState();
    const snapshot = buildPlaytestProjectState({
      project: project.project,
      maps: project.maps,
      items: project.items,
      databases: project.databases,
      assets: project.assets!,
    });

    expect(snapshot.assets?.assets.map(asset => asset.id)).toEqual(['hero_sheet']);
  });
});

describe('buildPlaytestLaunchPlan', () => {
  it('builds a current-map request for the selected map and describes the iteration spawn', () => {
    const plan = buildPlaytestLaunchPlan(
      makeEditorState({ playtestMode: 'currentMap', selectedMapId: 'house' }),
      makeProjectState(),
    );

    expect(plan.blocker).toBeUndefined();
    expect(plan.request).toEqual({ mode: 'currentMap', currentMapId: 'house' });
    expect(plan.targetLabel).toBe('House Interior (house)');
    expect(plan.spawnDescription).toContain('nearest open tile');
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

  it('builds a selected-event request from the fresh event on the selected map', () => {
    const projectState = makeProjectState();
    const staleEvent = {
      ...projectState.maps.house.events[0],
      x: 0,
      y: 0,
    };
    const plan = buildPlaytestLaunchPlan(
      makeEditorState({
        playtestMode: 'selectedEvent',
        selectedMapId: 'town',
        selectedEventMapId: 'house',
        selectedEvent: staleEvent,
      }),
      projectState,
    );

    expect(plan.blocker).toBeUndefined();
    expect(plan.request).toEqual({
      mode: 'selectedEvent',
      currentMapId: 'town',
      selectedEventMapId: 'house',
      selectedEventId: 'npc_1',
    });
    expect(plan.targetLabel).toBe('npc_1 on House Interior (house)');
    expect(plan.spawnDescription).toContain('selected event 2,3');
    expect(plan.spawnDescription).toContain('adjacent open tile');
    expect(plan.eventDebugContext).toEqual({ mapId: 'house', eventId: 'npc_1' });
  });

  it('blocks selected-event launch when the selected event is stale', () => {
    const projectState = makeProjectState();
    const staleEvent = {
      ...projectState.maps.house.events[0],
      id: 'missing_event',
    };
    const plan = buildPlaytestLaunchPlan(
      makeEditorState({
        playtestMode: 'selectedEvent',
        selectedMapId: 'town',
        selectedEventMapId: 'house',
        selectedEvent: staleEvent,
      }),
      projectState,
    );

    expect(plan.request).toBeUndefined();
    expect(plan.blocker).toContain("Selected Event playtest cannot find event 'missing_event'");
  });

  it('warns when selected-event pages may be inactive until page conditions match', () => {
    const projectState = makeProjectState();
    projectState.maps.house.events[0].pages = [
      {
        id: 'page_1',
        conditions: { switches: { story_started: true } },
        graphic: {},
        movement: { type: 'fixed', speed: 'normal' },
        options: { walking: false, stepping: false, directionFix: false, through: false },
        priority: 'sameAsCharacters',
        trigger: 'interact',
        commands: [{ type: 'showText', text: 'Conditional' }],
      },
    ];
    const plan = buildPlaytestLaunchPlan(
      makeEditorState({
        playtestMode: 'selectedEvent',
        selectedMapId: 'town',
        selectedEventMapId: 'house',
        selectedEvent: projectState.maps.house.events[0],
      }),
      projectState,
    );

    expect(plan.blocker).toBeUndefined();
    expect(plan.warnings?.[0]).toContain('All selected event pages have conditions');
  });

  it('prioritizes selected-event validation errors over unrelated project errors', () => {
    const projectState = makeProjectState();
    const plan = buildPlaytestLaunchPlan(
      makeEditorState({
        playtestMode: 'selectedEvent',
        selectedMapId: 'town',
        selectedEventMapId: 'house',
        selectedEvent: projectState.maps.house.events[0],
      }),
      projectState,
    );

    const error = pickLaunchValidationError(plan, [
      { level: 'error', message: 'Project startMapId "missing" does not exist', source: 'project' },
      { level: 'error', message: 'Event "npc_1" has unknown command type "bad"', source: 'house/npc_1/page_1' },
    ]);

    expect(error?.message).toContain('unknown command type');
  });
});
