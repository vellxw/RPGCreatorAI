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

  it('rejects invalid item equipment and state references and numeric ranges', () => {
    const project = projectWith({
      types: {
        weaponTypes: [{ id: 'sword', name: 'Sword' }],
        armorTypes: [{ id: 'light', name: 'Light Armor' }],
        skillTypes: [],
        elements: [],
        equipmentSlots: [
          { id: 'weapon', name: 'Weapon' },
          { id: 'armor', name: 'Armor' },
          { id: 'accessory', name: 'Accessory' },
          { id: 'body', name: 'Body' },
        ],
        itemCategories: [{ id: 'consumable', name: 'Consumable' }],
      },
      weapons: [
        {
          id: 'bad_weapon',
          name: 'Bad Weapon',
          description: '',
          weaponTypeId: 'axe',
          price: -1,
          params: { attack: Number.NaN },
          animationId: 'missing_animation',
          traits: ['sharp', '', 'sharp'],
        },
      ],
      armors: [
        {
          id: 'bad_armor',
          name: 'Bad Armor',
          description: '',
          armorTypeId: 'plate',
          slot: 'shield',
          price: -5,
          params: { defense: Number.POSITIVE_INFINITY },
          traits: ['guarded', 'guarded', ''],
        },
      ],
      states: [
        {
          id: 'bad_state',
          name: 'Bad State',
          priority: 200,
          removeAtBattleEnd: false,
          restriction: 'sleep' as never,
          traits: ['poisoned', '', 'poisoned'],
        },
      ],
    });
    project.items.items = [
      {
        id: 'bad_item',
        name: 'Bad Item',
        description: '',
        type: 'rare',
        price: -2,
        slot: 'phantom' as never,
        effect: { hp: Number.NaN },
        modifiers: { attack: Number.POSITIVE_INFINITY },
      },
    ];

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Item "bad_item" references unknown item category "rare"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Item "bad_item" price must be non-negative'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Item "bad_item" references unknown equipment slot "phantom"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Weapon "bad_weapon" references unknown weapon type "axe"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Weapon "bad_weapon" price must be non-negative'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Weapon "bad_weapon" references unknown animation "missing_animation"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Weapon "bad_weapon" trait 2 is blank'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Weapon "bad_weapon" has duplicate trait "sharp"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Armor "bad_armor" references unknown armor type "plate"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Armor "bad_armor" references unknown equipment slot "shield"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Armor "bad_armor" trait 3 is blank'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Armor "bad_armor" has duplicate trait "guarded"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('State "bad_state" priority must be between 0 and 100'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('State "bad_state" has invalid restriction "sleep"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('State "bad_state" trait 2 is blank'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('State "bad_state" has duplicate trait "poisoned"'))).toBe(true);
  });

  it('rejects invalid party and combat references and numeric ranges', () => {
    const project = projectWith({
      types: {
        weaponTypes: [],
        armorTypes: [],
        skillTypes: [{ id: 'magic', name: 'Magic' }],
        elements: [{ id: 'fire', name: 'Fire' }],
        equipmentSlots: [
          { id: 'weapon', name: 'Weapon' },
          { id: 'armor', name: 'Armor' },
          { id: 'accessory', name: 'Accessory' },
        ],
        itemCategories: [{ id: 'consumable', name: 'Consumable' }],
      },
      actors: [
        {
          id: 'bad_actor',
          name: 'Bad Actor',
          classId: 'missing_class',
          level: 0,
          hp: -1,
          mp: Number.NaN,
          baseStats: {
            maxHp: 10,
            maxMp: 0,
            attack: Number.NaN,
            defense: 1,
            magicAttack: 1,
            magicDefense: 1,
            agility: 1,
            luck: 1,
          },
          equipment: { weapon: 'missing_item', accessory: 'potion' },
          skills: ['missing_skill'],
        },
      ],
      classes: [
        {
          id: 'bad_class',
          name: 'Bad Class',
          growth: {
            maxHp: 1,
            maxMp: 1,
            attack: 1,
            defense: Number.POSITIVE_INFINITY,
            magicAttack: 1,
            magicDefense: 1,
            agility: 1,
            luck: 1,
          },
          usableEquipment: ['phantom' as never],
          learnedSkills: [{ level: 0, skillId: 'missing_skill' }],
        },
      ],
      skills: [
        {
          id: 'bad_skill',
          name: 'Bad Skill',
          description: '',
          mpCost: -1,
          power: Number.NaN,
          target: 'everyone' as never,
          element: 'ice',
        },
      ],
      enemies: [
        {
          id: 'bad_enemy',
          name: 'Bad Enemy',
          stats: {
            maxHp: -1,
            maxMp: 0,
            attack: 1,
            defense: 1,
            magicAttack: 1,
            magicDefense: 1,
            agility: 1,
            luck: 1,
          },
          exp: -4,
          gold: -8,
          drops: [{ itemId: 'missing_item', rate: 1.5 }],
        },
      ],
      troops: [{ id: 'bad_troop', name: 'Bad Troop', members: ['missing_enemy'] }],
    });

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Actor "bad_actor" level must be at least 1'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Actor "bad_actor" hp must be a non-negative finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Actor "bad_actor" mp must be a non-negative finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Actor "bad_actor" baseStats.attack must be a non-negative finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Actor "bad_actor" equips unknown item "missing_item" in slot "weapon"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Actor "bad_actor" references unknown skill "missing_skill"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Class "bad_class" growth.defense must be a non-negative finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Class "bad_class" references unknown equipment slot "phantom"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Class "bad_class" learned skill level must be at least 1'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Class "bad_class" references unknown learned skill "missing_skill"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Skill "bad_skill" mpCost must be a non-negative finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Skill "bad_skill" power must be finite'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Skill "bad_skill" has invalid target "everyone"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Skill "bad_skill" references unknown element "ice"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Enemy "bad_enemy" stats.maxHp must be a non-negative finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Enemy "bad_enemy" exp must be a non-negative finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Enemy "bad_enemy" gold must be a non-negative finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Enemy "bad_enemy" drops unknown item "missing_item"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Enemy "bad_enemy" drop rate must be between 0 and 1'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Troop "bad_troop" references unknown enemy "missing_enemy"'))).toBe(true);
  });

  it('rejects invalid quest shop variable and system numeric data', () => {
    const project = projectWith({
      quests: [
        {
          id: 'bad_quest',
          title: 'Bad Quest',
          summary: '',
          objectives: [
            { id: 'step', description: '' },
            { id: 'step', description: '' },
          ],
          rewards: {
            gold: -1,
            exp: -2,
            items: [{ itemId: 'missing_item', amount: 0 }],
          },
        },
      ],
      shops: [
        {
          id: 'bad_shop',
          name: 'Bad Shop',
          listings: [
            { itemId: 'potion', price: -5 },
            { itemId: 'potion', price: 10 },
          ],
        },
      ],
      variables: [{ id: 'bad_variable', name: 'Bad Variable', initial: Number.NaN }],
      animations: {
        sets: [{ id: 'player_adventurer', clips: [] }],
      },
      system: {
        startingParty: ['missing_actor'],
        startingGold: -10,
        playerAnimationSet: 'missing_animation',
        playerMovementSpeed: 'fast' as never,
        defaultCharacterHeightTiles: 0,
      },
    });

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('Quest "bad_quest" has duplicate objective id "step"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Quest "bad_quest" reward gold must be non-negative'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Quest "bad_quest" reward exp must be non-negative'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Quest "bad_quest" rewards item amount must be at least 1'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Quest "bad_quest" rewards unknown item "missing_item"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Shop "bad_shop" listing price must be non-negative'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Shop "bad_shop" lists duplicate item "potion"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Variable "bad_variable" initial value must be finite'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('System startingGold must be non-negative'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('System playerAnimationSet references unknown animation set "missing_animation"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('System startingParty references unknown actor "missing_actor"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('System playerMovementSpeed "fast" is invalid'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('System defaultCharacterHeightTiles must be a positive finite number'))).toBe(true);
  });

  it('rejects invalid animation clip metadata and warns on incomplete player movement clips', () => {
    const project = projectWith({
      animations: {
        sets: [
          {
            id: 'player_adventurer',
            display: { heightTiles: 1.5 },
            clips: [
              {
                action: 'idle',
                direction: 'down',
                asset: 'missing_sheet',
                frameSize: { width: 0, height: Number.NaN },
                frameCount: 0,
                fps: -1,
                loop: true,
                anchor: { x: Number.NaN, y: 54 },
              },
            ],
          },
        ],
      },
      system: { startingParty: [], startingGold: 0, playerAnimationSet: 'player_adventurer' },
    });

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('clip 1 references unknown animation asset "missing_sheet"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('clip 1 frameSize.width must be a positive finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('clip 1 frameSize.height must be a positive finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('clip 1 frameCount must be a positive integer'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('clip 1 fps must be a positive finite number'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('clip 1 anchor.x must be finite'))).toBe(true);
    expect(report.warnings.some(w => w.message.includes('Player animation set "player_adventurer" is missing walk/down'))).toBe(true);
    expect(report.warnings.some(w => w.message.includes('Player animation set "player_adventurer" is missing idle/up'))).toBe(true);
  });

  it('rejects malformed types and missing required terms', () => {
    const project = projectWith({
      types: {
        weaponTypes: [
          { id: 'sword', name: 'Sword' },
          { id: 'sword', name: 'Blade' },
        ],
        armorTypes: [{ id: 'light', name: '' }],
        skillTypes: [{ id: 'magic', name: 'Magic' }],
        elements: [{ id: 'fire', name: 'Fire' }],
        equipmentSlots: [{ id: 'weapon', name: 'Weapon' }],
        itemCategories: [{ id: 'consumable', name: 'Consumable' }],
      },
      terms: {
        currencyUnit: '',
        stats: {
          maxHp: 'Max HP',
          maxMp: 'Max MP',
          attack: '',
          defense: 'Defense',
          magicAttack: 'Magic Attack',
          magicDefense: 'Magic Defense',
          agility: 'Agility',
          luck: 'Luck',
        },
        menu: {
          item: 'Item',
          skill: 'Skill',
          equip: '',
          status: 'Status',
          formation: 'Formation',
          options: 'Options',
          save: 'Save',
          load: 'Load',
        },
        commands: {
          attack: 'Attack',
          guard: 'Guard',
          item: 'Item',
          skill: 'Skill',
          escape: 'Escape',
        },
        battle: {
          fight: 'Fight',
          escape: 'Escape',
          victory: 'Victory',
          defeat: 'Defeat',
          exp: 'EXP',
          levelUp: 'Level Up',
        },
        saveLoad: {
          save: 'Save',
          load: 'Load',
          file: 'File',
          empty: 'Empty',
        },
      },
    });

    const report = validateProject(project);
    expect(report.errors.some(e => e.message.includes('Duplicate weaponTypes id "sword"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('armorTypes entry "light" is missing a name'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('missing required equipment slot "armor"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Terms currencyUnit is required'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Terms stats.attack is required'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Terms menu.equip is required'))).toBe(true);
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

  it('rejects startBattle configured with escape before runtime support exists', () => {
    const project = projectWith({
      enemies: [
        {
          id: 'slime',
          name: 'Slime',
          stats: {
            maxHp: 10,
            maxMp: 0,
            attack: 1,
            defense: 1,
            magicAttack: 0,
            magicDefense: 0,
            agility: 1,
            luck: 1,
          },
          exp: 0,
          gold: 0,
          drops: [],
        },
      ],
      troops: [{ id: 'slime_one', name: 'Slime One', members: ['slime'] }],
    });
    project.maps.town.events.push({
      id: 'evt',
      type: 'object',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [{ type: 'startBattle', troopId: 'slime_one', canEscape: true }],
    });
    const report = validateProject(project);
    expect(
      report.errors.some(e =>
        e.message.includes('startBattle canEscape is not supported by deterministic runtime battles'),
      ),
    ).toBe(true);
  });

  it('validates authored audio registry and audio command references', () => {
    const baseSystem = mergeDatabases(undefined).system;
    const project = projectWith({
      system: {
        ...baseSystem,
        defaultBgm: 'missing_bgm',
        audio: {
          ui_confirm: 'assets/audio/confirm.wav',
          bad_ext: 'assets/audio/effect.ogg',
          unsafe: '../outside.wav',
        },
      },
    });
    project.maps.town.events.push({
      id: 'evt',
      type: 'object',
      x: 0,
      y: 0,
      solid: false,
      trigger: 'interact',
      commands: [{ type: 'playSound', soundId: 'missing_sfx' }],
    });

    const report = validateProject(project);

    expect(report.errors.some(e => e.message.includes('System defaultBgm references unknown audio id "missing_bgm"'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Audio asset "bad_ext" must use a .wav file'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('Audio asset "unsafe" uses unsafe project-relative path'))).toBe(true);
    expect(report.errors.some(e => e.message.includes('playSound references unknown audio id "missing_sfx"'))).toBe(true);
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
