import { createContext, useContext } from 'react';
import type { Dispatch } from 'react';
import type {
  EventCommand,
  GameEvent,
  ItemDatabase,
  MapData,
  ProjectData,
  ValidationMessage,
} from '../types/project';
import type { FullProjectState } from '../adapters/types';
import { validateProject } from '../validation/validateProject';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface ProjectStoreState {
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
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
  | { type: 'MARK_SAVED'; at?: string }
  | { type: 'VALIDATE' };

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
  if (target.type !== 'ifFlag') return commands; // path invalid
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
  if (target.type !== 'ifFlag') return commands;
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
  project: { schemaVersion: 1, title: '', startMapId: '', startPosition: { x: 0, y: 0, direction: 'down' }, maps: [], database: { items: '' } },
  maps: {},
  items: { items: [] },
  dirty: false,
  lastSavedAt: null,
  errors: [],
  warnings: [],
};

export function projectReducer(state: ProjectStoreState, action: ProjectAction): ProjectStoreState {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      const next: ProjectStoreState = {
        ...state,
        project: deepClone(action.payload.project),
        maps: deepClone(action.payload.maps),
        items: deepClone(action.payload.items),
        dirty: false,
      };
      const report = validateProject(action.payload);
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
      // Block rename if target id collides with another event in the same map.
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
      if (cmd.type === 'ifFlag') {
        walk(cmd.then, depth + 1, [...path, 0]);
        walk(cmd.else, depth + 1, [...path, 1]);
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
