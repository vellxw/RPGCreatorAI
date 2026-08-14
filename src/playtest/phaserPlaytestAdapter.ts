import type { FullProjectState } from '../adapters/types';
import {
  createRuntimeConfig,
  ExplorationSimulation,
  type GameBundleCompileIssue,
  type GameBundleCompileOptions,
  type GameBundleV1,
  type RuntimeConfigV1,
} from '../runtime-core';
import { compileGameBundleV1 } from '../runtime-core/gameBundleCompiler';
import {
  createRuntimeAssetManifest,
  type RuntimeAssetManifest,
  type SimulationPort,
} from '../runtime-phaser';
import type { EditorState } from '../stores/editorStore';
import type { Direction, MapData } from '../types/project';
import { normalizeVisualProfile } from '../visual/visualProfile';
import { buildPlaytestLaunchPlan, type PlaytestLaunchPlan } from './playtestLaunchRequest';

export interface PhaserPlaytestAdapterOptions {
  compile?: GameBundleCompileOptions;
  playerAssetKey?: string;
  backgroundColor?: string;
  movementIntervalMs?: number;
}

export interface PhaserPlaytestHostSession {
  bundle: GameBundleV1;
  runtimeConfig: RuntimeConfigV1;
  simulation: ExplorationSimulation & SimulationPort;
  assetManifest: RuntimeAssetManifest;
  viewport: { width: number; height: number };
  launchPlan: PlaytestLaunchPlan;
}

export type PhaserPlaytestAdapterError =
  | { code: 'launch-blocked'; message: string }
  | { code: 'no-open-spawn'; message: string }
  | { code: 'bundle-compile'; message: string; issue: GameBundleCompileIssue };

export type PhaserPlaytestAdapterResult =
  | {
      ok: true;
      session: PhaserPlaytestHostSession;
      warnings: readonly GameBundleCompileIssue[];
    }
  | {
      ok: false;
      errors: readonly PhaserPlaytestAdapterError[];
      warnings: readonly GameBundleCompileIssue[];
    };

function isBlocked(map: MapData, x: number, y: number): boolean {
  const collision = map.layers.find(layer =>
    layer.type === 'collision' || layer.role === 'collision' || layer.name === 'collision',
  );
  const collisionTile = collision?.tiles[y * map.width + x];
  const solidEvent = map.events.some(event => event.solid === true && event.x === x && event.y === y);
  return collisionTile === 9 || solidEvent;
}

/** Matches the deterministic row-major Manhattan search used by native playtest sessions. */
export function findNearestOpenPlaytestTile(
  map: MapData,
  preferred: { x: number; y: number },
  excluded?: { x: number; y: number },
): { x: number; y: number } | undefined {
  if (map.width <= 0 || map.height <= 0) return undefined;
  const origin = {
    x: Math.max(0, Math.min(map.width - 1, Math.trunc(preferred.x))),
    y: Math.max(0, Math.min(map.height - 1, Math.trunc(preferred.y))),
  };
  const maxDistance = map.width + map.height - 2;
  for (let distance = 0; distance <= maxDistance; distance += 1) {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (Math.abs(x - origin.x) + Math.abs(y - origin.y) !== distance) continue;
        if (excluded && x === excluded.x && y === excluded.y) continue;
        if (!isBlocked(map, x, y)) return { x, y };
      }
    }
  }
  return undefined;
}

