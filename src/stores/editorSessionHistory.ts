/**
 * Pure editor history/autosave/recovery contract.
 *
 * Storage and clocks are deliberately injected by callers so this module can
 * be shared by the React editor, Tauri commands and tests without touching the
 * filesystem, localStorage or the DOM.
 */

export const EDITOR_RECOVERY_SCHEMA_VERSION = 1 as const;

export interface AutosavePolicy {
  enabled: boolean;
  intervalMs: number;
  minimumDirtyAgeMs: number;
}

export interface EditorRevision<T> {
  revision: number;
  value: T;
}

export interface EditorSessionHistory<T> {
  present: EditorRevision<T>;
  past: EditorRevision<T>[];
  future: EditorRevision<T>[];
  capacity: number;
  savedRevision: number;
  lastMutationAt: number;
  lastAutosaveAt: number | null;
  lastAutosavedRevision: number | null;
}

export interface RecoveryEnvelope<T> {
  schemaVersion: typeof EDITOR_RECOVERY_SCHEMA_VERSION;
  projectId: string;
  sessionId: string;
  createdAt: number;
  revision: number;
  savedRevision: number;
  payload: T;
  checksum: string;
}

export type RecoveryAssessment<T> =
  | { status: 'recover'; envelope: RecoveryEnvelope<T> }
  | { status: 'stale'; reason: string }
  | { status: 'invalid'; reason: string };

export function createEditorSessionHistory<T>(
  initialValue: T,
  now: number,
  capacity = 100,
): EditorSessionHistory<T> {
  return {
    present: { revision: 0, value: initialValue },
    past: [],
    future: [],
    capacity: normalizeCapacity(capacity),
    savedRevision: 0,
    lastMutationAt: normalizeTimestamp(now),
    lastAutosaveAt: null,
    lastAutosavedRevision: null,
  };
}

export function commitEditorRevision<T>(
  state: EditorSessionHistory<T>,
  value: T,
  now: number,
  equals: (left: T, right: T) => boolean = Object.is,
): EditorSessionHistory<T> {
  if (equals(state.present.value, value)) return state;

  const revision = state.present.revision + 1;
  return {
    ...state,
    present: { revision, value },
    past: [...state.past, state.present].slice(-state.capacity),
    future: [],
    lastMutationAt: normalizeTimestamp(now),
  };
}

export function undoEditorRevision<T>(state: EditorSessionHistory<T>): EditorSessionHistory<T> {
  const previous = state.past.at(-1);
  if (!previous) return state;

  return {
    ...state,
    present: previous,
    past: state.past.slice(0, -1),
    future: [state.present, ...state.future].slice(0, state.capacity),
  };
}

export function redoEditorRevision<T>(state: EditorSessionHistory<T>): EditorSessionHistory<T> {
  const [next, ...future] = state.future;
  if (!next) return state;

  return {
    ...state,
    present: next,
    past: [...state.past, state.present].slice(-state.capacity),
    future,
  };
}

export function markEditorRevisionSaved<T>(state: EditorSessionHistory<T>): EditorSessionHistory<T> {
  return { ...state, savedRevision: state.present.revision };
}

export function isEditorSessionDirty<T>(state: EditorSessionHistory<T>): boolean {
  return state.present.revision !== state.savedRevision;
}

export function shouldAutosaveEditorSession<T>(
  state: EditorSessionHistory<T>,
  policy: AutosavePolicy,
  now: number,
): boolean {
  if (!policy.enabled || !isEditorSessionDirty(state)) return false;
  if (state.lastAutosavedRevision === state.present.revision) return false;

  const timestamp = normalizeTimestamp(now);
  const dirtyLongEnough = timestamp - state.lastMutationAt >= Math.max(0, policy.minimumDirtyAgeMs);
  const intervalElapsed =
    state.lastAutosaveAt === null || timestamp - state.lastAutosaveAt >= Math.max(1, policy.intervalMs);
  return dirtyLongEnough && intervalElapsed;
}

export function markEditorRevisionAutosaved<T>(
  state: EditorSessionHistory<T>,
  now: number,
): EditorSessionHistory<T> {
  return {
    ...state,
    lastAutosaveAt: normalizeTimestamp(now),
    lastAutosavedRevision: state.present.revision,
  };
}

