import { describe, it, expect } from 'vitest';
import {
  flattenCommands,
  initialProjectStoreState,
  projectReducer,
  type ProjectStoreState,
} from '../projectStore';
import type { FullProjectState } from '../../adapters/types';
import type { EventCommand, EventPage, GameEvent, MapData } from '../../types/project';
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
    items: {
      items: [
        { id: 'potion', name: 'Potion', description: '', type: 'consumable' },
        {
          id: 'iron_sword',
          name: 'Iron Sword',
          description: 'Legacy weapon item',
          type: 'weapon',
          slot: 'weapon',
          modifiers: { attack: 3 },
        },
        {
          id: 'leather_armor',
          name: 'Leather Armor',
          description: 'Legacy armor item',
          type: 'armor',
          slot: 'armor',
          modifiers: { defense: 2 },
        },
      ],
    },
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

  it('normalizes legacy event commands into a single event page', () => {
    const s1 = loadedState();
    const event = s1.maps.town.events[0];
    expect(event.pages).toHaveLength(1);
    expect(event.pages?.[0]).toMatchObject({
      id: 'page_1',
      trigger: 'interact',
      priority: 'sameAsCharacters',
    });
    expect(event.pages?.[0].commands).toEqual(event.commands);
  });

  it('LOAD_PROJECT migrates legacy weapon and armor items into separated databases when missing', () => {
    const s1 = loadedState();
    expect(s1.databases.weapons.map(w => w.id)).toContain('iron_sword');
    expect(s1.databases.armors.map(armor => armor.id)).toContain('leather_armor');
  });

  it('UPDATE_EVENT_PAGE updates a page and mirrors page 1 to legacy fields', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_EVENT_PAGE',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      changes: {
        trigger: 'touch',
        priority: 'belowCharacters',
        commands: [{ type: 'showText', text: 'Paged command' }],
      },
    });

    const event = s2.maps.town.events[0];
    expect(event.pages?.[0].trigger).toBe('touch');
    expect(event.trigger).toBe('touch');
    expect(event.commands).toEqual([{ type: 'showText', text: 'Paged command' }]);
  });

  it('ADD_EVENT_PAGE and REORDER_EVENT_PAGE manage page order', () => {
    const s1 = loadedState();
    const page: EventPage = {
      id: 'page_2',
      name: 'Chest opened',
      conditions: { selfSwitches: { A: true } },
      graphic: { sprite: 'chest_open' },
      movement: { type: 'fixed', speed: 'normal' },
      options: { walking: false, stepping: false, directionFix: false, through: false },
      priority: 'sameAsCharacters',
      trigger: 'interact',
      commands: [{ type: 'showText', text: 'Already open' }],
    };
    const s2 = projectReducer(s1, {
      type: 'ADD_EVENT_PAGE',
      mapId: 'town',
      eventId: 'old_man',
      page,
    });
    expect(s2.maps.town.events[0].pages?.map(p => p.id)).toEqual(['page_1', 'page_2']);

    const s3 = projectReducer(s2, {
      type: 'REORDER_EVENT_PAGE',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_2',
      direction: 'up',
    });
    expect(s3.maps.town.events[0].pages?.map(p => p.id)).toEqual(['page_2', 'page_1']);
  });

  it('page-scoped command actions edit the selected page', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'ADD_PAGE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      command: { type: 'showText', text: 'Page add' },
    });
    const s3 = projectReducer(s2, {
      type: 'UPDATE_PAGE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      path: [1],
      command: { type: 'showText', text: 'Page replace' },
    });
    expect(s3.maps.town.events[0].pages?.[0].commands[1]).toEqual({ type: 'showText', text: 'Page replace' });
    expect(s3.maps.town.events[0].commands[1]).toEqual({ type: 'showText', text: 'Page replace' });
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

  it('UPDATE_COMMAND can edit showChoices and battle branch commands', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_EVENT_PAGE',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      changes: {
        commands: [
          { type: 'showChoices', prompt: 'Pick', choices: [{ label: 'A', commands: [{ type: 'showText', text: 'Choice A' }] }] },
          { type: 'startBattle', troopId: 'slime', canEscape: true, victoryBranch: [{ type: 'showText', text: 'Win' }] },
        ],
      },
    });
    const s3 = projectReducer(s2, {
      type: 'UPDATE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [0, 0, 0],
      command: { type: 'showText', text: 'Choice edited' },
    });
    const s4 = projectReducer(s3, {
      type: 'UPDATE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [1, 0, 0],
      command: { type: 'showText', text: 'Victory edited' },
    });

    const choice = s4.maps.town.events[0].commands[0];
    const battle = s4.maps.town.events[0].commands[1];
    if (choice.type !== 'showChoices' || battle.type !== 'startBattle') throw new Error('unexpected commands');
    expect(choice.choices[0].commands[0]).toEqual({ type: 'showText', text: 'Choice edited' });
    expect(battle.victoryBranch?.[0]).toEqual({ type: 'showText', text: 'Victory edited' });
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

  it('command stack actions insert, move, and duplicate root commands', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'INSERT_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [0],
      placement: 'before',
      command: { type: 'showText', text: 'Intro' },
    });
    expect(s2.maps.town.events[0].commands[0]).toEqual({ type: 'showText', text: 'Intro' });
    expect(s2.maps.town.events[0].pages?.[0].commands[0]).toEqual({ type: 'showText', text: 'Intro' });

    const s3 = projectReducer(s2, {
      type: 'MOVE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [0],
      direction: 'down',
    });
    expect(s3.maps.town.events[0].commands[1]).toEqual({ type: 'showText', text: 'Intro' });

    const s4 = projectReducer(s3, {
      type: 'DUPLICATE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [0],
    });
    expect(s4.maps.town.events[0].commands).toHaveLength(3);
    expect(s4.maps.town.events[0].commands[1]).toEqual(s4.maps.town.events[0].commands[0]);
    expect(s4.maps.town.events[0].commands[1]).not.toBe(s4.maps.town.events[0].commands[0]);
  });

  it('INSERT_COMMAND appends into empty nested branches', () => {
    const branchCommands: EventCommand[] = [
      { type: 'ifFlag', flag: 'talked', equals: false, then: [], else: [] },
      { type: 'showChoices', prompt: 'Pick', choices: [{ label: 'A', commands: [] }] },
      { type: 'startBattle', troopId: 'slime', canEscape: true },
    ];
    const s1 = projectReducer(loadedState(), {
      type: 'UPDATE_EVENT_PAGE',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      changes: { commands: branchCommands },
    });
    const s2 = projectReducer(s1, {
      type: 'INSERT_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [0, 0],
      placement: 'append',
      command: { type: 'showText', text: 'Then branch' },
    });
    const s3 = projectReducer(s2, {
      type: 'INSERT_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [1, 0],
      placement: 'append',
      command: { type: 'showText', text: 'Choice branch' },
    });
    const s4 = projectReducer(s3, {
      type: 'INSERT_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      path: [2, 0],
      placement: 'append',
      command: { type: 'showText', text: 'Victory branch' },
    });

    const [ifCmd, choiceCmd, battleCmd] = s4.maps.town.events[0].commands;
    if (ifCmd.type !== 'ifFlag' || choiceCmd.type !== 'showChoices' || battleCmd.type !== 'startBattle') {
      throw new Error('unexpected commands');
    }
    expect(ifCmd.then[0]).toEqual({ type: 'showText', text: 'Then branch' });
    expect(choiceCmd.choices[0].commands[0]).toEqual({ type: 'showText', text: 'Choice branch' });
    expect(battleCmd.victoryBranch?.[0]).toEqual({ type: 'showText', text: 'Victory branch' });
  });

  it('page command stack actions edit page 1 and mirror legacy commands', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'INSERT_PAGE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      path: [],
      placement: 'append',
      command: { type: 'showText', text: 'Tail' },
    });
    const s3 = projectReducer(s2, {
      type: 'MOVE_PAGE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      path: [1],
      direction: 'up',
    });
    const s4 = projectReducer(s3, {
      type: 'DUPLICATE_PAGE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      path: [0],
    });

    expect(s4.maps.town.events[0].pages?.[0].commands[0]).toEqual({ type: 'showText', text: 'Tail' });
    expect(s4.maps.town.events[0].pages?.[0].commands[1]).toEqual({ type: 'showText', text: 'Tail' });
    expect(s4.maps.town.events[0].commands).toEqual(s4.maps.town.events[0].pages?.[0].commands);
  });

  it('REMOVE_COMMAND_RANGE deletes contiguous root commands and mirrors page 1', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'UPDATE_EVENT_PAGE',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      changes: {
        commands: [
          { type: 'showText', text: 'A' },
          { type: 'showText', text: 'B' },
          { type: 'showText', text: 'C' },
          { type: 'showText', text: 'D' },
        ],
      },
    });
    const s2 = projectReducer(s1, {
      type: 'REMOVE_COMMAND_RANGE',
      mapId: 'town',
      eventId: 'old_man',
      fromPath: [1],
      toPath: [2],
    });

    expect(s2.maps.town.events[0].commands).toEqual([
      { type: 'showText', text: 'A' },
      { type: 'showText', text: 'D' },
    ]);
    expect(s2.maps.town.events[0].pages?.[0].commands).toEqual(s2.maps.town.events[0].commands);
  });

  it('REMOVE_PAGE_COMMAND_RANGE deletes contiguous nested branch commands and mirrors page 1', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'UPDATE_EVENT_PAGE',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      changes: {
        commands: [
          {
            type: 'ifFlag',
            flag: 'talked',
            equals: false,
            then: [
              { type: 'showText', text: 'Then A' },
              { type: 'showText', text: 'Then B' },
              { type: 'showText', text: 'Then C' },
            ],
            else: [{ type: 'showText', text: 'Else A' }],
          },
        ],
      },
    });
    const s2 = projectReducer(s1, {
      type: 'REMOVE_PAGE_COMMAND_RANGE',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      fromPath: [0, 0, 1],
      toPath: [0, 0, 0],
    });

    const event = s2.maps.town.events[0];
    const command = event.pages?.[0].commands[0];
    if (!command || command.type !== 'ifFlag') throw new Error('expected ifFlag');
    expect(command.then).toEqual([{ type: 'showText', text: 'Then C' }]);
    expect(command.else).toEqual([{ type: 'showText', text: 'Else A' }]);
    expect(event.commands).toEqual(event.pages?.[0].commands);
  });

  it('REMOVE_PAGE_COMMAND_RANGE ignores endpoints in different command lists', () => {
    const commands: EventCommand[] = [
      {
        type: 'ifFlag',
        flag: 'talked',
        equals: false,
        then: [{ type: 'showText', text: 'Then A' }],
        else: [{ type: 'showText', text: 'Else A' }],
      },
    ];
    const s1 = projectReducer(loadedState(), {
      type: 'UPDATE_EVENT_PAGE',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      changes: { commands },
    });
    const s2 = projectReducer(s1, {
      type: 'REMOVE_PAGE_COMMAND_RANGE',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      fromPath: [0, 0, 0],
      toPath: [0, 1, 0],
    });

    expect(s2.maps.town.events[0].pages?.[0].commands).toEqual(commands);
    expect(s2.maps.town.events[0].commands).toEqual(commands);
  });

  it('page command stack updates setMovementRoute commands and mirrors page 1', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'INSERT_PAGE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      path: [],
      placement: 'append',
      command: {
        type: 'setMovementRoute',
        target: 'player',
        repeat: false,
        skippable: true,
        wait: true,
        steps: [{ type: 'moveRight' }],
      },
    });
    const s2 = projectReducer(s1, {
      type: 'UPDATE_PAGE_COMMAND',
      mapId: 'town',
      eventId: 'old_man',
      pageId: 'page_1',
      path: [1],
      command: {
        type: 'setMovementRoute',
        target: 'player',
        repeat: false,
        skippable: false,
        wait: true,
        steps: [{ type: 'moveRight' }, { type: 'turnDown' }],
      },
    });

    const route = s2.maps.town.events[0].pages?.[0].commands[1];
    expect(route).toEqual({
      type: 'setMovementRoute',
      target: 'player',
      repeat: false,
      skippable: false,
      wait: true,
      steps: [{ type: 'moveRight' }, { type: 'turnDown' }],
    });
    expect(s2.maps.town.events[0].commands).toEqual(s2.maps.town.events[0].pages?.[0].commands);
  });

  it('UPDATE_COMMON_EVENT_COMMANDS edits common events without mutating map events and supports undo', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'ADD_DATABASE_ENTRY',
      table: 'commonEvents',
      entry: {
        id: 'ce_intro',
        name: 'Intro',
        trigger: 'manual',
        commands: [{ type: 'showText', text: 'Common old' }],
      },
    });
    const mapCommandsBefore = s1.maps.town.events[0].commands;

    const s2 = projectReducer(s1, {
      type: 'UPDATE_COMMON_EVENT_COMMANDS',
      commonEventId: 'ce_intro',
      commands: [
        {
          type: 'ifSwitch',
          switchId: 'story_ready',
          equals: true,
          then: [{ type: 'showText', text: 'Common new' }],
          else: [],
        },
      ],
    });

    expect(s2.databases.commonEvents[0].commands).toEqual([
      {
        type: 'ifSwitch',
        switchId: 'story_ready',
        equals: true,
        then: [{ type: 'showText', text: 'Common new' }],
        else: [],
      },
    ]);
    expect(s2.maps.town.events[0].commands).toEqual(mapCommandsBefore);
    expect(s2.maps.town.events[0].commands).toBe(mapCommandsBefore);
    expect(s2.canUndo).toBe(true);

    const undone = projectReducer(s2, { type: 'UNDO' });
    expect(undone.databases.commonEvents[0].commands).toEqual([{ type: 'showText', text: 'Common old' }]);
    expect(undone.maps.town.events[0].commands).toEqual(mapCommandsBefore);
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

  it('PAINT_TILE refuses locked layers', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_MAP_LAYER_META',
      mapId: 'town',
      layerName: 'ground',
      changes: { locked: true },
    });
    const s3 = projectReducer(s2, {
      type: 'PAINT_TILE',
      mapId: 'town',
      layerName: 'ground',
      x: 0,
      y: 0,
      tile: 2,
    });

    expect(s3.maps.town.layers[0].tiles[0]).toBe(1);
  });

  it('PAINT_TILE on a locked layer does not dirty or create history when nothing changes', () => {
    const s1 = loadedState();
    const locked = projectReducer(s1, {
      type: 'UPDATE_MAP_LAYER_META',
      mapId: 'town',
      layerName: 'ground',
      changes: { locked: true },
    });
    const cleanLocked = projectReducer(locked, { type: 'MARK_SAVED', at: '2026-06-02T04:00:00.000Z' });

    const attemptedPaint = projectReducer(cleanLocked, {
      type: 'PAINT_TILE',
      mapId: 'town',
      layerName: 'ground',
      x: 0,
      y: 0,
      tile: 2,
    });

    expect(attemptedPaint).toBe(cleanLocked);
    expect(attemptedPaint.dirty).toBe(false);
    expect(attemptedPaint.history).toHaveLength(cleanLocked.history.length);
  });

  it('UPDATE_MAP_LAYER_META changes visibility and lock state with undo support', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_MAP_LAYER_META',
      mapId: 'town',
      layerName: 'ground',
      changes: { visible: false, locked: true },
    });
    expect(s2.maps.town.layers[0]).toMatchObject({ visible: false, locked: true });

    const s3 = projectReducer(s2, { type: 'UNDO' });
    expect(s3.maps.town.layers[0].visible).toBeUndefined();
    expect(s3.maps.town.layers[0].locked).toBeUndefined();
  });

  it('paints region ids without changing visual or collision layers', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'CREATE_MAP',
      mapId: 'field',
      name: 'Field',
      width: 4,
      height: 4,
    });
    const s2 = projectReducer(s1, {
      type: 'PAINT_TILE',
      mapId: 'field',
      layerName: 'region',
      x: 1,
      y: 1,
      tile: 7,
    });

    const region = s2.maps.field.layers.find(layer => layer.name === 'region');
    expect(region?.tiles[5]).toBe(7);
    expect(s2.maps.field.layers.find(layer => layer.name === 'ground')?.tiles[5]).toBe(1);
    expect(s2.maps.field.layers.find(layer => layer.name === 'collision')?.tiles[5]).toBe(0);
  });

  it('PAINT_RECT fills a rectangular region on the requested layer', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'PAINT_RECT',
      mapId: 'town',
      layerName: 'ground',
      x1: 1,
      y1: 1,
      x2: 2,
      y2: 2,
      tile: 2,
    });
    expect(s2.maps.town.layers[0].tiles[11]).toBe(2);
    expect(s2.maps.town.layers[0].tiles[12]).toBe(2);
    expect(s2.maps.town.layers[0].tiles[21]).toBe(2);
    expect(s2.maps.town.layers[0].tiles[22]).toBe(2);
  });

  it('FLOOD_FILL replaces a contiguous region only', () => {
    const s1 = loadedState();
    s1.maps.town.layers[0].tiles[1] = 2;
    const s2 = projectReducer(s1, {
      type: 'FLOOD_FILL',
      mapId: 'town',
      layerName: 'ground',
      x: 0,
      y: 0,
      tile: 3,
    });
    expect(s2.maps.town.layers[0].tiles[0]).toBe(3);
    expect(s2.maps.town.layers[0].tiles[1]).toBe(2);
  });

  it('RESIZE_MAP preserves existing cells and fills newly created cells explicitly', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'RESIZE_MAP',
      mapId: 'town',
      width: 12,
      height: 11,
      visualFillTile: 1,
    });
    expect(s2.maps.town.width).toBe(12);
    expect(s2.maps.town.height).toBe(11);
    expect(s2.maps.town.layers[0].tiles).toHaveLength(132);
    expect(s2.maps.town.layers[0].tiles[131]).toBe(1);
    expect(s2.maps.town.layers[1].tiles[131]).toBe(0);
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

  it('UPDATE_MAP_PROPERTIES changes professional map settings with undo support', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_MAP_PROPERTIES',
      mapId: 'town',
      changes: {
        name: 'Harbor Town',
        displayName: 'Harbor',
        tilesetId: 'sample-town',
        scrollType: 'none',
        encounterSteps: 32,
        battleback: 'field',
      },
    });

    expect(s2.dirty).toBe(true);
    expect(s2.maps.town.name).toBe('Harbor Town');
    expect(s2.maps.town.displayName).toBe('Harbor');
    expect(s2.maps.town.tilesetId).toBe('sample-town');
    expect(s2.maps.town.scrollType).toBe('none');
    expect(s2.maps.town.encounterSteps).toBe(32);
    expect(s2.maps.town.battleback).toBe('field');

    const s3 = projectReducer(s2, { type: 'UNDO' });
    expect(s3.maps.town.name).toBe('Town');
  });

  it('UPDATE_MAP_PROPERTIES normalizes editable map metadata', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'UPDATE_MAP_PROPERTIES',
      mapId: 'town',
      changes: {
        scrollType: 'diagonal' as never,
        encounterSteps: -12,
        battleback: '  field  ',
        parallax: {
          image: '  clouds  ',
          loopX: true,
          loopY: false,
          scrollX: Number.NaN,
          scrollY: -2,
        },
      },
    });

    expect(s2.maps.town.scrollType).toBe('none');
    expect(s2.maps.town.encounterSteps).toBe(0);
    expect(s2.maps.town.battleback).toBe('field');
    expect(s2.maps.town.parallax).toEqual({
      image: 'clouds',
      loopX: true,
      loopY: false,
      scrollX: 0,
      scrollY: -2,
    });
  });

  it('CREATE_MAP appends a map reference and default authoring layers', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'CREATE_MAP',
      mapId: 'forest',
      name: 'Forest',
      parentId: 'town',
      width: 6,
      height: 5,
    });

    expect(s2.project.maps.find(ref => ref.id === 'forest')).toMatchObject({
      id: 'forest',
      path: 'data/maps/forest.json',
      parentId: 'town',
      order: 0,
      expanded: true,
    });
    expect(s2.maps.forest.layers.map(layer => layer.name)).toEqual([
      'ground',
      'decoration',
      'foreground',
      'collision',
      'region',
    ]);
    expect(s2.maps.forest.layers).toHaveLength(5);
    expect(s2.maps.forest.layers[4].type).toBe('region');
  });

  it('DUPLICATE_MAP deep-clones maps without aliasing source arrays', () => {
    const s1 = loadedState();
    const s2 = projectReducer(s1, {
      type: 'DUPLICATE_MAP',
      sourceMapId: 'town',
      newMapId: 'town_copy',
      name: 'Town Copy',
    });

    expect(s2.maps.town_copy.name).toBe('Town Copy');
    expect(s2.project.maps.map(ref => ref.id)).toEqual(['town', 'town_copy']);
    expect(s2.maps.town_copy.layers[0].tiles).not.toBe(s2.maps.town.layers[0].tiles);

    s2.maps.town_copy.layers[0].tiles[0] = 9;
    expect(s2.maps.town.layers[0].tiles[0]).toBe(1);
  });

  it('UPDATE_MAP_REFERENCE and MOVE_MAP maintain tree metadata with undo support', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'CREATE_MAP',
      mapId: 'forest',
      name: 'Forest',
      width: 4,
      height: 4,
    });
    const s2 = projectReducer(s1, {
      type: 'UPDATE_MAP_REFERENCE',
      mapId: 'forest',
      changes: { expanded: false },
    });
    const s3 = projectReducer(s2, {
      type: 'MOVE_MAP',
      mapId: 'forest',
      parentId: 'town',
      order: 0,
    });

    expect(s3.project.maps.find(ref => ref.id === 'forest')).toMatchObject({
      parentId: 'town',
      order: 0,
      expanded: false,
    });

    const s4 = projectReducer(s3, { type: 'UNDO' });
    expect(s4.project.maps.find(ref => ref.id === 'forest')?.parentId).toBeNull();
  });

  it('SWAP_MAP_ORDER reorders siblings in one undoable step', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'CREATE_MAP',
      mapId: 'forest',
      name: 'Forest',
      width: 4,
      height: 4,
    });
    const s2 = projectReducer(s1, {
      type: 'CREATE_MAP',
      mapId: 'cave',
      name: 'Cave',
      width: 4,
      height: 4,
    });
    const s3 = projectReducer(s2, {
      type: 'SWAP_MAP_ORDER',
      firstMapId: 'forest',
      secondMapId: 'cave',
    });

    expect(s3.project.maps.find(ref => ref.id === 'forest')?.order).toBe(2);
    expect(s3.project.maps.find(ref => ref.id === 'cave')?.order).toBe(1);

    const s4 = projectReducer(s3, { type: 'UNDO' });
    expect(s4.project.maps.find(ref => ref.id === 'forest')?.order).toBe(1);
    expect(s4.project.maps.find(ref => ref.id === 'cave')?.order).toBe(2);
  });

  it('MOVE_MAP inserts within sibling groups and renumbers affected orders', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'CREATE_MAP',
      mapId: 'house',
      name: 'House',
      parentId: 'town',
      width: 4,
      height: 4,
    });
    const s2 = projectReducer(s1, {
      type: 'CREATE_MAP',
      mapId: 'cave',
      name: 'Cave',
      parentId: 'town',
      width: 4,
      height: 4,
    });
    const s3 = projectReducer(s2, {
      type: 'MOVE_MAP',
      mapId: 'cave',
      parentId: 'town',
      order: 0,
    });

    expect(s3.project.maps.find(ref => ref.id === 'cave')).toMatchObject({
      parentId: 'town',
      order: 0,
    });
    expect(s3.project.maps.find(ref => ref.id === 'house')).toMatchObject({
      parentId: 'town',
      order: 1,
    });

    const s4 = projectReducer(s3, { type: 'UNDO' });
    expect(s4.project.maps.find(ref => ref.id === 'house')?.order).toBe(0);
    expect(s4.project.maps.find(ref => ref.id === 'cave')?.order).toBe(1);
  });

  it('MOVE_MAP refuses to move a parent under its own descendant', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'CREATE_MAP',
      mapId: 'house',
      name: 'House',
      parentId: 'town',
      width: 4,
      height: 4,
    });
    const s2 = projectReducer(s1, {
      type: 'MOVE_MAP',
      mapId: 'town',
      parentId: 'house',
      order: 0,
    });

    expect(s2).toBe(s1);
  });

  it('REMOVE_MAP refuses the last or start map and removes other maps atomically', () => {
    const s1 = loadedState();
    const refusedStart = projectReducer(s1, { type: 'REMOVE_MAP', mapId: 'town' });
    expect(refusedStart).toBe(s1);

    const s2 = projectReducer(s1, {
      type: 'CREATE_MAP',
      mapId: 'forest',
      name: 'Forest',
      width: 4,
      height: 4,
    });
    const s3 = projectReducer(s2, { type: 'REMOVE_MAP', mapId: 'forest' });
    expect(s3.project.maps.map(ref => ref.id)).toEqual(['town']);
    expect(s3.maps.forest).toBeUndefined();
  });

  it('REMOVE_MAP reparents children with stable root ordering', () => {
    const s1 = projectReducer(loadedState(), {
      type: 'CREATE_MAP',
      mapId: 'forest',
      name: 'Forest',
      width: 4,
      height: 4,
    });
    const s2 = projectReducer(s1, {
      type: 'CREATE_MAP',
      mapId: 'cave',
      name: 'Cave',
      parentId: 'forest',
      width: 4,
      height: 4,
    });
    const s3 = projectReducer(s2, { type: 'REMOVE_MAP', mapId: 'forest' });

    expect(s3.project.maps.map(ref => ref.id)).toEqual(['town', 'cave']);
    expect(s3.project.maps.find(ref => ref.id === 'town')).toMatchObject({
      parentId: null,
      order: 0,
    });
    expect(s3.project.maps.find(ref => ref.id === 'cave')).toMatchObject({
      parentId: null,
      order: 1,
    });
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
