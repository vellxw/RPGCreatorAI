import { describe, it, expect } from 'vitest';
import { validateProject, validateUniqueEventIds } from '../validateProject';
import type { FullProjectState } from '../../adapters/types';
import type { EventCommand, GameEvent, MapData } from '../../types/project';
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

function makeAuthoringLayers(width = 4, height = 4, visualTile = 1) {
  const size = width * height;
  return [
    { name: 'ground', type: 'visual' as const, role: 'ground' as const, tiles: new Array(size).fill(visualTile) },
    { name: 'decoration', type: 'visual' as const, role: 'decoration' as const, tiles: new Array(size).fill(0) },
    { name: 'foreground', type: 'visual' as const, role: 'foreground' as const, tiles: new Array(size).fill(0) },
    { name: 'collision', type: 'collision' as const, role: 'collision' as const, tiles: new Array(size).fill(0) },
    { name: 'region', type: 'region' as const, role: 'region' as const, tiles: new Array(size).fill(0) },
  ];
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

  it('validates project map references and hierarchy metadata', () => {
    const project = makeProject({
      town: makeMap(),
      house: makeMap({ id: 'house', name: 'House' }),
    });
    project.project.maps = [
      { id: 'town', path: 'data/maps/town.json', parentId: null, order: 0, expanded: true },
      { id: 'town', path: 'data/maps/town-copy.json', parentId: null, order: 1, expanded: true },
      { id: 'house', path: 'data/maps/house.json', parentId: 'missing_parent', order: 0, expanded: true },
      { id: 'ghost', path: 'data/maps/ghost.json', parentId: null, order: 2, expanded: true },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Duplicate project map reference id "town"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('references missing map data "ghost"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('unknown parent map "missing_parent"'))).toBe(true);
  });

  it('validates project map reference paths before desktop save', () => {
    const project = makeProject({
      town: makeMap(),
      house: makeMap({ id: 'house', name: 'House' }),
    });
    project.project.maps = [
      { id: 'town', path: 'data/maps/shared.json', parentId: null, order: 0 },
      { id: 'house', path: 'data/maps/shared.json', parentId: null, order: 1 },
      { id: 'blank', path: '   ', parentId: null, order: 2 },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Duplicate project map path "data/maps/shared.json"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('has an empty path'))).toBe(true);
  });

  it('warns when loaded map data has no project tree reference', () => {
    const project = makeProject({
      town: makeMap(),
      unused: makeMap({ id: 'unused', name: 'Unused' }),
    });
    project.project.maps = [{ id: 'town', path: 'data/maps/town.json' }];

    const report = validateProject(project);

    expect(report.warnings.some(w => w.message.includes('Loaded map "unused" has no project reference'))).toBe(true);
  });

  it('flags cyclic map parent chains', () => {
    const project = makeProject({
      town: makeMap(),
      house: makeMap({ id: 'house', name: 'House' }),
    });
    project.project.maps = [
      { id: 'town', path: 'data/maps/town.json', parentId: 'house', order: 0 },
      { id: 'house', path: 'data/maps/house.json', parentId: 'town', order: 0 },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('cyclic map parent chain'))).toBe(true);
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

  it('flags invalid event display height overrides', () => {
    const event: GameEvent = {
      id: 'tiny_actor',
      type: 'npc',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      displayHeightTiles: 0,
      commands: [],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('displayHeightTiles'))).toBe(true);
  });

  it('flags invalid system movement and display defaults', () => {
    const project = makeProject({ town: makeMap() });
    project.databases.system.playerMovementSpeed = 'warp' as never;
    project.databases.system.defaultCharacterHeightTiles = -1;
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('playerMovementSpeed'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('defaultCharacterHeightTiles'))).toBe(true);
  });

  it('accepts playAnimation commands that target known animation clips', () => {
    const event: GameEvent = {
      id: 'actor_event',
      type: 'npc',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      animationSet: 'player_adventurer',
      commands: [
        {
          type: 'playAnimation',
          target: 'thisEvent',
          action: 'attack',
          direction: 'current',
          durationMs: 300,
          blocking: true,
          loop: false,
        },
      ],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    project.databases.animations = {
      sets: [
        {
          id: 'player_adventurer',
          clips: [
            {
              action: 'attack',
              direction: 'down',
              asset: 'player_adventurer_attack_down',
              frameSize: { width: 64, height: 64 },
              frameCount: 4,
              fps: 10,
              loop: false,
              anchor: { x: 32, y: 54 },
            },
          ],
        },
      ],
    };

    const report = validateProject(project);
    expect(report.errors).toEqual([]);
  });

  it('flags playAnimation commands that target missing events or clips', () => {
    const event: GameEvent = {
      id: 'director',
      type: 'trigger',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [
        {
          type: 'playAnimation',
          target: 'event',
          eventId: 'missing_event',
          action: 'hurt',
          direction: 'down',
          durationMs: 300,
          blocking: true,
        },
      ],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('targets unknown event "missing_event"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('references unknown animation clip'))).toBe(true);
  });

  it('flags layer tile count mismatch', () => {
    const map = makeMap({ width: 4, height: 4 });
    map.layers[0].tiles = [1, 2, 3]; // wrong length
    const project = makeProject({ town: map });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('tiles'))).toBe(true);
  });

  it('warns when a visual layer contains explicit void cells', () => {
    const map = makeMap({ tilesetId: 'sample-town' });
    map.layers[0].tiles[0] = 0;
    const project = makeProject({ town: map });
    const report = validateProject(project);
    expect(report.warnings.some(w => w.message.includes('void tile'))).toBe(true);
  });

  it('flags unsupported visual and collision tile ids', () => {
    const map = makeMap({ tilesetId: 'sample-town' });
    map.layers[0].tiles[0] = 99;
    map.layers[1].tiles[1] = 7;
    const project = makeProject({ town: map });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unsupported visual tile id "99"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('unsupported collision tile id "7"'))).toBe(true);
  });

  it('flags maps that reference missing tilesets', () => {
    const project = makeProject({ town: makeMap({ tilesetId: 'missing-tileset' }) });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown tileset "missing-tileset"'))).toBe(true);
  });

  it('accepts imported tileset assets and map layers that use project database tile ids', () => {
    const map = makeMap({
      tilesetId: 'forest_tiles',
      layers: makeAuthoringLayers(4, 4, 11),
    });
    const project = makeProject({ town: map });
    project.assets = {
      schemaVersion: 1,
      assets: [
        {
          id: 'forest_pack',
          name: 'Forest Pack',
          kind: 'tileset',
          path: 'assets/imported/tilesets/forest-pack.png',
          source: 'imported',
          tags: ['imported', 'tileset'],
        },
      ],
    };
    project.databases.tilesets.tilesets = [
      {
        id: 'forest_tiles',
        name: 'Forest Tiles',
        tileSize: 32,
        tiles: [
          { id: 0, name: 'Tile 0', asset: 'forest_pack', group: 'A', passability: 'passable', priority: 0 },
          { id: 11, name: 'Canopy', asset: 'forest_pack', group: 'B', passability: 'blocked', priority: 1 },
          { id: 1000, name: 'Region 1', asset: 'forest_pack', group: 'Region', passability: 'passable', terrainTag: 'region_1' },
          { id: 2000, name: 'Collision Block', asset: 'forest_pack', group: 'Collision', passability: 'blocked', terrainTag: 'collision' },
        ],
      },
    ];

    const report = validateProject(project);

    expect(report.errors).toEqual([]);
  });

  it('flags unsupported map tile ids against imported project tilesets', () => {
    const map = makeMap({
      tilesetId: 'forest_tiles',
      layers: makeAuthoringLayers(4, 4, 99),
    });
    const project = makeProject({ town: map });
    project.assets = {
      schemaVersion: 1,
      assets: [
        {
          id: 'forest_pack',
          name: 'Forest Pack',
          kind: 'tileset',
          path: 'assets/imported/tilesets/forest-pack.png',
          source: 'imported',
          tags: ['imported', 'tileset'],
        },
      ],
    };
    project.databases.tilesets.tilesets = [
      {
        id: 'forest_tiles',
        name: 'Forest Tiles',
        tileSize: 32,
        tiles: [
          { id: 0, name: 'Tile 0', asset: 'forest_pack', group: 'A', passability: 'passable', priority: 0 },
          { id: 11, name: 'Canopy', asset: 'forest_pack', group: 'B', passability: 'blocked', priority: 1 },
        ],
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('unsupported visual tile id "99"'))).toBe(true);
    expect(report.errors.some(e => e.source === 'database/tilesets/forest_tiles/tiles/11')).toBe(false);
  });

  it('flags invalid map metadata settings', () => {
    const map = makeMap({
      scrollType: 'diagonal' as never,
      encounterSteps: -1,
      parallax: {
        image: 'clouds',
        loopX: true,
        loopY: false,
        scrollX: Number.NaN,
        scrollY: Number.POSITIVE_INFINITY,
      },
    });
    const project = makeProject({ town: map });
    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('invalid scrollType'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('encounterSteps must be non-negative'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('parallax.scrollX must be finite'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('parallax.scrollY must be finite'))).toBe(true);
  });

  it('flags duplicate tile ids and unknown tile assets in tileset databases', () => {
    const project = makeProject({ town: makeMap({ tilesetId: 'sample-town' }) });
    project.databases.tilesets.tilesets = [
      {
        id: 'sample-town',
        name: 'Sample Town',
        tileSize: 32,
        tiles: [
          {
            id: 1,
            name: 'Grass',
            asset: 'missingAsset',
            group: 'A',
            passability: 'passable',
          },
          {
            id: 1,
            name: 'Duplicate Grass',
            asset: 'grass',
            group: 'A',
            passability: 'passable',
          },
        ],
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Duplicate tile id "1"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('unknown tile asset "missingAsset"'))).toBe(true);
  });

  it('flags missing required authoring layers and invalid region ids', () => {
    const map = makeMap({ tilesetId: 'sample-town' });
    map.layers = [
      { name: 'ground', type: 'visual', role: 'ground', tiles: new Array(16).fill(1) },
      { name: 'collision', type: 'collision', role: 'collision', tiles: new Array(16).fill(0) },
      { name: 'region', type: 'region', role: 'region', tiles: new Array(16).fill(0) },
    ];
    map.layers[2].tiles[0] = 300;
    const project = makeProject({ town: map });
    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('missing required layer "decoration"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('missing required layer "foreground"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('unsupported region id "300"'))).toBe(true);
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

  it('flags invalid common event triggers', () => {
    const project = makeProject({ town: makeMap() });
    project.databases.commonEvents = [
      {
        id: 'bad_common_event',
        name: 'Bad Common Event',
        // @ts-expect-error -- intentionally invalid for test
        trigger: 'touch',
        commands: [],
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Common event "bad_common_event" has invalid trigger "touch"'))).toBe(true);
  });

  it('requires autorun and parallel common events to have known condition switches', () => {
    const project = makeProject({ town: makeMap() });
    project.databases.switches = [{ id: 'story_ready', name: 'Story Ready', initial: false }];
    project.databases.commonEvents = [
      {
        id: 'missing_condition',
        name: 'Missing Condition',
        trigger: 'autorun',
        commands: [],
      },
      {
        id: 'unknown_condition',
        name: 'Unknown Condition',
        trigger: 'parallel',
        switchId: 'missing_switch',
        commands: [],
      },
      {
        id: 'valid_condition',
        name: 'Valid Condition',
        trigger: 'parallel',
        switchId: 'story_ready',
        commands: [],
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Common event "missing_condition" requires a condition switch'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Common event "unknown_condition" references unknown switch "missing_switch"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Common event "valid_condition"'))).toBe(false);
  });

  it('validates nested common event commands with the same command rules as map events', () => {
    const project = makeProject({ town: makeMap() });
    project.databases.switches = [{ id: 'story_ready', name: 'Story Ready', initial: false }];
    project.databases.commonEvents = [
      {
        id: 'ce_bad_branch',
        name: 'Bad Branch',
        trigger: 'manual',
        commands: [
          {
            type: 'ifSwitch',
            switchId: 'story_ready',
            equals: true,
            then: [{ type: 'transferMap', mapId: 'missing_map', x: 0, y: 0, direction: 'down' }],
            else: [],
          },
        ],
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.source === 'commonEvent/ce_bad_branch' && e.message.includes('targets unknown map "missing_map"'))).toBe(true);
  });

  it('rejects direct common event self calls', () => {
    const project = makeProject({ town: makeMap() });
    project.databases.commonEvents = [
      {
        id: 'ce_loop',
        name: 'Loop',
        trigger: 'manual',
        commands: [{ type: 'callCommonEvent', commonEventId: 'ce_loop' }],
      },
      {
        id: 'ce_reward',
        name: 'Reward',
        trigger: 'manual',
        commands: [],
      },
    ];

    const report = validateProject(project);

    expect(
      report.errors.some(e =>
        e.source === 'commonEvent/ce_loop' &&
        e.message.includes('callCommonEvent cannot call its own common event "ce_loop"'),
      ),
    ).toBe(true);
  });

  it('accepts deterministic pluginCommand commands with scalar args', () => {
    const event: GameEvent = {
      id: 'plugin_host',
      type: 'npc',
      x: 1,
      y: 1,
      solid: false,
      trigger: 'interact',
      commands: [
        {
          type: 'pluginCommand',
          pluginId: 'debug',
          command: 'log',
          args: {
            message: 'Hello from plugin dispatch',
            count: 2,
            enabled: true,
            empty: null,
          },
        },
      ],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });

    const report = validateProject(project);

    expect(report.errors).toEqual([]);
  });

  it('validates typed registered pluginCommand args and references', () => {
    const event: GameEvent = {
      id: 'plugin_host',
      type: 'npc',
      x: 1,
      y: 1,
      solid: false,
      trigger: 'interact',
      commands: [
        {
          type: 'pluginCommand',
          pluginId: 'debug',
          command: 'setSwitch',
          args: {
            switchId: 'missing_switch',
            value: 'true',
          },
        } as unknown as EventCommand,
        {
          type: 'pluginCommand',
          pluginId: 'debug',
          command: 'setVariable',
          args: {
            variableId: 'score',
            value: '42',
          },
        } as unknown as EventCommand,
        {
          type: 'pluginCommand',
          pluginId: 'customLocal',
          command: 'unknownCommand',
          args: {
            payload: 'deterministic scalar',
          },
        },
      ],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    project.databases.switches = [{ id: 'story_ready', name: 'Story Ready', initial: false }];
    project.databases.variables = [{ id: 'score', name: 'Score', initial: 0 }];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('pluginCommand debug.setSwitch arg "switchId" references unknown switch "missing_switch"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('pluginCommand debug.setSwitch arg "value" must be boolean'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('pluginCommand debug.setVariable arg "value" must be number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('customLocal.unknownCommand'))).toBe(false);
  });

  it('rejects unsafe pluginCommand identifiers, code strings, and nested args', () => {
    const event: GameEvent = {
      id: 'plugin_host',
      type: 'npc',
      x: 1,
      y: 1,
      solid: false,
      trigger: 'interact',
      commands: [
        {
          type: 'pluginCommand',
          pluginId: '../debug',
          command: 'eval',
          args: {
            script: '() => window.alert(1)',
            nested: { value: true },
            list: ['bad'],
          },
        } as unknown as EventCommand,
      ],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('pluginCommand pluginId "../debug" is not a safe identifier'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('pluginCommand arg "script" contains code-like text'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('pluginCommand arg "nested" must be a scalar'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('pluginCommand arg "list" must be a scalar'))).toBe(true);
  });

  it('validates pluginCommand commands inside common events', () => {
    const project = makeProject({ town: makeMap() });
    project.databases.commonEvents = [
      {
        id: 'ce_plugin',
        name: 'Plugin Event',
        trigger: 'manual',
        commands: [
          {
            type: 'pluginCommand',
            pluginId: 'debug',
            command: 'setSwitch',
            args: {
              switchId: 'story_ready',
              value: true,
            },
          },
          {
            type: 'pluginCommand',
            pluginId: 'debug tools',
            command: 'log',
            args: {},
          } as unknown as EventCommand,
        ],
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.source === 'commonEvent/ce_plugin' && e.message.includes('pluginCommand pluginId "debug tools" is not a safe identifier'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('unknown command type "pluginCommand"'))).toBe(false);
  });

  it('validates event page triggers and self switch letters', () => {
    const event: GameEvent = {
      id: 'paged',
      type: 'npc',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [],
      pages: [
        {
          id: 'page_1',
          conditions: { selfSwitches: { A: true, E: true } },
          graphic: {},
          movement: { type: 'fixed', speed: 'normal' },
          options: { walking: false, stepping: false, directionFix: false, through: false },
          // @ts-expect-error -- intentionally invalid for test
          priority: 'overEverything',
          // @ts-expect-error -- intentionally invalid for test
          trigger: 'wave',
          commands: [{ type: 'showText', text: 'Bad page' }],
        },
      ],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('page "page_1" has invalid trigger "wave"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('invalid self switch "E"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('invalid priority "overEverything"'))).toBe(true);
  });

  it('validates commands inside event pages', () => {
    const event: GameEvent = {
      id: 'paged',
      type: 'npc',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [],
      pages: [
        {
          id: 'page_1',
          conditions: {},
          graphic: {},
          movement: { type: 'fixed', speed: 'normal' },
          options: { walking: false, stepping: false, directionFix: false, through: false },
          priority: 'sameAsCharacters',
          trigger: 'interact',
          commands: [{ type: 'transferMap', mapId: 'missing', x: 0, y: 0, direction: 'down' }],
        },
      ],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('targets unknown map "missing"'))).toBe(true);
  });

  it('validates setMovementRoute targets and route steps', () => {
    const badRoute = {
      type: 'setMovementRoute',
      target: 'event',
      eventId: 'missing_event',
      repeat: false,
      skippable: true,
      wait: true,
      steps: [
        { type: 'moveRight' },
        { type: 'wait', ms: -10 },
        { type: 'jump' },
      ],
    } as unknown as EventCommand;
    const goodRoute = {
      type: 'setMovementRoute',
      target: 'player',
      repeat: false,
      skippable: true,
      wait: true,
      steps: [
        { type: 'moveRight' },
        { type: 'turnDown' },
        { type: 'wait', ms: 50 },
      ],
    } as unknown as EventCommand;
    const event: GameEvent = {
      id: 'mover',
      type: 'npc',
      x: 1,
      y: 1,
      solid: false,
      trigger: 'interact',
      commands: [badRoute, goodRoute],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });
    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('setMovementRoute targets unknown event "missing_event"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('setMovementRoute step 2 wait ms must be a non-negative finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('setMovementRoute step 3 has invalid step type "jump"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('unknown command type "setMovementRoute"'))).toBe(false);
  });

  it('reports malformed setMovementRoute shapes without throwing', () => {
    const route = {
      type: 'setMovementRoute',
      target: 'player',
      repeat: false,
      skippable: true,
      wait: true,
    } as unknown as EventCommand;
    const event: GameEvent = {
      id: 'mover',
      type: 'npc',
      x: 1,
      y: 1,
      solid: false,
      trigger: 'interact',
      commands: [route],
    };
    const project = makeProject({ town: makeMap({ events: [event] }) });

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('setMovementRoute steps must be an array'))).toBe(true);
  });

  it('validates item and equipment icon asset references through the asset catalog', () => {
    const project = makeProject({ town: makeMap() });
    project.assets = {
      schemaVersion: 1,
      assets: [
        {
          id: 'potion_icon',
          name: 'Potion Icon',
          kind: 'image',
          path: 'assets/generated/icons/potion_icon.png',
          source: 'generated',
        },
        {
          id: 'sword_icon',
          name: 'Sword Icon',
          kind: 'generated',
          path: 'assets/generated/icons/sword_icon.png',
          source: 'generated',
        },
        {
          id: 'bad_audio_icon',
          name: 'Bad Audio Icon',
          kind: 'audio',
          path: 'assets/imported/audio/bad.wav',
          source: 'imported',
        },
      ],
    };
    project.items.items = [
      { id: 'potion', name: 'Potion', description: '', type: 'consumable', iconAssetId: 'potion_icon' },
      { id: 'ether', name: 'Ether', description: '', type: 'consumable', iconAssetId: 'missing_icon' },
    ];
    project.databases.weapons = [
      {
        id: 'iron_sword',
        name: 'Iron Sword',
        description: '',
        weaponTypeId: 'sword',
        iconAssetId: 'sword_icon',
      },
    ];
    project.databases.armors = [
      {
        id: 'leather_armor',
        name: 'Leather Armor',
        description: '',
        armorTypeId: 'light',
        slot: 'body',
        iconAssetId: 'bad_audio_icon',
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Item "potion"'))).toBe(false);
    expect(report.errors.some(e => e.message.includes('Weapon "iron_sword"'))).toBe(false);
    expect(report.errors.some(e => e.message.includes('Item "ether" references unknown icon asset "missing_icon"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Armor "leather_armor" icon asset "bad_audio_icon" must be an image asset'))).toBe(true);
  });

  it('validates actor and event portrait asset references through the asset catalog', () => {
    const project = makeProject({
      town: makeMap({
        events: [
          {
            id: 'npc_1',
            type: 'npc',
            x: 1,
            y: 1,
            solid: true,
            trigger: 'interact',
            sprite: 'npc_old_man',
            portraitAssetId: 'npc_portrait',
            commands: [],
          },
          {
            id: 'npc_2',
            type: 'npc',
            x: 2,
            y: 1,
            solid: true,
            trigger: 'interact',
            sprite: 'npc_old_man',
            portraitAssetId: 'bad_audio_portrait',
            commands: [],
          },
        ],
      }),
    });
    project.assets = {
      schemaVersion: 1,
      assets: [
        {
          id: 'arc_portrait',
          name: 'Arc Portrait',
          kind: 'image',
          path: 'assets/generated/portraits/arc_portrait.png',
          source: 'generated',
        },
        {
          id: 'npc_portrait',
          name: 'NPC Portrait',
          kind: 'generated',
          path: 'assets/generated/portraits/npc_portrait.png',
          source: 'generated',
        },
        {
          id: 'bad_audio_portrait',
          name: 'Bad Audio Portrait',
          kind: 'audio',
          path: 'assets/imported/audio/bad.wav',
          source: 'imported',
        },
      ],
    };
    project.databases.classes = [
      {
        id: 'hero',
        name: 'Hero',
        growth: {
          maxHp: 18,
          maxMp: 6,
          attack: 6,
          defense: 4,
          magicAttack: 3,
          magicDefense: 3,
          agility: 5,
          luck: 4,
        },
        usableEquipment: [],
        learnedSkills: [],
      },
    ];
    project.databases.actors = [
      {
        id: 'arc',
        name: 'Arc',
        classId: 'hero',
        level: 1,
        hp: 18,
        mp: 6,
        baseStats: {
          maxHp: 18,
          maxMp: 6,
          attack: 6,
          defense: 4,
          magicAttack: 3,
          magicDefense: 3,
          agility: 5,
          luck: 4,
        },
        equipment: {},
        skills: [],
        portraitAssetId: 'arc_portrait',
      },
      {
        id: 'orphan',
        name: 'Orphan',
        classId: 'hero',
        level: 1,
        hp: 18,
        mp: 6,
        baseStats: {
          maxHp: 18,
          maxMp: 6,
          attack: 6,
          defense: 4,
          magicAttack: 3,
          magicDefense: 3,
          agility: 5,
          luck: 4,
        },
        equipment: {},
        skills: [],
        portraitAssetId: 'missing_portrait',
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Actor "arc"'))).toBe(false);
    expect(report.errors.some(e => e.message.includes('Event "npc_1"'))).toBe(false);
    expect(report.errors.some(e => e.message.includes('Actor "orphan" references unknown portrait asset "missing_portrait"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Event "npc_2" portrait asset "bad_audio_portrait" must be an image asset'))).toBe(true);
  });

  it('validates actor and event character concept asset references through the asset catalog', () => {
    const project = makeProject({
      town: makeMap({
        events: [
          {
            id: 'npc_1',
            type: 'npc',
            x: 1,
            y: 1,
            solid: true,
            trigger: 'interact',
            sprite: 'npc_old_man',
            conceptAssetId: 'npc_concept',
            commands: [],
          },
          {
            id: 'npc_2',
            type: 'npc',
            x: 2,
            y: 1,
            solid: true,
            trigger: 'interact',
            sprite: 'npc_old_man',
            conceptAssetId: 'bad_audio_concept',
            commands: [],
          },
        ],
      }),
    });
    project.assets = {
      schemaVersion: 1,
      assets: [
        {
          id: 'arc_concept',
          name: 'Arc Concept',
          kind: 'image',
          path: 'assets/generated/concepts/arc_concept.png',
          source: 'generated',
        },
        {
          id: 'npc_concept',
          name: 'NPC Concept',
          kind: 'generated',
          path: 'assets/generated/concepts/npc_concept.png',
          source: 'generated',
        },
        {
          id: 'bad_audio_concept',
          name: 'Bad Audio Concept',
          kind: 'audio',
          path: 'assets/imported/audio/bad.wav',
          source: 'imported',
        },
      ],
    };
    project.databases.classes = [
      {
        id: 'hero',
        name: 'Hero',
        growth: {
          maxHp: 18,
          maxMp: 6,
          attack: 6,
          defense: 4,
          magicAttack: 3,
          magicDefense: 3,
          agility: 5,
          luck: 4,
        },
        usableEquipment: [],
        learnedSkills: [],
      },
    ];
    project.databases.actors = [
      {
        id: 'arc',
        name: 'Arc',
        classId: 'hero',
        level: 1,
        hp: 18,
        mp: 6,
        baseStats: {
          maxHp: 18,
          maxMp: 6,
          attack: 6,
          defense: 4,
          magicAttack: 3,
          magicDefense: 3,
          agility: 5,
          luck: 4,
        },
        equipment: {},
        skills: [],
        conceptAssetId: 'arc_concept',
      },
      {
        id: 'orphan',
        name: 'Orphan',
        classId: 'hero',
        level: 1,
        hp: 18,
        mp: 6,
        baseStats: {
          maxHp: 18,
          maxMp: 6,
          attack: 6,
          defense: 4,
          magicAttack: 3,
          magicDefense: 3,
          agility: 5,
          luck: 4,
        },
        equipment: {},
        skills: [],
        conceptAssetId: 'missing_concept',
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Actor "arc"'))).toBe(false);
    expect(report.errors.some(e => e.message.includes('Event "npc_1"'))).toBe(false);
    expect(report.errors.some(e => e.message.includes('Actor "orphan" references unknown character concept asset "missing_concept"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Event "npc_2" character concept asset "bad_audio_concept" must be an image asset'))).toBe(true);
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