function directionToward(
  from: { x: number; y: number },
  target: { x: number; y: number },
): Direction {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Mirrors native selected-event playtests: adjacent when possible and always facing the event. */
export function findSelectedEventPlaytestSpawn(
  map: MapData,
  event: { x: number; y: number },
  preferred?: { x: number; y: number },
): { x: number; y: number; direction: Direction } | undefined {
  const candidates = [
    ...(preferred ? [preferred] : []),
    { x: event.x, y: event.y + 1 },
    { x: event.x - 1, y: event.y },
    { x: event.x + 1, y: event.y },
    { x: event.x, y: event.y - 1 },
  ];
  for (const candidate of candidates) {
    if (candidate.x < 0 || candidate.y < 0
      || candidate.x >= map.width || candidate.y >= map.height
      || isBlocked(map, candidate.x, candidate.y)) continue;
    return { ...candidate, direction: directionToward(candidate, event) };
  }

  const tile = findNearestOpenPlaytestTile(map, event, event);
  return tile ? { ...tile, direction: directionToward(tile, event) } : undefined;
}

function resolveStartOverride(
  projectState: FullProjectState,
  editorState: EditorState,
): RuntimeConfigV1['startOverride'] | undefined | null {
  if (editorState.playtestMode === 'projectStart') {
    const map = projectState.maps[projectState.project.startMapId];
    if (!map) return null;
    const authored = projectState.project.startPosition;
    const tile = findNearestOpenPlaytestTile(map, authored);
    if (!tile) return null;
    // Keep the authored GameBundle untouched when its start is already valid.
    // A runtime-only override repairs stale/occupied starts without mutating it.
    if (tile.x === authored.x && tile.y === authored.y) return undefined;
    return {
      mapId: map.id,
      ...tile,
      direction: authored.direction,
    };
  }

  if (editorState.playtestMode === 'currentMap') {
    const map = projectState.maps[editorState.selectedMapId];
    if (!map) return null;
    const preferred = map.id === projectState.project.startMapId
      ? projectState.project.startPosition
      : { x: 0, y: 0 };
    const tile = findNearestOpenPlaytestTile(map, preferred);
    if (!tile) return null;
    return {
      mapId: map.id,
      ...tile,
      direction: map.id === projectState.project.startMapId
        ? projectState.project.startPosition.direction
        : 'down',
    };
  }

  const mapId = editorState.selectedEventMapId ?? editorState.selectedMapId;
  const map = projectState.maps[mapId];
  const eventId = editorState.selectedEvent?.id;
  const event = map?.events.find(candidate => candidate.id === eventId);
  if (!map || !event) return null;
  // Preserve a still-valid editor selection as the first adjacent candidate
  // while taking the event position itself from the fresh project snapshot.
  // This avoids jumping the player when the event moved between selection and
  // launch, without ever trusting stale event content or allowing overlap.
  const preferred = editorState.selectedEvent && editorState.selectedEvent.id === event.id
    ? { x: editorState.selectedEvent.x, y: editorState.selectedEvent.y }
    : undefined;
  const spawn = findSelectedEventPlaytestSpawn(map, event, preferred);
  if (!spawn) return null;
  return { mapId, ...spawn };
}

/**
 * Pure editor-to-runtime boundary for browser playtests. It performs no file,
 * DOM, Phaser, or network work; the caller owns mounting and destroying the
 * Phaser host with the returned simulation and manifest.
 */
export function createPhaserPlaytestSession(
  projectState: FullProjectState,
  editorState: EditorState,
  options: PhaserPlaytestAdapterOptions = {},
): PhaserPlaytestAdapterResult {
  const launchPlan = buildPlaytestLaunchPlan(editorState, projectState);
  if (launchPlan.blocker) {
    return {
      ok: false,
      errors: [{ code: 'launch-blocked', message: launchPlan.blocker }],
      warnings: [],
    };
  }

  const startOverride = resolveStartOverride(projectState, editorState);
  if (startOverride === null) {
    return {
      ok: false,
      errors: [{
        code: 'no-open-spawn',
        message: `Playtest target "${launchPlan.targetLabel}" has no open spawn tile.`,
      }],
      warnings: [],
    };
  }

  const compiled = compileGameBundleV1(projectState, options.compile);
  if (!compiled.ok) {
    return {
      ok: false,
      errors: compiled.errors.map(issue => ({
        code: 'bundle-compile' as const,
        message: issue.message,
        issue,
      })),
      warnings: compiled.warnings,
    };
  }

  const runtimeConfig = createRuntimeConfig({ startOverride });
  const simulation = new ExplorationSimulation({
    bundle: compiled.bundle,
    config: runtimeConfig,
    playerAssetKey: options.playerAssetKey,
    backgroundColor: options.backgroundColor,
    movementIntervalMs: options.movementIntervalMs,
  });
  const visualProfile = normalizeVisualProfile(compiled.bundle.project.visualProfile);

  return {
    ok: true,
    session: {
      bundle: compiled.bundle,
      runtimeConfig,
      simulation,
      assetManifest: createRuntimeAssetManifest(compiled.bundle),
      viewport: visualProfile.baseResolution,
      launchPlan,
    },
    warnings: compiled.warnings,
  };
}
