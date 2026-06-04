import { createContext, useContext } from 'react';
import type { Dispatch } from 'react';
import type {
  AssetCatalogData,
  AssetCatalogEntry,
  CommonEventData,
  AnimationDatabaseData,
  DatabaseEntries,
  DatabaseListKey,
  EventCommand,
  EventPage,
  GameEvent,
  ItemDatabase,
  ItemData,
  MapData,
  MapParallax,
  MapReference,
  MapScrollType,
  ProjectData,
  SystemData,
  TermsDatabaseData,
  TilesetDatabaseData,
  TriggerType,
  TypesDatabaseData,
  ValidationMessage,
  WeaponData,
  ArmorData,
} from '../types/project';
import type { FullProjectState } from '../adapters/types';
import { mergeDatabases } from '../adapters/defaultDatabases';
import { normalizeAssetCatalog } from '../adapters/defaultAssetCatalog';
import { validateProject } from '../validation/validateProject';
import { applyReferenceRepair, renameReferences, type ReferenceRepairAction } from '../validation/referenceIndex';
import { withNormalizedVisualProfile } from '../visual/visualProfile';
import { appendGenerationHistoryRecord, createHistoryRecordForGeneratedAsset } from '../providers/generationHistory';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface ProjectStoreState {
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  databases: DatabaseEntries;
  assets: AssetCatalogData;
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
      type: 'ADD_EVENT_PAGE';
      mapId: string;
      eventId: string;
      page: EventPage;
    }
  | {
      type: 'UPDATE_EVENT_PAGE';
      mapId: string;
      eventId: string;
      pageId: string;
      changes: Partial<EventPage>;
    }
  | {
      type: 'REMOVE_EVENT_PAGE';
      mapId: string;
      eventId: string;
      pageId: string;
    }
  | {
      type: 'REORDER_EVENT_PAGE';
      mapId: string;
      eventId: string;
      pageId: string;
      direction: 'up' | 'down';
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
      type: 'INSERT_COMMAND';
      mapId: string;
      eventId: string;
      path: number[];
      placement: 'before' | 'after' | 'append';
      command: EventCommand;
    }
  | {
      type: 'MOVE_COMMAND';
      mapId: string;
      eventId: string;
      path: number[];
      direction: 'up' | 'down';
    }
  | {
      type: 'DUPLICATE_COMMAND';
      mapId: string;
      eventId: string;
      path: number[];
    }
  | {
      type: 'UPDATE_PAGE_COMMAND';
      mapId: string;
      eventId: string;
      pageId: string;
      path: number[];
      command: EventCommand;
    }
  | {
      type: 'ADD_PAGE_COMMAND';
      mapId: string;
      eventId: string;
      pageId: string;
      command: EventCommand;
    }
  | {
      type: 'INSERT_PAGE_COMMAND';
      mapId: string;
      eventId: string;
      pageId: string;
      path: number[];
      placement: 'before' | 'after' | 'append';
      command: EventCommand;
    }
  | {
      type: 'MOVE_PAGE_COMMAND';
      mapId: string;
      eventId: string;
      pageId: string;
      path: number[];
      direction: 'up' | 'down';
    }
  | {
      type: 'DUPLICATE_PAGE_COMMAND';
      mapId: string;
      eventId: string;
      pageId: string;
      path: number[];
    }
  | {
      type: 'REMOVE_PAGE_COMMAND';
      mapId: string;
      eventId: string;
      pageId: string;
      path: number[];
    }
  | {
      type: 'REMOVE_PAGE_COMMAND_RANGE';
      mapId: string;
      eventId: string;
      pageId: string;
      fromPath: number[];
      toPath: number[];
    }
  | {
      type: 'REMOVE_COMMAND';
      mapId: string;
      eventId: string;
      path: number[];
    }
  | {
      type: 'REMOVE_COMMAND_RANGE';
      mapId: string;
      eventId: string;
      fromPath: number[];
      toPath: number[];
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
      updateReferences?: boolean;
    }
  | {
      type: 'REPAIR_REFERENCE';
      repair: ReferenceRepairAction;
    }
  | {
      type: 'UPDATE_SYSTEM_DATA';
      changes: Partial<SystemData>;
    }
  | {
      type: 'UPDATE_TYPES_DATABASE';
      types: TypesDatabaseData;
    }
  | {
      type: 'UPDATE_TERMS_DATABASE';
      terms: TermsDatabaseData;
    }
  | {
      type: 'UPDATE_ITEM_DATABASE';
      items: ItemDatabase;
    }
  | {
      type: 'UPDATE_TILESET_DATABASE';
      tilesets: TilesetDatabaseData;
    }
  | {
      type: 'UPDATE_ANIMATION_DATABASE';
      animations: AnimationDatabaseData;
    }
  | {
      type: 'UPDATE_COMMON_EVENT_COMMANDS';
      commonEventId: string;
      commands: CommonEventData['commands'];
    }
  | {
      type: 'ADD_ASSET_CATALOG_ENTRY';
      asset: AssetCatalogEntry;
    }
  | {
      type: 'UPDATE_ASSET_CATALOG_METADATA';
      id: string;
      changes: AssetCatalogMetadataChanges;
    }
  | {
      type: 'ADD_GENERATED_MAP';
      map: MapData;
      parentId?: string | null;
    }
  | { type: 'MARK_SAVED'; at?: string }
  | { type: 'VALIDATE' };

