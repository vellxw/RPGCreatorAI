import type {
  Direction,
  EventCommand,
  GameEvent,
  MapData,
  MapLayer,
} from '../types/project';
import type { GameBundleV1, RuntimeStartOverride } from '../runtime-core/contracts';

export const MAP_STUDIO_DOCUMENT_SCHEMA_VERSION = 1 as const;

export type MapStudioSpawnKind = 'player' | 'checkpoint' | 'event';

/** Editor-only named entry point. The selected spawn compiles to a RuntimeStartOverride. */
export interface MapStudioSpawnV1 {
  id: string;
  kind: MapStudioSpawnKind;
  x: number;
  y: number;
  direction: Direction;
  eventId?: string;
}

/** Rectangular authoring surface compiled to ordinary GameBundle events. */
export interface MapStudioHotspotV1 {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  trigger: 'interact' | 'touch';
  commands: EventCommand[];
  solid?: boolean;
}

/**
 * Canonical Map Studio authoring contract. `map` deliberately remains a
 * GameBundle MapData value, while spawns and rectangular hotspots are editor
 * conveniences compiled before packaging.
 */
export interface MapStudioDocumentV1 {
  schemaVersion: typeof MAP_STUDIO_DOCUMENT_SCHEMA_VERSION;
  map: MapData;
  spawns: MapStudioSpawnV1[];
  hotspots: MapStudioHotspotV1[];
}

export type MapStudioDocument = MapStudioDocumentV1;

export type MapStudioIssueSeverity = 'error' | 'warning';

export type MapStudioIssueCode =
  | 'invalid-schema'
  | 'invalid-identifier'
  | 'invalid-dimension'
  | 'duplicate-id'
  | 'duplicate-layer-role'
  | 'missing-layer-role'
  | 'invalid-layer-role'
  | 'invalid-layer-size'
  | 'invalid-layer-tile'
  | 'out-of-bounds'
  | 'blocked-spawn'
  | 'unknown-event'
  | 'event-id-conflict'
  | 'overlapping-hotspot';

export interface MapStudioValidationIssue {
  severity: MapStudioIssueSeverity;
  code: MapStudioIssueCode;
  path: string;
  message: string;
}

export interface CompiledMapStudioDocument {
  map: MapData;
  startOverrides: Readonly<Record<string, RuntimeStartOverride>>;
}

