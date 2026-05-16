import { createContext, useContext } from 'react';
import type { Dispatch } from 'react';
import type {
  CommonEventData,
  DatabaseEntries,
  DatabaseListKey,
  EventCommand,
  GameEvent,
  ItemDatabase,
  MapData,
  ProjectData,
  SystemData,
  ValidationMessage,
} from '../types/project';
import type { FullProjectState } from '../adapters/types';
import { mergeDatabases } from '../adapters/defaultDatabases';
import { validateProject } from '../validation/validateProject';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface ProjectStoreState {
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  databases: DatabaseEntries;
  dirty: boolean;
  lastSavedAt: string | null;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type ProjectAction =
  | { type: 'LOAD_PROJECT'; payload: FullProjectState }
  | { type: 'UPDATE_PROJECT_META'; changes: Partial<ProjectData> }
  | {
      type: 'UPDATE_EVENT';
      mapId: string;
      eventId: string;
      changes: Partial<Omit<GameEvent, 'commands'>>;
    }
  | {
      type: 'RENAME_EVENT';
      mapId: string;
      oldId: string;
      newId: string;
    }
  | {
      type: 'UPDATE_COMMAND';
      mapId: string;
      eventId: string;
      path: number[]; // path through nested ifFlag branches
      command: EventCommand;
    }
  | {
      type: 'ADD_COMMAND';
      mapId: string;
      eventId: string;
      command: EventCommand;
    }
  | {
      type: 'REMOVE_COMMAND';
      mapId: string;
      eventId: string;
      path: number[];
    }
  // ---- new database actions ------------------------------------------------
  | {
      type: 'ADD_DATABASE_ENTRY';
      table: DatabaseListKey;
      entry: DatabaseRecord;
    }
  | {
      type: 'UPDATE_DATABASE_ENTRY';
      table: DatabaseListKey;
      id: string;
      changes: Partial<DatabaseRecord>;
    }
  | {
      type: 'REMOVE_DATABASE_ENTRY';
      table: DatabaseListKey;
      id: string;
    }
  | {
      type: 'RENAME_DATABASE_ENTRY';
      table: DatabaseListKey;
      oldId: string;
      newId: string;
    }
  | {
      type: 'UPDATE_SYSTEM_DATA';
      changes: Partial<SystemData>;
    }
  | {
      type: 'UPDATE_COMMON_EVENT_COMMANDS';
      commonEventId: string;
      commands: CommonEventData['commands'];
    }
  | { type: 'MARK_SAVED'; at?: string }
  | { type: 'VALIDATE' };

export type DatabaseRecord = { id: string } & Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function withMap(state: ProjectStoreState, mapId: string, mut: (map: MapData) => void): ProjectStoreState {
  const map = state.maps[mapId];
  if (!map) return state;
  const cloned = deepClone(map);
  mut(cloned);
  return {
    ...state,
    dirty: true,
    maps: { ...state.maps, [mapId]: cloned },
  };
}

function withDatabases(
  state: ProjectStoreState,
  mut: (db: DatabaseEntries) => boolean,
): ProjectStoreState {
  const cloned = deepClone(state.databases);
  const changed = mut(cloned);
  if (!changed) return state;
  return { ...state, dirty: true, databases: cloned };
}

function applyEventChanges(
  event: GameEvent,
  changes: Partial<Omit<GameEvent, 'commands'>>,
): GameEvent {
  return { ...event, ...changes };
}

function setCommandAtPath(commands: EventCommand[], path: number[], replacement: EventCommand): EventCommand[] {
  if (path.length === 0) return commands;
  const result = commands.slice();
  const [head, ...rest] = path;
  if (rest.length === 0) {
    result[head] = replacement;
    return result;
  }
  const target = result[head];
  if (target.type !== 'ifFlag' && target.type !== 'ifSwitch' && target.type !== 'ifVariable') {
    return commands; // path invalid
  }
  const branchIdx = rest[0];
  const branchPath = rest.slice(1);
  const branch = branchIdx === 0 ? target.then : target.else;
  const newBranch = setCommandAtPath(branch, branchPath, replacement);
  result[head] =
    branchIdx === 0
      ? { ...target, then: newBranch }
      : { ...target, else: newBranch };
  return result;
}

function removeCommandAtPath(commands: EventCommand[], path: number[]): EventCommand[] {
  if (path.length === 0) return commands;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const result = commands.slice();
    result.splice(head, 1);
    return result;
  }
  const result = commands.slice();
  const target = result[head];
  if (target.type !== 'ifFlag' && target.type !== 'ifSwitch' && target.type !== 'ifVariable') {
    return commands;
  }
  const branchIdx = rest[0];
  const branchPath = rest.slice(1);
  const branch = branchIdx === 0 ? target.then : target.else;
  const newBranch = removeCommandAtPath(branch, branchPath);
  result[head] =
    branchIdx === 0
      ? { ...target, then: newBranch }
      : { ...target, else: newBranch };
  return result;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export const initialProjectStoreState: ProjectStoreState = {
  project: {
    schemaVersion: 1,
    title: '',
    startMapId: '',
    startPosition: { x: 0, y: 0, direction: 'down' },
    maps: [],
    database: { items: '' },
  },
  maps: {},
  items: { items: [] },
  databases: mergeDatabases(undefined),
  dirty: false,
  lastSavedAt: null,
  errors: [],
  warnings: [],
};

export function projectReducer(state: ProjectStoreState, action: ProjectAction): ProjectStoreState {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      const payload = action.payload;
      const next: ProjectStoreState = {
        ...state,
        project: deepClone(payload.project),
        maps: deepClone(payload.maps),
        items: deepClone(payload.items),
        databases: mergeDatabases(payload.databases as Partial<DatabaseEntries> | undefined),
        dirty: false,
      };
      const fullState: FullProjectState = {
        project: next.project,
        maps: next.maps,
        items: next.items,
        databases: next.databases,
      };
      const report = validateProject(fullState);
      next.errors = report.errors;
      next.warnings = report.warnings;
      return next;
    }

    case 'UPDATE_PROJECT_META':
      return {
        ...state,
        project: { ...state.project, ...action.changes },
        dirty: true,
      };

    case 'UPDATE_EVENT':
      return withMap(state, action.mapId, map => {
        const idx = map.events.findIndex(e => e.id === action.eventId);
        if (idx === -1) return;
        map.events[idx] = applyEventChanges(map.events[idx], action.changes);
      });

    case 'RENAME_EVENT': {
      const map = state.maps[action.mapId];
      if (!map) return state;
      if (map.events.some(e => e.id === action.newId && e.id !== action.oldId)) {
        return state;
      }
      return withMap(state, action.mapId, m => {
        const idx = m.events.findIndex(e => e.id === action.oldId);
        if (idx === -1) return;
        m.events[idx] = { ...m.events[idx], id: action.newId };
      });
    }

    case 'UPDATE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        event.commands = setCommandAtPath(event.commands, action.path, action.command);
      });

    case 'ADD_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        event.commands = [...event.commands, action.command];
      });

    case 'REMOVE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        event.commands = removeCommandAtPath(event.commands, action.path);
      });

    case 'ADD_DATABASE_ENTRY':
      return withDatabases(state, db => {
        const list = db[action.table] as unknown as DatabaseRecord[];
        if (list.some(e => e.id === action.entry.id)) return false;
        list.push(deepClone(action.entry));
        return true;
      });

    case 'UPDATE_DATABASE_ENTRY':
      return withDatabases(state, db => {
        const list = db[action.table] as unknown as DatabaseRecord[];
        const idx = list.findIndex(e => e.id === action.id);
        if (idx === -1) return false;
        list[idx] = { ...list[idx], ...action.changes, id: list[idx].id };
        return true;
      });

    case 'REMOVE_DATABASE_ENTRY':
      return withDatabases(state, db => {
        const list = db[action.table] as unknown as DatabaseRecord[];
        const idx = list.findIndex(e => e.id === action.id);
        if (idx === -1) return false;
        list.splice(idx, 1);
        return true;
      });

    case 'RENAME_DATABASE_ENTRY':
      return withDatabases(state, db => {
        if (action.oldId === action.newId) return false;
        const list = db[action.table] as unknown as DatabaseRecord[];
        if (list.some(e => e.id === action.newId)) return false;
        const target = list.find(e => e.id === action.oldId);
        if (!target) return false;
        target.id = action.newId;
        return true;
      });

    case 'UPDATE_SYSTEM_DATA':
      return withDatabases(state, db => {
        db.system = { ...db.system, ...action.changes };
        return true;
      });

    case 'UPDATE_COMMON_EVENT_COMMANDS':
      return withDatabases(state, db => {
        const target = db.commonEvents.find(e => e.id === action.commonEventId);
        if (!target) return false;
        target.commands = deepClone(action.commands);
        return true;
      });

    case 'MARK_SAVED':
      return {
        ...state,
        dirty: false,
        lastSavedAt: action.at ?? new Date().toISOString(),
      };

    case 'VALIDATE': {
      const report = validateProject({
        project: state.project,
        maps: state.maps,
        items: state.items,
        databases: state.databases,
      });
      return { ...state, errors: report.errors, warnings: report.warnings };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function getEventsByMap(
  state: ProjectStoreState,
): Record<string, { mapName: string; events: GameEvent[] }> {
  const result: Record<string, { mapName: string; events: GameEvent[] }> = {};
  for (const [mapId, map] of Object.entries(state.maps)) {
    result[mapId] = { mapName: map.name, events: map.events };
  }
  return result;
}

export function flattenCommands(
  commands: EventCommand[],
): Array<{ command: EventCommand; depth: number; path: number[] }> {
  const result: Array<{ command: EventCommand; depth: number; path: number[] }> = [];
  function walk(cmds: EventCommand[], depth: number, prefix: number[]) {
    cmds.forEach((cmd, i) => {
      const path = [...prefix, i];
      result.push({ command: cmd, depth, path });
      if (cmd.type === 'ifFlag' || cmd.type === 'ifSwitch' || cmd.type === 'ifVariable') {
        walk(cmd.then, depth + 1, [...path, 0]);
        walk(cmd.else, depth + 1, [...path, 1]);
      } else if (cmd.type === 'showChoices') {
        cmd.choices.forEach((choice, j) => {
          walk(choice.commands, depth + 1, [...path, j]);
        });
      } else if (cmd.type === 'startBattle') {
        if (cmd.victoryBranch) walk(cmd.victoryBranch, depth + 1, [...path, 0]);
        if (cmd.defeatBranch) walk(cmd.defeatBranch, depth + 1, [...path, 1]);
      }
    });
  }
  walk(commands, 0, []);
  return result;
}

// ---------------------------------------------------------------------------
// React context
// ---------------------------------------------------------------------------

export interface ProjectContextValue {
  state: ProjectStoreState;
  dispatch: Dispatch<ProjectAction>;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectStore(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectStore must be used within ProjectContext');
  return ctx;
}

// Backwards-compat helper for components that just want the data.
export function useProject(): ProjectStoreState {
  return useProjectStore().state;
}
