import { describe, it, expect } from 'vitest';
import { validateProject } from '../validateProject';
import type { FullProjectState } from '../../adapters/types';
import type { MapData } from '../../types/project';
import { mergeDatabases } from '../../adapters/defaultDatabases';

function makeMap(): MapData {
  return {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    width: 4,
    height: 4,
    tileSize: 32,
    layers: [
      { name: 'g', type: 'visual', tiles: new Array(16).fill(1) },
      { name: 'c', type: 'collision', tiles: new Array(16).fill(0) },
    ],
    events: [],
  };
}

function projectWith(databases: Partial<FullProjectState['databases']>): FullProjectState {
  return {
    project: {
      schemaVersion: 1,
      title: 'T',
      startMapId: 'town',
      startPosition: { x: 0, y: 0, direction: 'down' },
      maps: [{ id: 'town', path: 'data/maps/town.json' }],
      database: { items: 'data/database/items.json' },
    },
    maps: { town: makeMap() },
    items: { items: [{ id: 'potion', name: 'P', description: '', type: 'consumable' }] },
    databases: mergeDatabases(databases),
  };
}

describe('validateProject (Phase 6 cross-database checks)', () => {
  it('rejects actor referencing unknown class', () => {
    const project = projectWith({
      actors: [
        {
          id: 'arc',
          name: 'Arc',
          classId: 'phantom',
          level: 1,
          hp: 10,
          mp: 0,
          baseStats: {
            maxHp: 10,
            maxMp: 0,
            attack: 1,
            defense: 1,
            magicAttack: 1,
            magicDefense: 1,
            agility: 1,
            luck: 1,
          },
          equipment: { weapon: null, armor: null, accessory: null },
          skills: [],
        },
      ],
    });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown class'))).toBe(true);
  });

  it('rejects troop referencing unknown enemy', () => {
    const project = projectWith({
      troops: [{ id: 't1', name: 'T1', members: ['ghost'] }],
    });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown enemy'))).toBe(true);
  });

  it('rejects shop listing unknown item', () => {
    const project = projectWith({
      shops: [{ id: 's1', name: 'S', listings: [{ itemId: 'phantom', price: 1 }] }],
    });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown item'))).toBe(true);
  });

  it('rejects duplicate switch ids', () => {
    const project = projectWith({
      switches: [
        { id: 'a', name: 'A', initial: false },
        { id: 'a', name: 'B', initial: true },
      ],
    });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
  });

  it('rejects duplicate weapon armor and state ids', () => {
    const project = projectWith({
      weapons: [
        { id: 'sword', name: 'Sword', description: '', weaponTypeId: 'sword', price: 10, params: {} },
        { id: 'sword', name: 'Sword 2', description: '', weaponTypeId: 'sword', price: 20, params: {} },
      ],
      armors: [
        { id: 'coat', name: 'Coat', description: '', armorTypeId: 'clothes', slot: 'body', price: 10, params: {} },
        { id: 'coat', name: 'Coat 2', description: '', armorTypeId: 'clothes', slot: 'body', price: 20, params: {} },
      ],
      states: [
        { id: 'poison', name: 'Poison', priority: 50, removeAtBattleEnd: false, traits: [] },
        { id: 'poison', name: 'Poison 2', priority: 40, removeAtBattleEnd: true, traits: [] },
      ],
    });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('Duplicate weapon id'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Duplicate armor id'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Duplicate state id'))).toBe(true);
  });

  it('rejects controlVariable referencing unknown variable', () => {
    const project = projectWith({
      variables: [{ id: 'v1', name: 'V1', initial: 0 }],
    });
    project.maps.town.events.push({
      id: 'evt',
      type: 'object',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [{ type: 'controlVariable', variableId: 'phantom', op: 'set', value: 1 }],
    });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown variable'))).toBe(true);
  });

  it('rejects startBattle referencing unknown troop', () => {
    const project = projectWith({});
    project.maps.town.events.push({
      id: 'evt',
      type: 'object',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [{ type: 'startBattle', troopId: 'phantom', canEscape: false }],
    });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown troop'))).toBe(true);
  });

  it('accepts valid quest objective references', () => {
    const project = projectWith({
      quests: [
        {
          id: 'q1',
          title: 'Q',
          summary: '',
          objectives: [{ id: 'step1', description: '' }],
          rewards: { gold: 0, exp: 0, items: [] },
        },
      ],
    });
    project.maps.town.events.push({
      id: 'evt',
      type: 'object',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [
        { type: 'updateQuestObjective', questId: 'q1', objectiveId: 'step1', state: 'done' },
      ],
    });
    const report = validateProject(project);
    expect(report.errors).toEqual([]);
  });

  it('rejects updateQuestObjective with unknown objective', () => {
    const project = projectWith({
      quests: [
        {
          id: 'q1',
          title: 'Q',
          summary: '',
          objectives: [{ id: 'step1', description: '' }],
          rewards: { gold: 0, exp: 0, items: [] },
        },
      ],
    });
    project.maps.town.events.push({
      id: 'evt',
      type: 'object',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [
        { type: 'updateQuestObjective', questId: 'q1', objectiveId: 'phantom', state: 'done' },
      ],
    });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown objective'))).toBe(true);
  });

  it('flags system startingParty referencing unknown actor', () => {
    const project = projectWith({
      system: {
        startingParty: ['phantom'],
        startingGold: 50,
      },
    });
    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('unknown actor'))).toBe(true);
  });
});
