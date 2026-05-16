// Default in-memory shape for every database in a project.
// Used as a fallback when a project is missing a database file or when
// new fields are added to the schema between releases.

import type { DatabaseEntries, DatabaseListKey } from '../types/project';

export function emptyDatabases(): DatabaseEntries {
  return {
    actors: [],
    classes: [],
    skills: [],
    enemies: [],
    troops: [],
    quests: [],
    shops: [],
    switches: [],
    variables: [],
    commonEvents: [],
    system: {
      startingParty: [],
      startingGold: 0,
    },
  };
}

export const DATABASE_LIST_KEYS: DatabaseListKey[] = [
  'actors',
  'classes',
  'skills',
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
    };
  }
  return merged;
}