export type CompileMapStudioResult =
  | { ok: true; value: CompiledMapStudioDocument; issues: MapStudioValidationIssue[] }
  | { ok: false; errors: MapStudioValidationIssue[]; issues: MapStudioValidationIssue[] };

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_MAP_AXIS = 4096;
const MAX_MAP_AREA = 16_777_216;

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isTileCoordinate(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function inBounds(map: MapData, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function roleOf(layer: MapLayer): string {
  return layer.role ?? layer.name;
}

function collisionLayer(map: MapData): MapLayer | undefined {
  return map.layers.find(layer => layer.type === 'collision' || roleOf(layer) === 'collision');
}

function isBlocked(map: MapData, x: number, y: number): boolean {
  const layer = collisionLayer(map);
  return layer?.tiles[y * map.width + x] === 9;
}

function hotspotEventId(hotspot: MapStudioHotspotV1, x: number, y: number): string {
  return hotspot.width === 1 && hotspot.height === 1
    ? hotspot.id
    : `${hotspot.id}@${x},${y}`;
}

function rectanglesOverlap(a: MapStudioHotspotV1, b: MapStudioHotspotV1): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Validates untrusted authoring data without mutating it or reading files. */
export function validateMapStudioDocument(document: MapStudioDocumentV1): MapStudioValidationIssue[] {
  const issues: MapStudioValidationIssue[] = [];
  const map = document.map;
  const error = (code: MapStudioIssueCode, path: string, message: string) =>
    issues.push({ severity: 'error', code, path, message });
  const warning = (code: MapStudioIssueCode, path: string, message: string) =>
    issues.push({ severity: 'warning', code, path, message });

  if (document.schemaVersion !== MAP_STUDIO_DOCUMENT_SCHEMA_VERSION) {
    error('invalid-schema', 'schemaVersion', `Expected Map Studio schema version 1.`);
  }
  if (!SAFE_ID.test(map.id)) error('invalid-identifier', 'map.id', 'Map id is not portable.');
  if (!isPositiveInteger(map.width) || map.width > MAX_MAP_AXIS) {
    error('invalid-dimension', 'map.width', `Map width must be an integer from 1 to ${MAX_MAP_AXIS}.`);
  }
  if (!isPositiveInteger(map.height) || map.height > MAX_MAP_AXIS) {
    error('invalid-dimension', 'map.height', `Map height must be an integer from 1 to ${MAX_MAP_AXIS}.`);
  }
  if (isPositiveInteger(map.width) && isPositiveInteger(map.height) && map.width * map.height > MAX_MAP_AREA) {
    error('invalid-dimension', 'map', `Map area exceeds ${MAX_MAP_AREA} tiles.`);
  }
  if (!isPositiveInteger(map.tileSize) || map.tileSize > 512) {
    error('invalid-dimension', 'map.tileSize', 'Tile size must be an integer from 1 to 512.');
  }

  const expectedTiles = Number.isSafeInteger(map.width * map.height) ? map.width * map.height : -1;
  const layerNames = new Set<string>();
  const exclusiveRoles = new Map<string, number>();
  let visualLayerCount = 0;
  map.layers.forEach((layer, index) => {
    const path = `map.layers[${index}]`;
    if (!SAFE_ID.test(layer.name)) error('invalid-identifier', `${path}.name`, 'Layer name is not portable.');
    if (layerNames.has(layer.name)) error('duplicate-id', `${path}.name`, `Duplicate layer name "${layer.name}".`);
    layerNames.add(layer.name);
    if (layer.tiles.length !== expectedTiles) {
      error('invalid-layer-size', `${path}.tiles`, `Layer has ${layer.tiles.length} tiles; expected ${expectedTiles}.`);
    }
    if (layer.type === 'visual') visualLayerCount += 1;
    const role = roleOf(layer);
    const expectedType = role === 'collision' || role === 'region' ? role : 'visual';
    if (layer.type !== expectedType) {
      error('invalid-layer-role', `${path}.role`, `Layer role "${role}" is incompatible with type "${layer.type}".`);
    }
    const exclusiveRole = layer.type === 'collision' || layer.type === 'region' ? layer.type : undefined;
    if (exclusiveRole) {
      const previous = exclusiveRoles.get(exclusiveRole);
      if (previous !== undefined) {
        error('duplicate-layer-role', `${path}.role`, `Layer role "${exclusiveRole}" is already used by map.layers[${previous}].`);
      } else exclusiveRoles.set(exclusiveRole, index);
    }
    layer.tiles.forEach((tile, tileIndex) => {
      if (!Number.isInteger(tile)) {
        error('invalid-layer-tile', `${path}.tiles[${tileIndex}]`, 'Tile ids must be integers.');
      } else if (layer.type === 'collision' && tile !== 0 && tile !== 9) {
        error('invalid-layer-tile', `${path}.tiles[${tileIndex}]`, 'Collision tiles must be 0 (open) or 9 (blocked).');
      } else if (layer.type === 'region' && (tile < 0 || tile > 255)) {
        error('invalid-layer-tile', `${path}.tiles[${tileIndex}]`, 'Region ids must be between 0 and 255.');
      }
    });
  });
  if (visualLayerCount === 0) error('missing-layer-role', 'map.layers', 'Map Studio requires at least one visual layer.');
  if (!exclusiveRoles.has('collision')) error('missing-layer-role', 'map.layers', 'Map Studio requires one collision layer.');
  if (!exclusiveRoles.has('region')) warning('missing-layer-role', 'map.layers', 'A region layer is recommended for encounters and scripted areas.');

  const eventIds = new Set(map.events.map(event => event.id));
  const spawnIds = new Set<string>();
  document.spawns.forEach((spawn, index) => {
    const path = `spawns[${index}]`;
    if (!SAFE_ID.test(spawn.id)) error('invalid-identifier', `${path}.id`, 'Spawn id is not portable.');
    if (spawnIds.has(spawn.id)) error('duplicate-id', `${path}.id`, `Duplicate spawn id "${spawn.id}".`);
    spawnIds.add(spawn.id);
    if (!isTileCoordinate(spawn.x) || !isTileCoordinate(spawn.y) || !inBounds(map, spawn.x, spawn.y)) {
      error('out-of-bounds', path, `Spawn "${spawn.id}" is outside the map.`);
    } else if (
      isBlocked(map, spawn.x, spawn.y)
      || map.events.some(event => event.solid && event.x === spawn.x && event.y === spawn.y)
      || document.hotspots.some(hotspot => hotspot.solid === true
        && spawn.x >= hotspot.x && spawn.x < hotspot.x + hotspot.width
        && spawn.y >= hotspot.y && spawn.y < hotspot.y + hotspot.height)
    ) {
      error('blocked-spawn', path, `Spawn "${spawn.id}" is on a blocked tile.`);
    }
    if (spawn.kind === 'event' && (!spawn.eventId || !eventIds.has(spawn.eventId))) {
      error('unknown-event', `${path}.eventId`, `Event spawn "${spawn.id}" references an unknown event.`);
    }
  });

  const hotspotIds = new Set<string>();
  document.hotspots.forEach((hotspot, index) => {
    const path = `hotspots[${index}]`;
    if (!SAFE_ID.test(hotspot.id)) error('invalid-identifier', `${path}.id`, 'Hotspot id is not portable.');
    if (hotspotIds.has(hotspot.id)) error('duplicate-id', `${path}.id`, `Duplicate hotspot id "${hotspot.id}".`);
    hotspotIds.add(hotspot.id);
    const validRect = isTileCoordinate(hotspot.x) && isTileCoordinate(hotspot.y)
      && isPositiveInteger(hotspot.width) && isPositiveInteger(hotspot.height);
    if (!validRect || hotspot.x + hotspot.width > map.width || hotspot.y + hotspot.height > map.height) {
      error('out-of-bounds', path, `Hotspot "${hotspot.id}" is outside the map.`);
      return;
    }
    for (let y = hotspot.y; y < hotspot.y + hotspot.height; y += 1) {
      for (let x = hotspot.x; x < hotspot.x + hotspot.width; x += 1) {
        const id = hotspotEventId(hotspot, x, y);
        if (eventIds.has(id)) error('event-id-conflict', `${path}.id`, `Compiled event id "${id}" already exists.`);
      }
    }
    document.hotspots.slice(0, index).forEach((other, otherIndex) => {
      if (rectanglesOverlap(hotspot, other)) {
        warning('overlapping-hotspot', path, `Hotspot overlaps hotspots[${otherIndex}] and trigger order may matter.`);
      }
    });
  });

  return issues;
}

/** Compiles editor conveniences to plain MapData and runtime start overrides. */
export function compileMapStudioDocument(document: MapStudioDocumentV1): CompileMapStudioResult {
  const issues = validateMapStudioDocument(document);
  const errors = issues.filter(issue => issue.severity === 'error');
  if (errors.length > 0) return { ok: false, errors, issues };

  const hotspotEvents: GameEvent[] = document.hotspots.flatMap(hotspot => {
    const events: GameEvent[] = [];
    for (let y = hotspot.y; y < hotspot.y + hotspot.height; y += 1) {
      for (let x = hotspot.x; x < hotspot.x + hotspot.width; x += 1) {
        events.push({
          id: hotspotEventId(hotspot, x, y),
          type: 'trigger',
          x,
          y,
          solid: hotspot.solid ?? false,
          trigger: hotspot.trigger,
          commands: hotspot.commands.map(command => structuredClone(command)),
        });
      }
    }
    return events;
  });
  const map: MapData = structuredClone(document.map);
  map.events.push(...hotspotEvents);
  const startOverrides = Object.fromEntries(document.spawns.map(spawn => [
    spawn.id,
    { mapId: map.id, x: spawn.x, y: spawn.y, direction: spawn.direction },
  ]));
  return { ok: true, value: { map, startOverrides }, issues };
}

/** Returns a new GameBundle with the compiled map; the input bundle is untouched. */
export function applyMapStudioDocumentToBundle(
  bundle: GameBundleV1,
  document: MapStudioDocumentV1,
): { bundle: GameBundleV1; startOverrides: Readonly<Record<string, RuntimeStartOverride>> } | undefined {
  const compiled = compileMapStudioDocument(document);
  if (!compiled.ok) return undefined;
  return {
    bundle: { ...bundle, maps: { ...bundle.maps, [compiled.value.map.id]: compiled.value.map } },
    startOverrides: compiled.value.startOverrides,
  };
}