export type DatabaseRecord = { id: string } & Record<string, unknown>;
export type AssetCatalogMetadataChanges = Partial<Pick<
  AssetCatalogEntry,
  | 'name'
  | 'source'
  | 'tags'
  | 'provenance'
  | 'runtimeCompatible'
  | 'runtimeNotes'
  | 'notes'
  | 'protected'
  | 'width'
  | 'height'
  | 'frameWidth'
  | 'frameHeight'
  | 'frames'
  | 'durationMs'
>>;

export interface ProjectSnapshot {
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  databases: DatabaseEntries;
  assets: AssetCatalogData;
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
  if (JSON.stringify(cloned) === JSON.stringify(map)) return state;
  return {
    ...state,
    dirty: true,
    maps: { ...state.maps, [mapId]: cloned },
  };
}

function findEditableLayer(map: MapData, layerName: string) {
  const layer = map.layers.find(l => l.name === layerName);
  if (!layer || layer.locked || layer.visible === false) return null;
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

function compareMapReferences(a: MapReference, b: MapReference): number {
  return (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id);
}

function normalizeMapSiblingOrders(refs: MapReference[]): MapReference[] {
  const orders = new Map<string, number>();
  const parentIds = new Set(refs.map(ref => ref.parentId ?? null));

  for (const parentId of parentIds) {
    refs
      .filter(ref => (ref.parentId ?? null) === parentId)
      .sort(compareMapReferences)
      .forEach((ref, index) => orders.set(ref.id, index));
  }

  return refs.map(ref => ({
    ...ref,
    parentId: ref.parentId ?? null,
    order: orders.get(ref.id) ?? ref.order ?? 0,
  }));
}

function moveMapReference(
  refs: MapReference[],
  mapId: string,
  parentId: string | null,
  order: number,
): MapReference[] {
  const target = refs.find(ref => ref.id === mapId);
  if (!target) return refs;

  const oldParentId = target.parentId ?? null;
  const clampedOrder = Math.max(0, Math.floor(order));
  const withoutTarget = refs.filter(ref => ref.id !== mapId);
  const siblingIdsToNormalize = new Set<string>();

  for (const ref of withoutTarget) {
    const refParentId = ref.parentId ?? null;
    if (refParentId === oldParentId || refParentId === parentId) {
      siblingIdsToNormalize.add(ref.id);
    }
  }

  const targetSiblings = withoutTarget
    .filter(ref => (ref.parentId ?? null) === parentId)
    .sort(compareMapReferences);
  targetSiblings.splice(Math.min(clampedOrder, targetSiblings.length), 0, {
    ...target,
    parentId,
  });

  const updates = new Map<string, MapReference>();
  targetSiblings.forEach((ref, index) => {
    updates.set(ref.id, { ...ref, parentId, order: index });
  });

  withoutTarget
    .filter(ref => (ref.parentId ?? null) === oldParentId && oldParentId !== parentId)
    .sort(compareMapReferences)
    .forEach((ref, index) => {
      updates.set(ref.id, { ...ref, parentId: oldParentId, order: index });
    });

  return refs.map(ref => {
    if (updates.has(ref.id)) return updates.get(ref.id)!;
    if (siblingIdsToNormalize.has(ref.id)) return { ...ref, parentId: ref.parentId ?? null };
    return ref;
  });
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
    bgm: '',
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

const VALID_MAP_SCROLL_TYPES: MapScrollType[] = ['none', 'vertical', 'horizontal', 'both'];

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeMapParallax(parallax: MapParallax | undefined): MapParallax {
  return {
    image: typeof parallax?.image === 'string' ? parallax.image.trim() : '',
    loopX: parallax?.loopX === true,
    loopY: parallax?.loopY === true,
    scrollX: finiteNumberOr(parallax?.scrollX, 0),
    scrollY: finiteNumberOr(parallax?.scrollY, 0),
  };
}

function normalizeMapPropertyChanges(
  changes: Partial<Omit<MapData, 'id' | 'layers' | 'events'>>,
): Partial<Omit<MapData, 'id' | 'layers' | 'events'>> {
  const next = deepClone(changes);
  if (next.scrollType !== undefined && !VALID_MAP_SCROLL_TYPES.includes(next.scrollType)) {
    next.scrollType = 'none';
  }
  if (next.encounterSteps !== undefined) {
    next.encounterSteps = Math.max(0, Math.floor(finiteNumberOr(next.encounterSteps, 0)));
  }
  if (next.battleback !== undefined) {
    next.battleback = next.battleback.trim();
  }
  if (next.bgm !== undefined) {
    next.bgm = next.bgm.trim();
  }
  if (next.parallax !== undefined) {
    next.parallax = normalizeMapParallax(next.parallax);
  }
  return next;
}

const MUTABLE_ASSET_TEXT_FIELDS = ['name', 'provenance', 'runtimeNotes', 'notes'] as const;
const MUTABLE_ASSET_NUMBER_FIELDS = ['width', 'height', 'frameWidth', 'frameHeight', 'frames', 'durationMs'] as const;
const MUTABLE_ASSET_BOOLEAN_FIELDS = ['runtimeCompatible', 'protected'] as const;
const VALID_ASSET_SOURCES = new Set(['local', 'generated', 'imported']);

function optionalTrimmedText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function positiveFiniteNumberOrUndefined(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeAssetCatalogMetadataChanges(
  changes: AssetCatalogMetadataChanges,
): AssetCatalogMetadataChanges {
  const out: AssetCatalogMetadataChanges = {};

  for (const key of MUTABLE_ASSET_TEXT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      out[key] = optionalTrimmedText(changes[key]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'source') && VALID_ASSET_SOURCES.has(changes.source ?? '')) {
    out.source = changes.source;
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'tags')) {
    out.tags = Array.from(
      new Set((changes.tags ?? []).map(tag => tag.trim()).filter(Boolean)),
    );
  }

  for (const key of MUTABLE_ASSET_NUMBER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      out[key] = positiveFiniteNumberOrUndefined(changes[key]);
    }
  }

  for (const key of MUTABLE_ASSET_BOOLEAN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      out[key] = changes[key];
    }
  }

  return out;
}

