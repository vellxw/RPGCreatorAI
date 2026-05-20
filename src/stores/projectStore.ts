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
  MapReference,
  ProjectData,
  SystemData,
  ValidationMessage,
} from '../types/project';
import type { FullProjectState } from '../adapters/types';
import { mergeDatabases } from '../adapters/defaultDatabases';
import { validateProject } from '../validation/validateProject';
import { withNormalizedVisualProfile } from '../visual/visualProfile';

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
  history: ProjectSnapshot[];
  future: ProjectSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  strokeSnapshot: ProjectSnapshot | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type ProjectAction =
  | { type: 'LOAD_PROJECT'; payload: FullProjectState }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'BEGIN_STROKE' }
  | { type: 'END_STROKE' }
  | { type: 'UPDATE_PROJECT_META'; changes: Partial<ProjectData> }
  | {
      type: 'PAINT_TILE';
      mapId: string;
      layerName: string;
      x: number;
      y: number;
      tile: number;
    }
  | {
      type: 'PAINT_RECT';
      mapId: string;
      layerName: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      tile: number;
    }
  | {
      type: 'FLOOD_FILL';
      mapId: string;
      layerName: string;
      x: number;
      y: number;
      tile: number;
    }
  | {
      type: 'RESIZE_MAP';
      mapId: string;
      width: number;
      height: number;
      visualFillTile: number;
    }
  | {
      type: 'REPLACE_MAP';
      mapId: string;
      map: MapData;
    }
  | {
      type: 'UPDATE_MAP_LAYER_META';
      mapId: string;
      layerName: string;
      changes: Partial<Pick<MapData['layers'][number], 'visible' | 'locked' | 'role'>>;
    }
  | {
      type: 'UPDATE_MAP_PROPERTIES';
      mapId: string;
      changes: Partial<Omit<MapData, 'id' | 'layers' | 'events'>>;
    }
  | {
      type: 'UPDATE_MAP_REFERENCE';
      mapId: string;
      changes: Partial<Omit<MapReference, 'id'>>;
    }
  | {
      type: 'CREATE_MAP';
      mapId: string;
      name: string;
      parentId?: string | null;
      width?: number;
      height?: number;
      tileSize?: number;
    }
  | {
      type: 'DUPLICATE_MAP';
      sourceMapId: string;
      newMapId: string;
      name?: string;
    }
  | {
      type: 'REMOVE_MAP';
      mapId: string;
    }
  | {
      type: 'MOVE_MAP';
      mapId: string;
      parentId?: string | null;
      order: number;
    }
  | {
      type: 'SWAP_MAP_ORDER';
      firstMapId: string;
      secondMapId: string;
    }
  | {
      type: 'ADD_EVENT';
      mapId: string;
      event: GameEvent;
    }
  | {
      type: 'DUPLICATE_EVENT';
      mapId: string;
      eventId: string;
      newId: string;
      x: number;
      y: number;
    }
  | {
      type: 'REMOVE_EVENT';
      mapId: string;
      eventId: string;
    }
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
export interface ProjectSnapshot {
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  databases: DatabaseEntries;
}

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

function findEditableLayer(map: MapData, layerName: string) {
  const layer = map.layers.find(l => l.name === layerName);
  if (!layer || layer.locked) return null;
  return layer;
}

function makeMapPath(mapId: string): string {
  return `data/maps/${mapId}.json`;
}

function nextMapOrder(project: ProjectData, parentId: string | null): number {
  const siblingOrders = project.maps
    .filter(ref => (ref.parentId ?? null) === parentId)
    .map(ref => ref.order ?? 0);
  return siblingOrders.length === 0 ? 0 : Math.max(...siblingOrders) + 1;
}

function wouldCreateMapParentCycle(project: ProjectData, mapId: string, parentId: string | null): boolean {
  let cursor = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === mapId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = project.maps.find(ref => ref.id === cursor)?.parentId ?? null;
  }
  return false;
}

