import type { Direction } from '../types/project';

export const PORTABLE_SAVE_SCHEMA_VERSION = 2 as const;

export type PortableScalar = string | number | boolean | null;
export type PortableValue = PortableScalar | PortableValue[] | { [key: string]: PortableValue };

export interface PortableActorState {
  hp: number;
  mp: number;
  level: number;
  exp: number;
}

export interface PortableQuestState {
  state: string;
  objectives: Record<string, string>;
}

/** Versioned sub-document so VN resume data can evolve without bumping SaveV2. */
export interface PortableVisualNovelSessionV1 {
  schemaVersion: 1;
  state: {
    sceneId: string;
    currentNodeId: string;
    variables: Record<string, PortableScalar>;
    visitedNodeIds: string[];
    selectedChoiceIds: string[];
    endingId?: string;
  };
  selectedChoiceIndex: number;
}

/** JSON-only save contract shared by browser, desktop, and native hosts. */
export interface PortableSaveV2 {
  schemaVersion: typeof PORTABLE_SAVE_SCHEMA_VERSION;
  currentMapId: string;
  player: { x: number; y: number; direction: Direction };
  flags: Record<string, boolean>;
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  inventory: Record<string, number>;
  gold: number;
  party: string[];
  actors: Record<string, PortableActorState>;
  quests: Record<string, PortableQuestState>;
  /** Optional since pre-VN schemaVersion 2 saves do not contain this field. */
  visualNovel?: PortableVisualNovelSessionV1;
  /** Namespaced plugin data. Values must remain JSON-compatible. */
  extensions?: Record<string, PortableValue>;
}

export type PortableSave = PortableSaveV2;

export function createPortableSave(
  location: Pick<PortableSaveV2, 'currentMapId' | 'player'>,
  overrides: Partial<Omit<PortableSaveV2, 'schemaVersion' | 'currentMapId' | 'player'>> = {},
): PortableSaveV2 {
  return {
    schemaVersion: PORTABLE_SAVE_SCHEMA_VERSION,
    currentMapId: location.currentMapId,
    player: { ...location.player },
    flags: overrides.flags ?? {},
    switches: overrides.switches ?? {},
    variables: overrides.variables ?? {},
    inventory: overrides.inventory ?? {},
    gold: overrides.gold ?? 0,
    party: overrides.party ?? [],
    actors: overrides.actors ?? {},
    quests: overrides.quests ?? {},
    visualNovel: overrides.visualNovel,
    extensions: overrides.extensions,
  };
}

export function serializePortableSave(save: PortableSaveV2): string {
  assertPortableSave(save);
  return JSON.stringify(save);
}

export function parsePortableSave(input: string): PortableSaveV2 {
  const value: unknown = JSON.parse(input);
  assertPortableSave(value);
  return value;
}

export function assertPortableSave(value: unknown): asserts value is PortableSaveV2 {
  if (!isRecord(value)) throw new Error('Save must be a JSON object.');
  if (value.schemaVersion !== PORTABLE_SAVE_SCHEMA_VERSION) {
    throw new Error(`Unsupported save schemaVersion: ${String(value.schemaVersion)}.`);
  }
  if (typeof value.currentMapId !== 'string' || value.currentMapId.length === 0) {
    throw new Error('Save currentMapId must be a non-empty string.');
  }
  if (!isRecord(value.player)) throw new Error('Save player must be an object.');
  assertFiniteNumber(value.player.x, 'player.x');
  assertFiniteNumber(value.player.y, 'player.y');
  if (!isDirection(value.player.direction)) throw new Error('Save player.direction is invalid.');
  assertRecordOf(value.flags, 'flags', entry => typeof entry === 'boolean');
  assertRecordOf(value.switches, 'switches', entry => typeof entry === 'boolean');
  assertRecordOf(value.variables, 'variables', isFiniteNumber);
  assertRecordOf(value.inventory, 'inventory', isFiniteNumber);
  assertFiniteNumber(value.gold, 'gold');
  if (!Array.isArray(value.party) || !value.party.every(entry => typeof entry === 'string')) {
    throw new Error('Save party must be an array of strings.');
  }
  assertRecordOf(value.actors, 'actors', isActorState);
  assertRecordOf(value.quests, 'quests', isQuestState);
  if (value.visualNovel !== undefined && !isPortableVisualNovelSession(value.visualNovel)) {
    throw new Error('Save visualNovel has an invalid value.');
  }
  if (value.extensions !== undefined) {
    assertRecordOf(value.extensions, 'extensions', isPortableValue);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertFiniteNumber(value: unknown, field: string): asserts value is number {
  if (!isFiniteNumber(value)) throw new Error(`Save ${field} must be a finite number.`);
}

function assertRecordOf(
  value: unknown,
  field: string,
  predicate: (entry: unknown) => boolean,
): asserts value is Record<string, unknown> {
  if (!isRecord(value) || !Object.values(value).every(predicate)) {
    throw new Error(`Save ${field} has an invalid value.`);
  }
}

function isDirection(value: unknown): value is Direction {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

function isActorState(value: unknown): value is PortableActorState {
  return isRecord(value)
    && isFiniteNumber(value.hp)
    && isFiniteNumber(value.mp)
    && isFiniteNumber(value.level)
    && isFiniteNumber(value.exp);
}

function isQuestState(value: unknown): value is PortableQuestState {
  return isRecord(value)
    && typeof value.state === 'string'
    && isRecord(value.objectives)
    && Object.values(value.objectives).every(entry => typeof entry === 'string');
}

function isPortableVisualNovelSession(value: unknown): value is PortableVisualNovelSessionV1 {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isRecord(value.state)
    || typeof value.state.sceneId !== 'string'
    || value.state.sceneId.length === 0
    || typeof value.state.currentNodeId !== 'string'
    || value.state.currentNodeId.length === 0
    || !isRecord(value.state.variables)
    || !Object.values(value.state.variables).every(isPortableScalar)
    || !isStringArray(value.state.visitedNodeIds)
    || !isStringArray(value.state.selectedChoiceIds)
    || (value.state.endingId !== undefined && typeof value.state.endingId !== 'string')
    || typeof value.selectedChoiceIndex !== 'number'
    || !Number.isSafeInteger(value.selectedChoiceIndex)
    || value.selectedChoiceIndex < 0) {
    return false;
  }
  return true;
}

function isPortableScalar(value: unknown): value is PortableScalar {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || isFiniteNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function isPortableValue(value: unknown): value is PortableValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (isFiniteNumber(value)) return true;
  if (Array.isArray(value)) return value.every(isPortableValue);
  return isRecord(value) && Object.values(value).every(isPortableValue);
}
