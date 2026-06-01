import { describe, it, expect } from 'vitest';
import { initialProjectStoreState, projectReducer, type ProjectStoreState } from '../projectStore';
import type { EventCommand, MapData } from '../../types/project';

describe('projectReducer database actions', () => {
  it('ADD_DATABASE_ENTRY appends and marks dirty', () => {
    const s1 = projectReducer(initialProjectStoreState, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'switches',
      entry: { id: 'door_open', name: 'Door open', initial: false },
    });
    expect(s1.databases.switches).toHaveLength(1);
    expect(s1.dirty).toBe(true);
  });

  it('ADD_DATABASE_ENTRY supports separated weapon armor and state tables', () => {
    let state = projectReducer(initialProjectStoreState, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'weapons',
      entry: {
        id: 'bronze_sword',
        name: 'Bronze Sword',
        description: '',
        weaponTypeId: 'sword',
        price: 50,
        params: { attack: 2 },
      },
    });
    state = projectReducer(state, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'armors',
      entry: {
        id: 'cloth_armor',
        name: 'Cloth Armor',
        description: '',
        armorTypeId: 'clothes',
        slot: 'body',
        price: 30,
        params: { defense: 1 },
      },
    });
    state = projectReducer(state, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'states',
      entry: {
        id: 'poison',
        name: 'Poison',
        priority: 50,
        removeAtBattleEnd: false,
        traits: [],
      },
    });

    expect(state.databases.weapons[0].id).toBe('bronze_sword');
    expect(state.databases.armors[0].slot).toBe('body');
    expect(state.databases.states[0].priority).toBe(50);
  });

  it('ADD_DATABASE_ENTRY refuses duplicate ids', () => {
    const s1 = projectReducer(initialProjectStoreState, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'switches',
      entry: { id: 'a', name: 'A', initial: false },
    });
    const s2 = projectReducer(s1, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'switches',
      entry: { id: 'a', name: 'B', initial: true },
    });
    expect(s2).toBe(s1);
  });

  it('UPDATE_DATABASE_ENTRY mutates fields, preserves id', () => {
    const s1 = projectReducer(initialProjectStoreState, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'variables',
      entry: { id: 'v1', name: 'V1', initial: 0 },
    });
    const s2 = projectReducer(s1, {
      type: 'UPDATE_DATABASE_ENTRY',
      table: 'variables',
      id: 'v1',
      changes: { name: 'V One', initial: 5 },
    });
    expect(s2.databases.variables[0].name).toBe('V One');
    expect(s2.databases.variables[0].initial).toBe(5);
    expect(s2.databases.variables[0].id).toBe('v1');
  });

  it('RENAME_DATABASE_ENTRY changes id when free', () => {
    const s1 = projectReducer(initialProjectStoreState, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'switches',
      entry: { id: 'old', name: 'Old', initial: false },
    });
    const s2 = projectReducer(s1, {
      type: 'RENAME_DATABASE_ENTRY',
      table: 'switches',
      oldId: 'old',
      newId: 'new',
    });
    expect(s2.databases.switches[0].id).toBe('new');
  });

  it('RENAME_DATABASE_ENTRY refuses to overwrite an existing id', () => {
    let s = projectReducer(initialProjectStoreState, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'switches',
      entry: { id: 'a', name: 'A', initial: false },
    });
    s = projectReducer(s, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'switches',
      entry: { id: 'b', name: 'B', initial: false },
    });
    const s3 = projectReducer(s, {
      type: 'RENAME_DATABASE_ENTRY',
      table: 'switches',
      oldId: 'a',
      newId: 'b',
    });
    expect(s3).toBe(s);
  });

  it('RENAME_DATABASE_ENTRY can update command and page references deterministically', () => {
    const commands: EventCommand[] = [
      { type: 'ifSwitch', switchId: 'story_ready', equals: true, then: [], else: [] },
      { type: 'controlVariable', variableId: 'score', op: 'set', value: 1 },
      { type: 'callCommonEvent', commonEventId: 'ce_intro' },
      { type: 'startQuest', questId: 'lost_chest' },
      { type: 'openShop', shopId: 'general_store' },
    ];
    const map: MapData = {
      schemaVersion: 1,
      id: 'town',
      name: 'Town',
      width: 4,
      height: 4,
      tileSize: 32,
      layers: [
        { name: 'ground', type: 'visual', tiles: new Array(16).fill(1) },
        { name: 'collision', type: 'collision', tiles: new Array(16).fill(0) },
      ],
      events: [
        {
          id: 'event_1',
          type: 'npc',
          x: 0,
          y: 0,
          solid: false,
          trigger: 'interact',
          commands,
          pages: [
            {
              id: 'page_1',
              conditions: {
                switches: { story_ready: true },
                variables: [{ variableId: 'score', op: 'gte', value: 1 }],
              },
              graphic: {},
              movement: { type: 'fixed', speed: 'normal' },
              options: { walking: false, stepping: false, directionFix: false, through: false },
              priority: 'sameAsCharacters',
              trigger: 'interact',
              commands,
            },
          ],
        },
      ],
    };
    let state: ProjectStoreState = {
      ...initialProjectStoreState,
      maps: { town: map },
      databases: {
        ...initialProjectStoreState.databases,
        switches: [{ id: 'story_ready', name: 'Story Ready', initial: false }],
        variables: [{ id: 'score', name: 'Score', initial: 0 }],
        commonEvents: [{ id: 'ce_intro', name: 'Intro', trigger: 'manual' as const, commands: [] }],
        quests: [{ id: 'lost_chest', title: 'Lost Chest', summary: '', objectives: [], rewards: { gold: 0, exp: 0, items: [] } }],
        shops: [{ id: 'general_store', name: 'General Store', listings: [] }],
      },
    };

    state = projectReducer(state, {
      type: 'RENAME_DATABASE_ENTRY',
      table: 'switches',
      oldId: 'story_ready',
      newId: 'story_started',
      updateReferences: true,
    });
    state = projectReducer(state, {
      type: 'RENAME_DATABASE_ENTRY',
      table: 'variables',
      oldId: 'score',
      newId: 'score_total',
      updateReferences: true,
    });
    state = projectReducer(state, {
      type: 'RENAME_DATABASE_ENTRY',
      table: 'commonEvents',
      oldId: 'ce_intro',
      newId: 'ce_opening',
      updateReferences: true,
    });
    state = projectReducer(state, {
      type: 'RENAME_DATABASE_ENTRY',
      table: 'quests',
      oldId: 'lost_chest',
      newId: 'found_chest',
      updateReferences: true,
    });
    state = projectReducer(state, {
      type: 'RENAME_DATABASE_ENTRY',
      table: 'shops',
      oldId: 'general_store',
      newId: 'market',
      updateReferences: true,
    });

    const page = state.maps.town.events[0].pages?.[0];
    expect(page?.conditions.switches).toEqual({ story_started: true });
    expect(page?.conditions.variables?.[0].variableId).toBe('score_total');
    expect(page?.commands).toEqual([
      { type: 'ifSwitch', switchId: 'story_started', equals: true, then: [], else: [] },
      { type: 'controlVariable', variableId: 'score_total', op: 'set', value: 1 },
      { type: 'callCommonEvent', commonEventId: 'ce_opening' },
      { type: 'startQuest', questId: 'found_chest' },
      { type: 'openShop', shopId: 'market' },
    ]);
  });

  it('REMOVE_DATABASE_ENTRY drops the entry', () => {
    const s1 = projectReducer(initialProjectStoreState, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'shops',
      entry: { id: 'x', name: 'X', listings: [] },
    });
    const s2 = projectReducer(s1, {
      type: 'REMOVE_DATABASE_ENTRY',
      table: 'shops',
      id: 'x',
    });
    expect(s2.databases.shops).toHaveLength(0);
  });

  it('UPDATE_SYSTEM_DATA updates partial fields', () => {
    const s1 = projectReducer(initialProjectStoreState, {
      type: 'UPDATE_SYSTEM_DATA',
      changes: { startingGold: 99 },
    });
    expect(s1.databases.system.startingGold).toBe(99);
    expect(s1.dirty).toBe(true);
  });

  it('UPDATE_ITEM_DATABASE replaces the legacy item shard and marks dirty', () => {
    const s1 = projectReducer(initialProjectStoreState, {
      type: 'UPDATE_ITEM_DATABASE',
      items: {
        items: [
          { id: 'ether', name: 'Ether', description: '', type: 'consumable', price: 30, effect: { mp: 10 } },
        ],
      },
    });

    expect(s1.items.items).toEqual([
      { id: 'ether', name: 'Ether', description: '', type: 'consumable', price: 30, effect: { mp: 10 } },
    ]);
    expect(s1.dirty).toBe(true);
  });
});