function snapshotOf(state: ProjectStoreState): ProjectSnapshot {
  return {
    project: deepClone(state.project),
    maps: deepClone(state.maps),
    items: deepClone(state.items),
    databases: deepClone(state.databases),
    assets: deepClone(state.assets),
  };
}

function withValidation(state: ProjectStoreState): ProjectStoreState {
  const report = validateProject({
    project: state.project,
    maps: state.maps,
    items: state.items,
    databases: state.databases,
    assets: state.assets,
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
    assets: deepClone(snapshot.assets),
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
  const next = normalizeEventPages({ ...event, ...changes });
  if (changes.trigger && next.pages?.[0]) {
    next.pages[0] = { ...next.pages[0], trigger: changes.trigger };
  }
  if ('sprite' in changes || 'animationSet' in changes || 'displayHeightTiles' in changes || 'solid' in changes) {
    next.pages = (next.pages ?? []).map((page, index) =>
      index === 0
        ? {
            ...page,
            graphic: {
              ...page.graphic,
              sprite: next.sprite,
              animationSet: next.animationSet,
              displayHeightTiles: next.displayHeightTiles,
            },
            priority: next.solid ? 'sameAsCharacters' : page.priority,
          }
        : page,
    );
  }
  return syncLegacyEventProjection(next);
}

function defaultEventPage(event: GameEvent): EventPage {
  return {
    id: 'page_1',
    name: 'Page 1',
    conditions: {},
    graphic: {
      sprite: event.sprite,
      animationSet: event.animationSet,
      displayHeightTiles: event.displayHeightTiles,
    },
    movement: { type: 'fixed', speed: 'normal' },
    options: { walking: true, stepping: false, directionFix: false, through: false },
    priority: event.solid ? 'sameAsCharacters' : 'belowCharacters',
    trigger: event.trigger,
    commands: deepClone(event.commands ?? []),
  };
}

function normalizeEventPage(page: EventPage, index: number): EventPage {
  return {
    id: page.id || `page_${index + 1}`,
    name: page.name ?? `Page ${index + 1}`,
    conditions: page.conditions ?? {},
    graphic: page.graphic ?? {},
    movement: page.movement ?? { type: 'fixed', speed: 'normal' },
    options: page.options ?? { walking: true, stepping: false, directionFix: false, through: false },
    priority: page.priority ?? 'sameAsCharacters',
    trigger: page.trigger ?? 'interact',
    commands: page.commands ?? [],
  };
}

function normalizeEventPages(event: GameEvent): GameEvent {
  const pages = event.pages && event.pages.length > 0 ? event.pages : [defaultEventPage(event)];
  return {
    ...event,
    pages: pages.map((page, index) => normalizeEventPage(deepClone(page), index)),
  };
}

function syncLegacyEventProjection(event: GameEvent): GameEvent {
  const normalized = normalizeEventPages(event);
  const first = normalized.pages?.[0];
  if (!first) return normalized;
  return {
    ...normalized,
    trigger: first.trigger as TriggerType,
    commands: deepClone(first.commands),
    sprite: first.graphic.sprite ?? normalized.sprite,
    animationSet: first.graphic.animationSet ?? normalized.animationSet,
    displayHeightTiles: first.graphic.displayHeightTiles ?? normalized.displayHeightTiles,
    solid: first.priority === 'sameAsCharacters' ? true : first.priority === 'belowCharacters' ? false : normalized.solid,
  };
}

function normalizeMapsForEditing(maps: Record<string, MapData>): Record<string, MapData> {
  const cloned = deepClone(maps);
  for (const map of Object.values(cloned)) {
    map.events = map.events.map(event => syncLegacyEventProjection(event));
  }
  return cloned;
}

function migrateEquipmentDatabases(items: ItemDatabase, databases: DatabaseEntries): DatabaseEntries {
  const next = deepClone(databases);
  if (next.weapons.length === 0) {
    next.weapons = items.items
      .filter(item => item.type === 'weapon')
      .map(itemToWeapon);
  }
  if (next.armors.length === 0) {
    next.armors = items.items
      .filter(item => item.type === 'armor')
      .map(itemToArmor);
  }
  return next;
}

function itemToWeapon(item: ItemData): WeaponData {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    weaponTypeId: item.slot === 'weapon' ? 'sword' : 'weapon',
    price: item.price ?? 0,
    params: item.modifiers ?? {},
    animationId: '',
    traits: [],
  };
}

function itemToArmor(item: ItemData): ArmorData {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    armorTypeId: item.slot === 'accessory' ? 'accessory' : 'light',
    slot: item.slot === 'accessory' ? 'accessory' : 'body',
    price: item.price ?? 0,
    params: item.modifiers ?? {},
    traits: [],
  };
}