function createAuthoringMap(
  mapId: string,
  name: string,
  width: number,
  height: number,
  tileSize: number,
): MapData {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const count = w * h;
  return {
    schemaVersion: 1,
    id: mapId,
    name,
    displayName: name,
    tilesetId: 'sample-town',
    scrollType: 'none',
    battleback: '',
    encounterSteps: 30,
    encounters: [],
    parallax: {},
    width: w,
    height: h,
    tileSize,
    layers: [
      { name: 'ground', type: 'visual', role: 'ground', visible: true, locked: false, tiles: new Array(count).fill(1) },
      { name: 'decoration', type: 'visual', role: 'decoration', visible: true, locked: false, tiles: new Array(count).fill(0) },
      { name: 'foreground', type: 'visual', role: 'foreground', visible: true, locked: false, tiles: new Array(count).fill(0) },
      { name: 'collision', type: 'collision', role: 'collision', visible: true, locked: false, tiles: new Array(count).fill(0) },
      { name: 'region', type: 'region', role: 'region', visible: true, locked: false, tiles: new Array(count).fill(0) },
    ],
    events: [],
  };
}

function snapshotOf(state: ProjectStoreState): ProjectSnapshot {
  return {
    project: deepClone(state.project),
    maps: deepClone(state.maps),
    items: deepClone(state.items),
    databases: deepClone(state.databases),
  };
}

function withValidation(state: ProjectStoreState): ProjectStoreState {
  const report = validateProject({
    project: state.project,
    maps: state.maps,
    items: state.items,
    databases: state.databases,
  });
  return { ...state, errors: report.errors, warnings: report.warnings };
}

function withHistory(state: ProjectStoreState, next: ProjectStoreState): ProjectStoreState {
  if (next === state) return state;
  const history = [...state.history, snapshotOf(state)].slice(-100);
  return {
    ...next,
    history,
    future: [],
    canUndo: history.length > 0,
    canRedo: false,
  };
}

function restoreSnapshot(
  state: ProjectStoreState,
  snapshot: ProjectSnapshot,
  history: ProjectSnapshot[],
  future: ProjectSnapshot[],
): ProjectStoreState {
  return withValidation({
    ...state,
    project: deepClone(snapshot.project),
    maps: deepClone(snapshot.maps),
    items: deepClone(snapshot.items),
    databases: deepClone(snapshot.databases),
    dirty: true,
    history,
    future,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    strokeSnapshot: null,
  });
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
    visualProfile: undefined,
  },
  maps: {},
  items: { items: [] },
  databases: mergeDatabases(undefined),
  dirty: false,
  lastSavedAt: null,
  errors: [],
  warnings: [],
  history: [],
  future: [],
  canUndo: false,
  canRedo: false,
  strokeSnapshot: null,
};

export function projectReducer(state: ProjectStoreState, action: ProjectAction): ProjectStoreState {
  if (action.type === 'UNDO') {
    if (state.history.length === 0) return state;
    const previous = state.history[state.history.length - 1];
    const history = state.history.slice(0, -1);
    const future = [snapshotOf(state), ...state.future];
    return restoreSnapshot(state, previous, history, future);
  }

  if (action.type === 'REDO') {
    if (state.future.length === 0) return state;
    const [nextSnapshot, ...future] = state.future;
    const history = [...state.history, snapshotOf(state)];
    return restoreSnapshot(state, nextSnapshot, history, future);
  }

  if (action.type === 'BEGIN_STROKE') {
    if (state.strokeSnapshot) return state;
    return { ...state, strokeSnapshot: snapshotOf(state) };
  }

  if (action.type === 'END_STROKE') {
    if (!state.strokeSnapshot) return state;
    const strokeSnapshot = state.strokeSnapshot;
    const strokeChanged = JSON.stringify(strokeSnapshot.maps) !== JSON.stringify(state.maps);
    if (!strokeChanged) {
      return { ...state, strokeSnapshot: null };
    }
    const history = [...state.history, strokeSnapshot].slice(-100);
    return {
      ...state,
      strokeSnapshot: null,
      history,
      future: [],
      canUndo: history.length > 0,
      canRedo: false,
    };
  }

  const shouldTrackHistory =
    !state.strokeSnapshot &&
    !['LOAD_PROJECT', 'MARK_SAVED', 'VALIDATE'].includes(action.type);
  const next = reduceProjectState(state, action);
  return shouldTrackHistory ? withHistory(state, next) : next;
}

