import { describe, it, expect } from 'vitest';
import { initialProjectStoreState, projectReducer } from '../projectStore';

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
});