function pageIndex(event: GameEvent, pageId: string): number {
  const pages = event.pages ?? [];
  return pages.findIndex(page => page.id === pageId);
}

function replacePage(event: GameEvent, pageId: string, mut: (page: EventPage) => EventPage): GameEvent {
  const normalized = normalizeEventPages(event);
  const index = pageIndex(normalized, pageId);
  if (index === -1 || !normalized.pages) return normalized;
  normalized.pages[index] = mut(normalized.pages[index]);
  return index === 0 ? syncLegacyEventProjection(normalized) : normalized;
}

function commandBranch(target: EventCommand, branchIdx: number): EventCommand[] | null {
  if (target.type === 'ifFlag' || target.type === 'ifSwitch' || target.type === 'ifSelfSwitch' || target.type === 'ifVariable') {
    return branchIdx === 0 ? target.then : target.else;
  }
  if (target.type === 'showChoices') {
    return target.choices[branchIdx]?.commands ?? null;
  }
  if (target.type === 'startBattle') {
    return branchIdx === 0 ? target.victoryBranch ?? [] : target.defeatBranch ?? [];
  }
  return null;
}

function withCommandBranch(target: EventCommand, branchIdx: number, branch: EventCommand[]): EventCommand {
  if (target.type === 'ifFlag' || target.type === 'ifSwitch' || target.type === 'ifSelfSwitch' || target.type === 'ifVariable') {
    return branchIdx === 0 ? { ...target, then: branch } : { ...target, else: branch };
  }
  if (target.type === 'showChoices') {
    return {
      ...target,
      choices: target.choices.map((choice, index) => index === branchIdx ? { ...choice, commands: branch } : choice),
    };
  }
  if (target.type === 'startBattle') {
    return branchIdx === 0 ? { ...target, victoryBranch: branch } : { ...target, defeatBranch: branch };
  }
  return target;
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
  if (!target) return commands;
  const branchIdx = rest[0];
  const branch = commandBranch(target, branchIdx);
  if (!branch) {
    return commands; // path invalid
  }
  const branchPath = rest.slice(1);
  const newBranch = setCommandAtPath(branch, branchPath, replacement);
  result[head] = withCommandBranch(target, branchIdx, newBranch);
  return result;
}

