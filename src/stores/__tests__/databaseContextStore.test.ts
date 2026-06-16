import { describe, it, expect } from 'vitest';
import {
  buildDatabaseContext,
  databaseContextReducer,
  DEFAULT_DATABASE_CONTEXT_STATE,
  type DatabaseContextConfig,
  type DatabaseContextAction,
  type DatabaseRecordSummary,
} from '../databaseContextStore';
import type { DatabaseEntries } from '../../types/project';

const baseDatabases = {
  actors: [
    { id: 'hero', name: 'Hero' },
    { id: 'mage', name: 'Mage' },
  ],
  skills: [
    { id: 'fire', name: 'Fire', cost: 5 },
  ],
  classes: [],
  weapons: [],
  armors: [],
  system: {},
} as unknown as DatabaseEntries;

function dispatch(state: ReturnType<typeof databaseContextReducer>, action: DatabaseContextAction) {
  return databaseContextReducer(state, action);
}

describe('databaseContextStore default state', () => {
  it('starts with empty selection and safe defaults', () => {
    expect(DEFAULT_DATABASE_CONTEXT_STATE.selectedTables).toEqual([]);
    expect(DEFAULT_DATABASE_CONTEXT_STATE.selectedRecordIds).toEqual({});
    expect(DEFAULT_DATABASE_CONTEXT_STATE.maxRecordsPerTable).toBe(20);
    expect(DEFAULT_DATABASE_CONTEXT_STATE.maxTotalChars).toBe(8000);
  });
});

describe('databaseContextReducer', () => {
  it('toggleTable adds and removes a table from the selection', () => {
    let s = DEFAULT_DATABASE_CONTEXT_STATE;
    s = dispatch(s, { type: 'toggleTable', table: 'actors' });
    expect(s.selectedTables).toEqual(['actors']);
    s = dispatch(s, { type: 'toggleTable', table: 'actors' });
    expect(s.selectedTables).toEqual([]);
  });

  it('selectRecord adds a record id; deselectRecord removes it', () => {
    let s = dispatch(DEFAULT_DATABASE_CONTEXT_STATE, { type: 'toggleTable', table: 'actors' });
    s = dispatch(s, { type: 'selectRecord', table: 'actors', recordId: 'hero' });
    expect(s.selectedRecordIds.actors).toEqual(['hero']);
    s = dispatch(s, { type: 'deselectRecord', table: 'actors', recordId: 'hero' });
    expect(s.selectedRecordIds.actors).toEqual([]);
  });

  it('deselecting a non-existent record is a no-op', () => {
    const s = dispatch(DEFAULT_DATABASE_CONTEXT_STATE, {
      type: 'deselectRecord',
      table: 'actors',
      recordId: 'missing',
    });
    expect(s.selectedRecordIds).toEqual({});
  });

  it('toggleTable off clears that table selectedRecordIds entry', () => {
    let s = dispatch(DEFAULT_DATABASE_CONTEXT_STATE, { type: 'toggleTable', table: 'actors' });
    s = dispatch(s, { type: 'selectRecord', table: 'actors', recordId: 'hero' });
    s = dispatch(s, { type: 'toggleTable', table: 'actors' });
    expect(s.selectedRecordIds.actors).toBeUndefined();
  });

  it('clearSelection empties tables and record ids', () => {
    let s = dispatch(DEFAULT_DATABASE_CONTEXT_STATE, { type: 'toggleTable', table: 'actors' });
    s = dispatch(s, { type: 'toggleTable', table: 'skills' });
    s = dispatch(s, { type: 'clearSelection' });
    expect(s.selectedTables).toEqual([]);
    expect(s.selectedRecordIds).toEqual({});
  });

  it('reset returns to default state', () => {
    let s = dispatch(DEFAULT_DATABASE_CONTEXT_STATE, { type: 'toggleTable', table: 'actors' });
    s = dispatch(s, { type: 'reset' });
    expect(s).toEqual(DEFAULT_DATABASE_CONTEXT_STATE);
  });
});

describe('buildDatabaseContext', () => {
  it('returns empty payload when no tables are selected', () => {
    const config: DatabaseContextConfig = {
      databases: baseDatabases,
      selectedTables: [],
      selectedRecordIds: {},
    };
    const result = buildDatabaseContext(config);
    expect(result.included).toEqual({});
    expect(result.totalChars).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('includes only the selected tables and bounded record lists', () => {
    const config: DatabaseContextConfig = {
      databases: baseDatabases,
      selectedTables: ['actors', 'skills'],
      selectedRecordIds: { actors: ['hero'] },
      maxRecordsPerTable: 5,
      maxTotalChars: 8000,
    };
    const result = buildDatabaseContext(config);
    expect(Object.keys(result.included).sort()).toEqual(['actors', 'skills']);
    const actors = result.included.actors as DatabaseRecordSummary[];
    expect(actors).toHaveLength(1);
    expect(actors[0].id).toBe('hero');
    const skills = result.included.skills as DatabaseRecordSummary[];
    expect(skills).toHaveLength(1);
  });

  it('truncates record lists exceeding maxRecordsPerTable and flags it', () => {
    const manyActors: DatabaseEntries = {
      ...baseDatabases,
      actors: Array.from({ length: 50 }, (_, i) => ({ id: `a${i}`, name: `A${i}` }) as never),
    };
    const config: DatabaseContextConfig = {
      databases: manyActors,
      selectedTables: ['actors'],
      selectedRecordIds: {},
      maxRecordsPerTable: 10,
      maxTotalChars: 100000,
    };
    const result = buildDatabaseContext(config);
    expect(result.included.actors).toHaveLength(10);
    expect(result.truncated).toBe(true);
    expect(result.omittedRecordCount).toBeGreaterThan(0);
  });

  it('truncates total payload at maxTotalChars and flags it', () => {
    const config: DatabaseContextConfig = {
      databases: baseDatabases,
      selectedTables: ['actors', 'skills'],
      selectedRecordIds: {},
      maxRecordsPerTable: 100,
      maxTotalChars: 50,
    };
    const result = buildDatabaseContext(config);
    expect(result.totalChars).toBeLessThanOrEqual(50);
    expect(result.truncated).toBe(true);
  });

  it('omits record ids not present in the database', () => {
    const config: DatabaseContextConfig = {
      databases: baseDatabases,
      selectedTables: ['actors'],
      selectedRecordIds: { actors: ['hero', 'ghost'] },
      maxRecordsPerTable: 10,
      maxTotalChars: 10000,
    };
    const result = buildDatabaseContext(config);
    expect(result.included.actors).toHaveLength(1);
    expect((result.included.actors as DatabaseRecordSummary[])[0].id).toBe('hero');
  });

  it('reports included and omitted record counts', () => {
    const config: DatabaseContextConfig = {
      databases: baseDatabases,
      selectedTables: ['actors', 'skills'],
      selectedRecordIds: { actors: ['hero'] },
      maxRecordsPerTable: 5,
      maxTotalChars: 8000,
    };
    const result = buildDatabaseContext(config);
    expect(result.includedRecordCount).toBe(2);
    expect(result.omittedRecordCount).toBeGreaterThanOrEqual(1);
  });

  it('skips empty tables without inflating truncated flag', () => {
    const config: DatabaseContextConfig = {
      databases: { ...baseDatabases, classes: [] },
      selectedTables: ['classes', 'skills'],
      selectedRecordIds: {},
      maxRecordsPerTable: 10,
      maxTotalChars: 1000,
    };
    const result = buildDatabaseContext(config);
    expect(result.included.classes).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.included.skills).toHaveLength(1);
  });
});
