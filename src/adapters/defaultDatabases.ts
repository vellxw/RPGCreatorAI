// Default in-memory shape for every database in a project.
// Used as a fallback when a project is missing a database file or when
// new fields are added to the schema between releases.

import type { DatabaseEntries, DatabaseListKey } from '../types/project';

const TYPE_TABLE_KEYS = [
  'weaponTypes',
  'armorTypes',
  'skillTypes',
  'elements',
  'equipmentSlots',
  'itemCategories',
] as const;

function mergeNamedTypeTables(
  base: DatabaseEntries['types'],
  input: unknown,
): DatabaseEntries['types'] {
  const merged: DatabaseEntries['types'] = {
    weaponTypes: [...base.weaponTypes],
    armorTypes: [...base.armorTypes],
    skillTypes: [...base.skillTypes],
    elements: [...base.elements],
    equipmentSlots: [...base.equipmentSlots],
    itemCategories: [...base.itemCategories],
  };
  if (!input || typeof input !== 'object') return merged;
  for (const key of TYPE_TABLE_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      merged[key] = value as DatabaseEntries['types'][typeof key];
    }
  }
  return merged;
}

function mergeRequiredLabels<T extends object>(base: T, input: unknown): T {
  const merged = { ...base };
  if (!input || typeof input !== 'object') return merged;
  for (const key of Object.keys(base) as Array<keyof T>) {
    const value = (input as Record<string, unknown>)[String(key)];
    if (typeof value === 'string') {
      merged[key] = value as T[keyof T];
    }
  }
  return merged;
}

function mergeTermsDatabase(
  base: DatabaseEntries['terms'],
  input: unknown,
): DatabaseEntries['terms'] {
  if (!input || typeof input !== 'object') {
    return {
      currencyUnit: base.currencyUnit,
      stats: { ...base.stats },
      menu: { ...base.menu },
      commands: { ...base.commands },
      battle: { ...base.battle },
      saveLoad: { ...base.saveLoad },
    };
  }
  const source = input as Partial<DatabaseEntries['terms']>;
  return {
    currencyUnit:
      typeof source.currencyUnit === 'string' ? source.currencyUnit : base.currencyUnit,
    stats: mergeRequiredLabels(base.stats, source.stats),
    menu: mergeRequiredLabels(base.menu, source.menu),
    commands: mergeRequiredLabels(base.commands, source.commands),
    battle: mergeRequiredLabels(base.battle, source.battle),
    saveLoad: mergeRequiredLabels(base.saveLoad, source.saveLoad),
  };
}

export function emptyDatabases(): DatabaseEntries {
  return {
    actors: [],
    classes: [],
    skills: [],
    weapons: [],
    armors: [],
    states: [],
    types: {
      weaponTypes: [],
      armorTypes: [],
      skillTypes: [],
      elements: [],
      equipmentSlots: [
        { id: 'weapon', name: 'Weapon' },
        { id: 'armor', name: 'Armor' },
        { id: 'accessory', name: 'Accessory' },
      ],
      itemCategories: [],
    },
    terms: {
      currencyUnit: 'G',
      stats: {
        maxHp: 'Max HP',
        maxMp: 'Max MP',
        attack: 'Attack',
        defense: 'Defense',
        magicAttack: 'Magic Attack',
        magicDefense: 'Magic Defense',
        agility: 'Agility',
        luck: 'Luck',
      },
      menu: {
        item: 'Item',
        skill: 'Skill',
        equip: 'Equip',
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
    enemies: [],
    troops: [],
    quests: [],
    shops: [],
    switches: [],
    variables: [],
    commonEvents: [],
    animations: {
      sets: [],
    },
    tilesets: {
      tilesets: [],
    },
    system: {
      startingParty: [],
      startingGold: 0,
      playerMovementSpeed: 'double',
      defaultCharacterHeightTiles: 1.5,
    },
  };
}

export const DATABASE_LIST_KEYS: DatabaseListKey[] = [
  'actors',
  'classes',
  'skills',
  'weapons',
  'armors',
  'states',
  'enemies',
  'troops',
  'quests',
  'shops',
  'switches',
  'variables',
  'commonEvents',
];

/**
 * Merge a partial / unknown databases blob with the empty shape so the rest
 * of the editor never has to defend against undefined arrays.
 */
export function mergeDatabases(input: Partial<DatabaseEntries> | undefined): DatabaseEntries {
  const base = emptyDatabases();
  if (!input || typeof input !== 'object') return base;
  const merged: DatabaseEntries = { ...base };
  for (const key of DATABASE_LIST_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
  }
  if (input.system && typeof input.system === 'object') {
    merged.system = {
      startingParty: Array.isArray(input.system.startingParty)
        ? [...input.system.startingParty]
        : base.system.startingParty,
      startingGold:
        typeof input.system.startingGold === 'number' ? input.system.startingGold : base.system.startingGold,
      defaultBgm: input.system.defaultBgm,
      windowTint: input.system.windowTint,
      battleBackground: input.system.battleBackground,
      playerAnimationSet: input.system.playerAnimationSet,
      playerMovementSpeed: input.system.playerMovementSpeed ?? base.system.playerMovementSpeed,
      defaultCharacterHeightTiles:
        typeof input.system.defaultCharacterHeightTiles === 'number'
          ? input.system.defaultCharacterHeightTiles
          : base.system.defaultCharacterHeightTiles,
    };
  }
  if (input.animations && typeof input.animations === 'object') {
    merged.animations = {
      sets: Array.isArray(input.animations.sets) ? [...input.animations.sets] : base.animations.sets,
    };
  }
  if (input.tilesets && typeof input.tilesets === 'object') {
    merged.tilesets = {
      tilesets: Array.isArray(input.tilesets.tilesets)
        ? [...input.tilesets.tilesets]
        : base.tilesets.tilesets,
    };
  }
  merged.types = mergeNamedTypeTables(base.types, input.types);
  merged.terms = mergeTermsDatabase(base.terms, input.terms);
  return merged;
}
