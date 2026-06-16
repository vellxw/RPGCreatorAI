import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { DatabaseEntries } from '../types/project';

export type DatabaseTableKey = keyof DatabaseEntries;

export interface DatabaseRecordSummary {
  id: string;
  [key: string]: unknown;
}

export interface DatabaseContextConfig {
  databases: DatabaseEntries;
  selectedTables: DatabaseTableKey[];
  selectedRecordIds: Partial<Record<DatabaseTableKey, string[]>>;
  maxRecordsPerTable?: number;
  maxTotalChars?: number;
}

export interface BuiltDatabaseContext {
  included: Partial<Record<DatabaseTableKey, DatabaseRecordSummary[]>>;
  totalChars: number;
  truncated: boolean;
  includedRecordCount: number;
  omittedRecordCount: number;
}

export interface DatabaseContextState {
  selectedTables: DatabaseTableKey[];
  selectedRecordIds: Partial<Record<DatabaseTableKey, string[]>>;
  maxRecordsPerTable: number;
  maxTotalChars: number;
}

export type DatabaseContextAction =
  | { type: 'toggleTable'; table: DatabaseTableKey }
  | { type: 'selectRecord'; table: DatabaseTableKey; recordId: string }
  | { type: 'deselectRecord'; table: DatabaseTableKey; recordId: string }
  | { type: 'clearSelection' }
  | { type: 'reset' };

const DEFAULT_MAX_RECORDS = 20;
const DEFAULT_MAX_CHARS = 8000;
export const DEFAULT_DATABASE_CONTEXT_STATE: DatabaseContextState = {
  selectedTables: [],
  selectedRecordIds: {},
  maxRecordsPerTable: DEFAULT_MAX_RECORDS,
  maxTotalChars: DEFAULT_MAX_CHARS,
};

export function databaseContextReducer(
  state: DatabaseContextState,
  action: DatabaseContextAction,
): DatabaseContextState {
  switch (action.type) {
    case 'toggleTable': {
      const has = state.selectedTables.includes(action.table);
      if (has) {
        const next = { ...state.selectedRecordIds };
        delete next[action.table];
        return {
          ...state,
          selectedTables: state.selectedTables.filter((t) => t !== action.table),
          selectedRecordIds: next,
        };
      }
      return { ...state, selectedTables: [...state.selectedTables, action.table] };
    }
    case 'selectRecord': {
      const current = state.selectedRecordIds[action.table] ?? [];
      if (current.includes(action.recordId)) return state;
      return {
        ...state,
        selectedRecordIds: {
          ...state.selectedRecordIds,
          [action.table]: [...current, action.recordId],
        },
      };
    }
    case 'deselectRecord': {
      const current = state.selectedRecordIds[action.table] ?? [];
      if (!current.includes(action.recordId)) return state;
      return {
        ...state,
        selectedRecordIds: {
          ...state.selectedRecordIds,
          [action.table]: current.filter((id) => id !== action.recordId),
        },
      };
    }
    case 'clearSelection':
      return { ...state, selectedTables: [], selectedRecordIds: {} };
    case 'reset':
      return DEFAULT_DATABASE_CONTEXT_STATE;
    default:
      return state;
  }
}

export interface DatabaseContextStore extends DatabaseContextState {
  toggleTable: (table: DatabaseTableKey) => void;
  selectRecord: (table: DatabaseTableKey, recordId: string) => void;
  deselectRecord: (table: DatabaseTableKey, recordId: string) => void;
  clearSelection: () => void;
  reset: () => void;
}

const DatabaseContextStoreContext = createContext<DatabaseContextStore | null>(null);

export function DatabaseContextStoreProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: Partial<DatabaseContextState>;
}) {
  const [state, dispatch] = useReducer(
    databaseContextReducer,
    { ...DEFAULT_DATABASE_CONTEXT_STATE, ...initialState },
  );
  const store = useMemo<DatabaseContextStore>(
    () => ({
      ...state,
      toggleTable: (table) => dispatch({ type: 'toggleTable', table }),
      selectRecord: (table, recordId) =>
        dispatch({ type: 'selectRecord', table, recordId }),
      deselectRecord: (table, recordId) =>
        dispatch({ type: 'deselectRecord', table, recordId }),
      clearSelection: () => dispatch({ type: 'clearSelection' }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [state],
  );
  return (
    <DatabaseContextStoreContext.Provider value={store}>
      {children}
    </DatabaseContextStoreContext.Provider>
  );
}

export function useDatabaseContextStore(): DatabaseContextStore {
  const store = useContext(DatabaseContextStoreContext);
  if (!store) {
    throw new Error('useDatabaseContextStore must be used within a DatabaseContextStoreProvider');
  }
  return store;
}

function summarizeRecord(table: DatabaseTableKey, record: unknown): DatabaseRecordSummary {
  if (record && typeof record === 'object') {
    const idField = (record as { id?: unknown }).id;
    const id = typeof idField === 'string' || typeof idField === 'number' ? String(idField) : '';
    return { id, ...(record as Record<string, unknown>) } as DatabaseRecordSummary;
  }
  return { id: `${String(table)}-unknown`, value: String(record) };
}

export function buildDatabaseContext(config: DatabaseContextConfig): BuiltDatabaseContext {
  const maxRecords = config.maxRecordsPerTable ?? DEFAULT_MAX_RECORDS;
  const maxChars = config.maxTotalChars ?? DEFAULT_MAX_CHARS;
  const included: Partial<Record<DatabaseTableKey, DatabaseRecordSummary[]>> = {};
  let totalChars = 0;
  let truncated = false;
  let includedCount = 0;
  let omittedCount = 0;

  for (const table of config.selectedTables) {
    const tableData = config.databases[table];
    if (!tableData) continue;

    const allIds = (Array.isArray(tableData)
      ? tableData.map((r) => String((r as { id?: unknown }).id ?? ''))
      : []);

    const explicitIds = config.selectedRecordIds[table];
    let chosenIds: string[];
    if (explicitIds && explicitIds.length > 0) {
      chosenIds = explicitIds.filter((id) => allIds.includes(id));
      omittedCount += allIds.length - chosenIds.length;
    } else {
      chosenIds = allIds;
    }

    if (chosenIds.length > maxRecords) {
      omittedCount += chosenIds.length - maxRecords;
      chosenIds = chosenIds.slice(0, maxRecords);
      truncated = true;
    }

    const recordsById = new Map(
      (Array.isArray(tableData) ? tableData : []).map((r) => [
        String((r as { id?: unknown }).id ?? ''),
        r,
      ]),
    );
    const records: DatabaseRecordSummary[] = chosenIds
      .map((id) => summarizeRecord(table, recordsById.get(id)))
      .filter((r) => r.id !== '');

    const serialized = JSON.stringify({ [table]: records });
    if (totalChars + serialized.length > maxChars) {
      truncated = true;
      omittedCount += records.length;
      continue;
    }

    included[table] = records;
    includedCount += records.length;
    totalChars += serialized.length;
  }

  return {
    included,
    totalChars,
    truncated,
    includedRecordCount: includedCount,
    omittedRecordCount: omittedCount,
  };
}