function getCommandAtPath(commands: EventCommand[], path: number[]): EventCommand | null {
  if (path.length === 0) return null;
  const [head, ...rest] = path;
  const target = commands[head];
  if (!target) return null;
  if (rest.length === 0) return target;
  const branchIdx = rest[0];
  const branch = commandBranch(target, branchIdx);
  return branch ? getCommandAtPath(branch, rest.slice(1)) : null;
}

function insertCommandAtPath(
  commands: EventCommand[],
  path: number[],
  command: EventCommand,
  placement: 'before' | 'after' | 'append',
): EventCommand[] {
  const inserted = deepClone(command);
  if (path.length === 0) {
    return [...commands, inserted];
  }

  const [head, ...rest] = path;
  if (rest.length === 0) {
    const result = commands.slice();
    const insertAt = placement === 'before'
      ? Math.max(0, head)
      : Math.min(commands.length, head + 1);
    result.splice(insertAt, 0, inserted);
    return result;
  }

  const result = commands.slice();
  const target = result[head];
  if (!target) return commands;
  const branchIdx = rest[0];
  const branch = commandBranch(target, branchIdx);
  if (!branch) return commands;
  const branchPath = rest.slice(1);
  const newBranch = branchPath.length === 0
    ? [...branch, inserted]
    : insertCommandAtPath(branch, branchPath, inserted, placement);
  result[head] = withCommandBranch(target, branchIdx, newBranch);
  return result;
}

function moveCommandAtPath(
  commands: EventCommand[],
  path: number[],
  direction: 'up' | 'down',
): EventCommand[] {
  if (path.length === 0) return commands;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const targetIndex = direction === 'up' ? head - 1 : head + 1;
    if (head < 0 || head >= commands.length || targetIndex < 0 || targetIndex >= commands.length) {
      return commands;
    }
    const result = commands.slice();
    [result[head], result[targetIndex]] = [result[targetIndex], result[head]];
    return result;
  }

  const result = commands.slice();
  const target = result[head];
  if (!target) return commands;
  const branchIdx = rest[0];
  const branch = commandBranch(target, branchIdx);
  if (!branch) return commands;
  const newBranch = moveCommandAtPath(branch, rest.slice(1), direction);
  result[head] = withCommandBranch(target, branchIdx, newBranch);
  return result;
}