function reduceProjectState(state: ProjectStoreState, action: Exclude<ProjectAction, { type: 'UNDO' } | { type: 'REDO' }>): ProjectStoreState {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      const payload = action.payload;
      const next: ProjectStoreState = {
        ...state,
        project: withNormalizedVisualProfile(deepClone(payload.project)),
        maps: deepClone(payload.maps),
        items: deepClone(payload.items),
        databases: mergeDatabases(payload.databases as Partial<DatabaseEntries> | undefined),
        dirty: false,
        history: [],
        future: [],
        canUndo: false,
        canRedo: false,
        strokeSnapshot: null,
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

    case 'PAINT_TILE':
      return withMap(state, action.mapId, map => {
        if (action.x < 0 || action.x >= map.width || action.y < 0 || action.y >= map.height) {
          return;
        }
        const layer = findEditableLayer(map, action.layerName);
        if (!layer) return;
        const index = action.y * map.width + action.x;
        layer.tiles[index] = action.tile;
      });

    case 'PAINT_RECT':
      return withMap(state, action.mapId, map => {
        const layer = findEditableLayer(map, action.layerName);
        if (!layer) return;
        const minX = Math.max(0, Math.min(action.x1, action.x2));
        const maxX = Math.min(map.width - 1, Math.max(action.x1, action.x2));
        const minY = Math.max(0, Math.min(action.y1, action.y2));
        const maxY = Math.min(map.height - 1, Math.max(action.y1, action.y2));
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            layer.tiles[y * map.width + x] = action.tile;
          }
        }
      });

    case 'FLOOD_FILL':
      return withMap(state, action.mapId, map => {
        const layer = findEditableLayer(map, action.layerName);
        if (!layer) return;
        if (action.x < 0 || action.x >= map.width || action.y < 0 || action.y >= map.height) return;
        const startIndex = action.y * map.width + action.x;
        const target = layer.tiles[startIndex];
        if (target === action.tile) return;
        const stack: Array<{ x: number; y: number }> = [{ x: action.x, y: action.y }];
        while (stack.length > 0) {
          const cell = stack.pop();
          if (!cell) continue;
          if (cell.x < 0 || cell.x >= map.width || cell.y < 0 || cell.y >= map.height) continue;
          const index = cell.y * map.width + cell.x;
          if (layer.tiles[index] !== target) continue;
          layer.tiles[index] = action.tile;
          stack.push(
            { x: cell.x + 1, y: cell.y },
            { x: cell.x - 1, y: cell.y },
            { x: cell.x, y: cell.y + 1 },
            { x: cell.x, y: cell.y - 1 },
          );
        }
      });

    case 'RESIZE_MAP':
      return withMap(state, action.mapId, map => {
        const width = Math.max(1, Math.floor(action.width));
        const height = Math.max(1, Math.floor(action.height));
        for (const layer of map.layers) {
          const fill = layer.name === 'ground' ? action.visualFillTile : 0;
          const nextTiles = new Array(width * height).fill(fill);
          const copyWidth = Math.min(map.width, width);
          const copyHeight = Math.min(map.height, height);
          for (let y = 0; y < copyHeight; y += 1) {
            for (let x = 0; x < copyWidth; x += 1) {
              nextTiles[y * width + x] = layer.tiles[y * map.width + x];
            }
          }
          layer.tiles = nextTiles;
        }
        map.width = width;
        map.height = height;
        map.events = map.events.filter(event => event.x < width && event.y < height);
      });

    case 'REPLACE_MAP':
      return withMap(state, action.mapId, map => {
        Object.assign(map, deepClone(action.map));
      });

    case 'UPDATE_MAP_LAYER_META':
      return withMap(state, action.mapId, map => {
        const layer = map.layers.find(l => l.name === action.layerName);
        if (!layer) return;
        Object.assign(layer, deepClone(action.changes));
      });

    case 'UPDATE_MAP_PROPERTIES':
      return withMap(state, action.mapId, map => {
        Object.assign(map, deepClone(action.changes), { id: map.id });
      });

    case 'UPDATE_MAP_REFERENCE': {
      if (!state.project.maps.some(ref => ref.id === action.mapId)) return state;
      return {
        ...state,
        dirty: true,
        project: {
          ...state.project,
          maps: state.project.maps.map(ref =>
            ref.id === action.mapId
              ? {
                  ...ref,
                  ...deepClone(action.changes),
                  id: ref.id,
                  parentId: action.changes.parentId === undefined ? ref.parentId ?? null : action.changes.parentId,
                }
              : ref,
          ),
        },
      };
    }

    case 'CREATE_MAP': {
      const mapId = action.mapId.trim();
      if (!mapId || state.maps[mapId] || state.project.maps.some(ref => ref.id === mapId)) return state;
      const parentId = action.parentId ?? null;
      if (parentId && !state.maps[parentId]) return state;
      const tileSize = action.tileSize ?? state.maps[state.project.startMapId]?.tileSize ?? 32;
      const map = createAuthoringMap(
        mapId,
        action.name.trim() || mapId,
        action.width ?? 20,
        action.height ?? 15,
        tileSize,
      );
      const ref: MapReference = {
        id: mapId,
        path: makeMapPath(mapId),
        parentId,
        order: nextMapOrder(state.project, parentId),
        expanded: true,
      };
      return {
        ...state,
        dirty: true,
        project: { ...state.project, maps: [...state.project.maps, ref] },
        maps: { ...state.maps, [mapId]: map },
      };
    }

    case 'DUPLICATE_MAP': {
      const source = state.maps[action.sourceMapId];
      const newMapId = action.newMapId.trim();
      if (!source || !newMapId || state.maps[newMapId] || state.project.maps.some(ref => ref.id === newMapId)) {
        return state;
      }
      const sourceRef = state.project.maps.find(ref => ref.id === action.sourceMapId);
      const parentId = sourceRef?.parentId ?? null;
      const duplicate: MapData = {
        ...deepClone(source),
        id: newMapId,
        name: action.name?.trim() || `${source.name} Copy`,
      };
      if (duplicate.displayName) {
        duplicate.displayName = action.name?.trim() || `${source.displayName ?? source.name} Copy`;
      }
      const ref: MapReference = {
        id: newMapId,
        path: makeMapPath(newMapId),
        parentId,
        order: nextMapOrder(state.project, parentId),
        expanded: true,
      };
      return {
        ...state,
        dirty: true,
        project: { ...state.project, maps: [...state.project.maps, ref] },
        maps: { ...state.maps, [newMapId]: duplicate },
      };
    }

    case 'REMOVE_MAP': {
      if (state.project.maps.length <= 1) return state;
      if (action.mapId === state.project.startMapId) return state;
      if (!state.maps[action.mapId]) return state;
      const maps = { ...state.maps };
      delete maps[action.mapId];
      return {
        ...state,
        dirty: true,
        maps,
        project: {
          ...state.project,
          maps: state.project.maps
            .filter(ref => ref.id !== action.mapId)
            .map(ref => ({
              ...ref,
              parentId: (ref.parentId ?? null) === action.mapId ? null : ref.parentId ?? null,
            })),
        },
      };
    }

    case 'MOVE_MAP': {
      if (!state.project.maps.some(ref => ref.id === action.mapId)) return state;
      const parentId = action.parentId ?? null;
      if (parentId === action.mapId || (parentId && !state.maps[parentId])) return state;
      if (wouldCreateMapParentCycle(state.project, action.mapId, parentId)) return state;
      return {
        ...state,
        dirty: true,
        project: {
          ...state.project,
          maps: state.project.maps.map(ref =>
            ref.id === action.mapId
              ? { ...ref, parentId, order: Math.max(0, Math.floor(action.order)) }
              : ref,
          ),
        },
      };
    }

    case 'SWAP_MAP_ORDER': {
      const first = state.project.maps.find(ref => ref.id === action.firstMapId);
      const second = state.project.maps.find(ref => ref.id === action.secondMapId);
      if (!first || !second) return state;
      if ((first.parentId ?? null) !== (second.parentId ?? null)) return state;
      return {
        ...state,
        dirty: true,
        project: {
          ...state.project,
          maps: state.project.maps.map(ref => {
            if (ref.id === first.id) return { ...ref, order: second.order ?? 0 };
            if (ref.id === second.id) return { ...ref, order: first.order ?? 0 };
            return ref;
          }),
        },
      };
    }

    case 'ADD_EVENT':
      return withMap(state, action.mapId, map => {
        if (map.events.some(e => e.id === action.event.id)) return;
        map.events.push(deepClone(action.event));
      });

    case 'DUPLICATE_EVENT':
      return withMap(state, action.mapId, map => {
        if (map.events.some(e => e.id === action.newId)) return;
        const source = map.events.find(e => e.id === action.eventId);
        if (!source) return;
        map.events.push({ ...deepClone(source), id: action.newId, x: action.x, y: action.y });
      });

    case 'REMOVE_EVENT':
      return withMap(state, action.mapId, map => {
        const idx = map.events.findIndex(e => e.id === action.eventId);
        if (idx === -1) return;
        map.events.splice(idx, 1);
      });

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
