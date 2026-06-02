import { describe, expect, it } from 'vitest';
import { findReferences, listBrokenReferences } from '../referenceIndex';
import { mergeDatabases } from '../../adapters/defaultDatabases';
import type { FullProjectState } from '../../adapters/types';
import type { EventCommand, MapData } from '../../types/project';

function makeProject(): FullProjectState {
  const commands: EventCommand[] = [
    { type: 'ifSwitch', switchId: 'story_ready', equals: true, then: [], else: [] },
    { type: 'controlVariable', variableId: 'score', op: 'add', value: 1, sourceVariableId: 'bonus' },
    { type: 'callCommonEvent', commonEventId: 'ce_intro' },
    { type: 'updateQuestObjective', questId: 'lost_chest', objectiveId: 'open_chest', state: 'done' },
    { type: 'openShop', shopId: 'general_store' },
    { type: 'addItem', itemId: 'potion', amount: 1 },
  ];
  const map: MapData = {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    width: 4,
    height: 4,
    tileSize: 32,
    tilesetId: 'sample-town',
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
              variables: [{ variableId: 'score', op: 'gte', value: 3 }],
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

  return {
    project: {
      schemaVersion: 1,
      title: 'Reference Test',
      startMapId: 'town',
      startPosition: { x: 0, y: 0, direction: 'down' },
      maps: [{ id: 'town', path: 'data/maps/town.json' }],
      database: { items: 'data/database/items.json' },
    },
    maps: { town: map },
    items: { items: [{ id: 'potion', name: 'Potion', description: '', type: 'consumable' }] },
    databases: mergeDatabases({
      switches: [{ id: 'story_ready', name: 'Story Ready', initial: false }],
      variables: [
        { id: 'score', name: 'Score', initial: 0 },
        { id: 'bonus', name: 'Bonus', initial: 0 },
      ],
      commonEvents: [
        {
          id: 'ce_intro',
          name: 'Intro',
          trigger: 'autorun',
          switchId: 'story_ready',
          commands: [{ type: 'openShop', shopId: 'general_store' }],
        },
      ],
      quests: [
        {
          id: 'lost_chest',
          title: 'Lost Chest',
          summary: '',
          objectives: [{ id: 'open_chest', description: 'Open the chest' }],
          rewards: { gold: 0, exp: 0, items: [{ itemId: 'potion', amount: 1 }] },
        },
      ],
      shops: [{ id: 'general_store', name: 'General Store', listings: [{ itemId: 'potion', price: 10 }] }],
    }),
  };
}

describe('referenceIndex', () => {
  it('finds switch and variable references in pages, commands, and common events', () => {
    const project = makeProject();

    expect(findReferences(project, { table: 'switches', id: 'story_ready' }).map(ref => ref.source)).toEqual(
      expect.arrayContaining([
        'maps/town/events/event_1/pages/page_1/conditions/switches/story_ready',
        'maps/town/events/event_1/commands',
        'database/commonEvents/ce_intro/switchId',
      ]),
    );
    expect(findReferences(project, { table: 'variables', id: 'score' }).map(ref => ref.source)).toEqual(
      expect.arrayContaining([
        'maps/town/events/event_1/pages/page_1/conditions/variables/score',
        'maps/town/events/event_1/commands',
      ]),
    );
  });

  it('finds command, quest objective, shop listing, item, and tileset references', () => {
    const project = makeProject();

    expect(findReferences(project, { table: 'commonEvents', id: 'ce_intro' }).map(ref => ref.source)).toContain(
      'maps/town/events/event_1/commands',
    );
    expect(findReferences(project, { table: 'questObjectives', parentId: 'lost_chest', id: 'open_chest' }).map(ref => ref.source)).toContain(
      'maps/town/events/event_1/commands',
    );
    expect(findReferences(project, { table: 'shops', id: 'general_store' }).map(ref => ref.source)).toEqual(
      expect.arrayContaining(['maps/town/events/event_1/commands', 'database/commonEvents/ce_intro/commands']),
    );
    expect(findReferences(project, { table: 'items', id: 'potion' }).map(ref => ref.source)).toEqual(
      expect.arrayContaining([
        'maps/town/events/event_1/commands',
        'database/quests/lost_chest/rewards/items/potion',
        'database/shops/general_store/listings/potion',
      ]),
    );
    expect(findReferences(project, { table: 'tilesets', id: 'sample-town' }).map(ref => ref.source)).toContain(
      'maps/town/tilesetId',
    );
  });

  it('suggests same-table replacements for broken references', () => {
    const project = makeProject();
    project.maps.town.events[0].commands.push({ type: 'addItem', itemId: 'missing_potion', amount: 1 });

    const broken = listBrokenReferences(project);
    const missingItem = broken.find(ref => ref.reference.table === 'items' && ref.reference.id === 'missing_potion');

    expect(missingItem).toEqual(expect.objectContaining({
      reason: 'Missing items reference "missing_potion"',
      reference: expect.objectContaining({
        table: 'items',
        id: 'missing_potion',
        source: 'maps/town/events/event_1/commands',
      }),
    }));
    expect(missingItem?.options).toEqual([
      expect.objectContaining({
        kind: 'replace',
        replacementId: 'potion',
        label: 'Potion (potion)',
        action: {
          table: 'items',
          source: 'maps/town/events/event_1/commands',
          oldId: 'missing_potion',
          newId: 'potion',
        },
      }),
    ]);
  });

  it('does not suggest repairs when the target table has no replacement records', () => {
    const project = makeProject();
    project.databases.switches = [];
    project.databases.commonEvents[0].switchId = 'missing_switch';

    const broken = listBrokenReferences(project);
    const missingSwitch = broken.find(ref => ref.reference.table === 'switches' && ref.reference.id === 'missing_switch');

    expect(missingSwitch?.options).toEqual([]);
  });
});