function duplicateCommandAtPath(commands: EventCommand[], path: number[]): EventCommand[] {
  const command = getCommandAtPath(commands, path);
  return command
    ? insertCommandAtPath(commands, path, deepClone(command), 'after')
    : commands;
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
  if (!target) return commands;
  const branchIdx = rest[0];
  const branch = commandBranch(target, branchIdx);
  if (!branch) {
    return commands;
  }
  const branchPath = rest.slice(1);
  const newBranch = removeCommandAtPath(branch, branchPath);
  result[head] = withCommandBranch(target, branchIdx, newBranch);
  return result;
}

function sameNumberPath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function removeCommandRangeAtPath(commands: EventCommand[], fromPath: number[], toPath: number[]): EventCommand[] {
  if (fromPath.length === 0 || toPath.length === 0) return commands;
  const fromParent = fromPath.slice(0, -1);
  const toParent = toPath.slice(0, -1);
  if (!sameNumberPath(fromParent, toParent)) return commands;
  return removeCommandRangeFromList(commands, fromParent, fromPath[fromPath.length - 1], toPath[toPath.length - 1]);
}

function removeCommandRangeFromList(
  commands: EventCommand[],
  listPath: number[],
  fromIndex: number,
  toIndex: number,
): EventCommand[] {
  if (listPath.length === 0) {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= commands.length ||
      toIndex >= commands.length
    ) {
      return commands;
    }
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const result = commands.slice();
    result.splice(start, end - start + 1);
    return result;
  }

  if (listPath.length < 2) return commands;
  const [head, branchIdx, ...rest] = listPath;
  const target = commands[head];
  if (!target) return commands;
  const branch = commandBranch(target, branchIdx);
  if (!branch) return commands;
  const newBranch = removeCommandRangeFromList(branch, rest, fromIndex, toIndex);
  const result = commands.slice();
  result[head] = withCommandBranch(target, branchIdx, newBranch);
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
  assets: { schemaVersion: 1, assets: [] },
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
        maps: normalizeMapsForEditing(payload.maps),
        items: deepClone(payload.items),
        databases: migrateEquipmentDatabases(
          payload.items,
          mergeDatabases(payload.databases as Partial<DatabaseEntries> | undefined),
        ),
        assets: normalizeAssetCatalog(payload.assets),
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
        assets: next.assets,
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
        Object.assign(map, normalizeMapPropertyChanges(action.changes), { id: map.id });
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

    case 'ADD_GENERATED_MAP': {
      const map = action.map;
      const mapId = map.id.trim();
      if (!mapId || state.maps[mapId] || state.project.maps.some(ref => ref.id === mapId)) return state;
      const parentId = action.parentId ?? null;
      if (parentId && !state.maps[parentId]) return state;
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
        maps: { ...state.maps, [mapId]: deepClone(map) },
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
      const remainingRefs = state.project.maps.filter(ref => ref.id !== action.mapId);
      const existingRootOrders = remainingRefs
        .filter(ref => (ref.parentId ?? null) !== action.mapId && (ref.parentId ?? null) === null)
        .map(ref => ref.order ?? 0);
      const reparentedRootStart = existingRootOrders.length === 0 ? 0 : Math.max(...existingRootOrders) + 1;
      const reparentedOrders = new Map<string, number>();
      remainingRefs
        .filter(ref => (ref.parentId ?? null) === action.mapId)
        .sort(compareMapReferences)
        .forEach((ref, index) => reparentedOrders.set(ref.id, reparentedRootStart + index));
      const nextRefs = normalizeMapSiblingOrders(
        remainingRefs.map(ref => {
          const wasChild = (ref.parentId ?? null) === action.mapId;
          return {
            ...ref,
            parentId: wasChild ? null : ref.parentId ?? null,
            order: wasChild ? reparentedOrders.get(ref.id) ?? ref.order : ref.order,
          };
        }),
      );
      return {
        ...state,
        dirty: true,
        maps,
        project: {
          ...state.project,
          maps: nextRefs,
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
          maps: moveMapReference(state.project.maps, action.mapId, parentId, action.order),
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
        map.events.push(syncLegacyEventProjection(deepClone(action.event)));
      });

    case 'DUPLICATE_EVENT':
      return withMap(state, action.mapId, map => {
        if (map.events.some(e => e.id === action.newId)) return;
        const source = map.events.find(e => e.id === action.eventId);
        if (!source) return;
        map.events.push(syncLegacyEventProjection({ ...deepClone(source), id: action.newId, x: action.x, y: action.y }));
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

    case 'ADD_EVENT_PAGE':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        const normalized = normalizeEventPages(event);
        if (normalized.pages?.some(page => page.id === action.page.id)) return;
        normalized.pages = [...(normalized.pages ?? []), normalizeEventPage(deepClone(action.page), normalized.pages?.length ?? 0)];
        Object.assign(event, normalized);
      });

    case 'UPDATE_EVENT_PAGE':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        Object.assign(event, replacePage(event, action.pageId, page => normalizeEventPage({ ...page, ...deepClone(action.changes) }, 0)));
      });

    case 'REMOVE_EVENT_PAGE':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        const normalized = normalizeEventPages(event);
        if (!normalized.pages || normalized.pages.length <= 1) return;
        normalized.pages = normalized.pages.filter(page => page.id !== action.pageId);
        Object.assign(event, syncLegacyEventProjection(normalized));
      });

    case 'REORDER_EVENT_PAGE':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        const normalized = normalizeEventPages(event);
        const pages = normalized.pages ?? [];
        const index = pages.findIndex(page => page.id === action.pageId);
        const nextIndex = action.direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || nextIndex < 0 || nextIndex >= pages.length) return;
        [pages[index], pages[nextIndex]] = [pages[nextIndex], pages[index]];
        normalized.pages = pages;
        Object.assign(event, syncLegacyEventProjection(normalized));
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
        Object.assign(event, replacePage(event, 'page_1', page => ({ ...page, commands: event.commands })));
      });

    case 'ADD_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        event.commands = [...event.commands, action.command];
        Object.assign(event, replacePage(event, 'page_1', page => ({ ...page, commands: event.commands })));
      });

    case 'INSERT_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        event.commands = insertCommandAtPath(event.commands, action.path, action.command, action.placement);
        Object.assign(event, replacePage(event, 'page_1', page => ({ ...page, commands: event.commands })));
      });

    case 'MOVE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        event.commands = moveCommandAtPath(event.commands, action.path, action.direction);
        Object.assign(event, replacePage(event, 'page_1', page => ({ ...page, commands: event.commands })));
      });

    case 'DUPLICATE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        event.commands = duplicateCommandAtPath(event.commands, action.path);
        Object.assign(event, replacePage(event, 'page_1', page => ({ ...page, commands: event.commands })));
      });

    case 'REMOVE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        event.commands = removeCommandAtPath(event.commands, action.path);
        Object.assign(event, replacePage(event, 'page_1', page => ({ ...page, commands: event.commands })));
      });

    case 'REMOVE_COMMAND_RANGE':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        event.commands = removeCommandRangeAtPath(event.commands, action.fromPath, action.toPath);
        Object.assign(event, replacePage(event, 'page_1', page => ({ ...page, commands: event.commands })));
      });

    case 'UPDATE_PAGE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        Object.assign(event, replacePage(event, action.pageId, page => ({
          ...page,
          commands: setCommandAtPath(page.commands, action.path, action.command),
        })));
      });

    case 'ADD_PAGE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        Object.assign(event, replacePage(event, action.pageId, page => ({
          ...page,
          commands: [...page.commands, action.command],
        })));
      });

    case 'INSERT_PAGE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        Object.assign(event, replacePage(event, action.pageId, page => ({
          ...page,
          commands: insertCommandAtPath(page.commands, action.path, action.command, action.placement),
        })));
      });

    case 'MOVE_PAGE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        Object.assign(event, replacePage(event, action.pageId, page => ({
          ...page,
          commands: moveCommandAtPath(page.commands, action.path, action.direction),
        })));
      });

    case 'DUPLICATE_PAGE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        Object.assign(event, replacePage(event, action.pageId, page => ({
          ...page,
          commands: duplicateCommandAtPath(page.commands, action.path),
        })));
      });

    case 'REMOVE_PAGE_COMMAND':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        Object.assign(event, replacePage(event, action.pageId, page => ({
          ...page,
          commands: removeCommandAtPath(page.commands, action.path),
        })));
      });

    case 'REMOVE_PAGE_COMMAND_RANGE':
      return withMap(state, action.mapId, map => {
        const event = map.events.find(e => e.id === action.eventId);
        if (!event) return;
        Object.assign(event, replacePage(event, action.pageId, page => ({
          ...page,
          commands: removeCommandRangeAtPath(page.commands, action.fromPath, action.toPath),
        })));
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

    case 'RENAME_DATABASE_ENTRY': {
      if (action.oldId === action.newId) return state;
      const next: ProjectStoreState = {
        ...state,
        dirty: true,
        project: deepClone(state.project),
        maps: deepClone(state.maps),
        items: deepClone(state.items),
        databases: deepClone(state.databases),
      };
      const list = next.databases[action.table] as unknown as DatabaseRecord[];
      if (list.some(e => e.id === action.newId)) return state;
      const target = list.find(e => e.id === action.oldId);
      if (!target) return state;
      target.id = action.newId;
      if (action.updateReferences) {
        renameReferences(next, action.table, action.oldId, action.newId);
      }
      return next;
    }

    case 'REPAIR_REFERENCE': {
      const next: ProjectStoreState = {
        ...state,
        dirty: true,
        project: deepClone(state.project),
        maps: deepClone(state.maps),
        items: deepClone(state.items),
        databases: deepClone(state.databases),
      };
      const changed = applyReferenceRepair(next, action.repair);
      if (!changed) return state;
      return withValidation(next);
    }

    case 'UPDATE_SYSTEM_DATA':
      return withDatabases(state, db => {
        db.system = { ...db.system, ...action.changes };
        return true;
      });

    case 'UPDATE_TYPES_DATABASE':
      return withDatabases(state, db => {
        db.types = deepClone(action.types);
        return true;
      });

    case 'UPDATE_TERMS_DATABASE':
      return withDatabases(state, db => {
        db.terms = deepClone(action.terms);
        return true;
      });

    case 'UPDATE_ITEM_DATABASE':
      return {
        ...state,
        dirty: true,
        items: deepClone(action.items),
      };

    case 'UPDATE_TILESET_DATABASE':
      return withDatabases(state, db => {
        db.tilesets = deepClone(action.tilesets);
        return true;
      });

    case 'UPDATE_ANIMATION_DATABASE':
      return withDatabases(state, db => {
        db.animations = deepClone(action.animations);
        return true;
      });

    case 'UPDATE_COMMON_EVENT_COMMANDS':
      return withDatabases(state, db => {
        const target = db.commonEvents.find(e => e.id === action.commonEventId);
        if (!target) return false;
        target.commands = deepClone(action.commands);
        return true;
      });

    case 'ADD_ASSET_CATALOG_ENTRY': {
      const assetId = action.asset.id.trim();
      if (!assetId || state.assets.assets.some(asset => asset.id === assetId)) return state;
      const asset = deepClone({ ...action.asset, id: assetId });
      const historyRecord = createHistoryRecordForGeneratedAsset(asset);
      return {
        ...state,
        dirty: true,
        project: historyRecord
          ? appendGenerationHistoryRecord(state.project, historyRecord)
          : state.project,
        assets: {
          ...state.assets,
          assets: [...state.assets.assets, asset],
        },
      };
    }

    case 'UPDATE_ASSET_CATALOG_METADATA': {
      const assetId = action.id.trim();
      const assetIndex = state.assets.assets.findIndex(asset => asset.id === assetId);
      if (!assetId || assetIndex < 0) return state;

      const patch = normalizeAssetCatalogMetadataChanges(action.changes);
      const current = state.assets.assets[assetIndex];
      const nextAsset: AssetCatalogEntry = { ...current, ...patch };

      for (const key of Object.keys(patch) as Array<keyof AssetCatalogMetadataChanges>) {
        if (patch[key] === undefined) {
          delete nextAsset[key];
        }
      }

      if (JSON.stringify(nextAsset) === JSON.stringify(current)) return state;

      return {
        ...state,
        dirty: true,
        assets: {
          ...state.assets,
          assets: state.assets.assets.map(asset => (asset.id === assetId ? nextAsset : asset)),
        },
      };
    }

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
        assets: state.assets,
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
      if (cmd.type === 'ifFlag' || cmd.type === 'ifSwitch' || cmd.type === 'ifSelfSwitch' || cmd.type === 'ifVariable') {
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