export function createRecoveryEnvelope<T>(options: {
  projectId: string;
  sessionId: string;
  state: EditorSessionHistory<T>;
  now: number;
}): RecoveryEnvelope<T> {
  const projectId = requireIdentifier(options.projectId, 'projectId');
  const sessionId = requireIdentifier(options.sessionId, 'sessionId');
  const createdAt = normalizeTimestamp(options.now);
  const body = {
    schemaVersion: EDITOR_RECOVERY_SCHEMA_VERSION,
    projectId,
    sessionId,
    createdAt,
    revision: options.state.present.revision,
    savedRevision: options.state.savedRevision,
    payload: options.state.present.value,
  };

  return { ...body, checksum: checksumCanonicalJson(body) };
}

export function assessRecoveryEnvelope<T>(
  candidate: unknown,
  current: { projectId: string; savedRevision: number; savedAt: number | null },
): RecoveryAssessment<T> {
  if (!isRecord(candidate)) return { status: 'invalid', reason: 'Recovery data is not an object.' };
  if (candidate.schemaVersion !== EDITOR_RECOVERY_SCHEMA_VERSION) {
    return { status: 'invalid', reason: 'Recovery schema is unsupported.' };
  }
  if (
    typeof candidate.projectId !== 'string' ||
    typeof candidate.sessionId !== 'string' ||
    !isNonNegativeInteger(candidate.createdAt) ||
    !isNonNegativeInteger(candidate.revision) ||
    !isNonNegativeInteger(candidate.savedRevision) ||
    typeof candidate.checksum !== 'string' ||
    !('payload' in candidate)
  ) {
    return { status: 'invalid', reason: 'Recovery metadata is malformed.' };
  }

  const { checksum, ...body } = candidate;
  let expectedChecksum: string;
  try {
    expectedChecksum = checksumCanonicalJson(body);
  } catch {
    return { status: 'invalid', reason: 'Recovery payload is not valid JSON data.' };
  }
  if (checksum !== expectedChecksum) return { status: 'invalid', reason: 'Recovery checksum does not match.' };
  if (candidate.projectId !== current.projectId) {
    return { status: 'invalid', reason: 'Recovery data belongs to another project.' };
  }
  if (candidate.revision <= current.savedRevision) {
    return { status: 'stale', reason: 'Recovery data does not contain a newer revision.' };
  }
  if (current.savedAt !== null && candidate.createdAt <= current.savedAt) {
    return { status: 'stale', reason: 'Recovery data predates the current saved project.' };
  }

  return { status: 'recover', envelope: candidate as unknown as RecoveryEnvelope<T> };
}

export function serializeRecoveryEnvelope<T>(envelope: RecoveryEnvelope<T>): string {
  return canonicalJson(envelope);
}

export function parseRecoveryEnvelope(serialized: string): unknown {
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    return null;
  }
}

function normalizeCapacity(capacity: number): number {
  if (!Number.isFinite(capacity)) return 100;
  return Math.max(1, Math.floor(capacity));
}

function normalizeTimestamp(timestamp: number): number {
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('Timestamp must be a non-negative number.');
  return Math.floor(timestamp);
}

function requireIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must not be empty.`);
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function checksumCanonicalJson(value: unknown): string {
  const input = canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function canonicalJson(value: unknown): string {
  const seen = new Set<object>();
  const normalize = (current: unknown): unknown => {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return current;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new Error('Non-finite numbers cannot be serialized.');
      return current;
    }
    if (Array.isArray(current)) {
      if (seen.has(current)) throw new Error('Cyclic data cannot be serialized.');
      seen.add(current);
      const result = current.map(item => normalize(item));
      seen.delete(current);
      return result;
    }
    if (isRecord(current)) {
      if (seen.has(current)) throw new Error('Cyclic data cannot be serialized.');
      seen.add(current);
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(current).sort()) {
        const item = current[key];
        if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
          throw new Error('Only JSON data can be serialized.');
        }
        result[key] = normalize(item);
      }
      seen.delete(current);
      return result;
    }
    throw new Error('Only JSON data can be serialized.');
  };
  return JSON.stringify(normalize(value));
}
