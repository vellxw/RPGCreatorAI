import { useEffect, useReducer, useState } from 'react';
import {
  CANDIDATE_REVIEWABLE_STATES,
  CANDIDATE_TERMINAL_STATES,
  type Candidate,
  type CandidateKind,
  type CandidateProvenance,
  type CandidateResourceDiff,
  type CandidateReviewEvent,
  type CandidateReviewState,
  type CandidateStoreError,
  type CandidateStoreState,
  type CandidateValidation,
} from './candidateTypes';
import type { ProjectAction } from '../stores/projectStore';
import { validateCandidateResourceDiff } from './candidateLifecycle';
import type { CandidateProjectApplyResult } from './candidateProjectCommit';

const STORAGE_KEY_PREFIX = 'rpgcreatorai:phase12:candidate-store:v2';
const DEFAULT_MAX_CANDIDATES = 50;

export interface CanonicalCandidateCommit {
  historyRecordId: string;
  committedAt: string;
}

export type CandidateAction =
  | {
      type: 'add';
      candidate: Candidate;
      now?: string;
    }
  | {
      type: 'mark-review';
      candidateId: string;
      now?: string;
    }
  | {
      type: 'accept';
      candidateId: string;
      reviewerNote?: string;
      now?: string;
    }
  | {
      type: 'reject';
      candidateId: string;
      reviewerNote?: string;
      now?: string;
    }
  | {
      type: 'archive';
      candidateId: string;
      now?: string;
    }
  | {
      type: 'set-validation';
      candidateId: string;
      validation: CandidateValidation;
      now?: string;
    }
  | {
      type: 'update-provenance';
      candidateId: string;
      provenance: Partial<CandidateProvenance>;
      now?: string;
    }
  | {
      type: 'clear-resolved';
      now?: string;
    }
  | {
      type: 'restore';
      candidates: Candidate[];
      events: CandidateReviewEvent[];
      now?: string;
    }
  | {
      type: 'reconcile-commits';
      commits: CanonicalCandidateCommit[];
      now?: string;
    };

export const CANDIDATE_STORE_INITIAL: CandidateStoreState = {
  candidates: [],
  events: [],
  maxCandidates: DEFAULT_MAX_CANDIDATES,
};

export interface CandidateAcceptResult {
  candidate: Candidate;
  applyActions: ProjectAction[];
}

export type CandidateCommitter = (candidate: Candidate) => CandidateProjectApplyResult;

export interface CandidateAcceptError {
  candidateId: string;
  error: CandidateStoreError;
  message: string;
}

export type CandidateTransitionResult =
  | { ok: true; candidate: Candidate; event: CandidateReviewEvent }
  | { ok: false; error: CandidateAcceptError };

function defaultNow(): string {
  return new Date().toISOString();
}

function sortByCreatedAsc(a: Candidate, b: Candidate): number {
  return a.createdAt.localeCompare(b.createdAt);
}

function clipByMax<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  return arr.slice(arr.length - max);
}

function findCandidate(state: CandidateStoreState, id: string): Candidate | undefined {
  return state.candidates.find(c => c.id === id);
}

function updateCandidate(
  state: CandidateStoreState,
  id: string,
  updater: (candidate: Candidate) => Candidate,
): CandidateStoreState {
  let changed = false;
  const next = state.candidates.map(c => {
    if (c.id !== id) return c;
    const updated = updater(c);
    if (updated === c) return c;
    changed = true;
    return updated;
  });
  if (!changed) return state;
  return { ...state, candidates: next };
}

function pushEvent(
  state: CandidateStoreState,
  event: CandidateReviewEvent,
): CandidateStoreState {
  return { ...state, events: clipByMax([...state.events, event], 200) };
}

function recordTransition(
  state: CandidateStoreState,
  candidate: Candidate,
  previousState: Candidate['reviewState'],
  reviewerNote: string | undefined,
  now: string,
): CandidateStoreState {
  const event: CandidateReviewEvent = {
    candidateId: candidate.id,
    previousState,
    nextState: candidate.reviewState,
    reviewerNote,
    reviewedAt: now,
  };
  return pushEvent(updateCandidate(state, candidate.id, () => candidate), event);
}

const UNCONFIRMED_LOCAL_ACCEPTANCE_WARNING =
  'A previous local acceptance had no matching commit in the open project and must be reviewed again.';

function reconcileCandidateCommits(
  candidates: readonly Candidate[],
  commits: readonly CanonicalCandidateCommit[],
  now: string,
): Candidate[] {
  const byHistoryId = new Map(commits.map(commit => [commit.historyRecordId, commit]));
  return candidates.map(candidate => {
    const commit = candidate.historyRecordId
      ? byHistoryId.get(candidate.historyRecordId)
      : undefined;
    if (commit) {
      if (candidate.reviewState === 'accepted' && candidate.reviewedAt === commit.committedAt) {
        return candidate;
      }
      return {
        ...candidate,
        reviewState: 'accepted',
        reviewedAt: commit.committedAt,
        updatedAt: now,
      };
    }
    if (candidate.reviewState !== 'accepted') return candidate;
    return {
      ...candidate,
      reviewState: 'review',
      reviewedAt: undefined,
      reviewerNote: undefined,
      updatedAt: now,
      validation: {
        ...candidate.validation,
        warnings: candidate.validation.warnings.includes(UNCONFIRMED_LOCAL_ACCEPTANCE_WARNING)
          ? candidate.validation.warnings
          : [...candidate.validation.warnings, UNCONFIRMED_LOCAL_ACCEPTANCE_WARNING],
      },
    };
  });
}

export function candidateStoreReducer(
  state: CandidateStoreState,
  action: CandidateAction,
): CandidateStoreState {
  const now = action.now ?? defaultNow();
  switch (action.type) {
    case 'add': {
      const candidate = { ...action.candidate, createdAt: now, updatedAt: now };
      const candidates = clipByMax(
        [...state.candidates.filter(c => c.id !== candidate.id), candidate].sort(sortByCreatedAsc),
        state.maxCandidates,
      );
      return { ...state, candidates };
    }
    case 'mark-review': {
      const candidate = findCandidate(state, action.candidateId);
      if (!candidate) return state;
      if (candidate.reviewState !== 'draft') return state;
      const next: Candidate = { ...candidate, reviewState: 'review', updatedAt: now };
      return updateCandidate(state, candidate.id, () => next);
    }
    case 'accept': {
      const candidate = findCandidate(state, action.candidateId);
      if (!candidate) return state;
      if (!CANDIDATE_REVIEWABLE_STATES.includes(candidate.reviewState)) return state;
      const previous = candidate.reviewState;
      const next: Candidate = {
        ...candidate,
        reviewState: 'accepted',
        reviewedAt: now,
        updatedAt: now,
        reviewerNote: action.reviewerNote,
      };
      return recordTransition(state, next, previous, action.reviewerNote, now);
    }
    case 'reject': {
      const candidate = findCandidate(state, action.candidateId);
      if (!candidate) return state;
      if (!CANDIDATE_REVIEWABLE_STATES.includes(candidate.reviewState)) return state;
      const previous = candidate.reviewState;
      const next: Candidate = {
        ...candidate,
        reviewState: 'rejected',
        reviewedAt: now,
        updatedAt: now,
        reviewerNote: action.reviewerNote,
      };
      return recordTransition(state, next, previous, action.reviewerNote, now);
    }
    case 'archive': {
      const candidate = findCandidate(state, action.candidateId);
      if (!candidate) return state;
      if (!CANDIDATE_TERMINAL_STATES.includes(candidate.reviewState)) return state;
      return updateCandidate(state, candidate.id, c => ({ ...c, updatedAt: now }));
    }
    case 'set-validation': {
      const candidate = findCandidate(state, action.candidateId);
      if (!candidate) return state;
      return updateCandidate(state, candidate.id, c => ({
        ...c,
        validation: action.validation,
        updatedAt: now,
      }));
    }
    case 'update-provenance': {
      const candidate = findCandidate(state, action.candidateId);
      if (!candidate) return state;
      return updateCandidate(state, candidate.id, c => ({
        ...c,
        provenance: { ...c.provenance, ...action.provenance },
        updatedAt: now,
      }));
    }
    case 'clear-resolved': {
      const remaining = state.candidates.filter(c => !CANDIDATE_TERMINAL_STATES.includes(c.reviewState));
      if (remaining.length === state.candidates.length) return state;
      return { ...state, candidates: remaining };
    }
    case 'restore': {
      return {
        ...state,
        candidates: clipByMax(
          [...action.candidates].sort(sortByCreatedAsc),
          state.maxCandidates,
        ),
        events: clipByMax([...action.events], 200),
      };
    }
    case 'reconcile-commits': {
      const candidates = reconcileCandidateCommits(state.candidates, action.commits, now);
      return candidates.every((candidate, index) => candidate === state.candidates[index])
        ? state
        : { ...state, candidates };
    }
  }
}

export interface AcceptCandidateOptions {
  reviewerNote?: string;
  now?: string;
}

export function tryAcceptCandidate(
  state: CandidateStoreState,
  candidateId: string,
  options: AcceptCandidateOptions = {},
): CandidateTransitionResult {
  const candidate = findCandidate(state, candidateId);
  if (!candidate) {
    return {
      ok: false,
      error: {
        candidateId,
        error: 'unknown-candidate',
        message: `No candidate with id "${candidateId}" exists in the store.`,
      },
    };
  }
  if (!CANDIDATE_REVIEWABLE_STATES.includes(candidate.reviewState)) {
    return {
      ok: false,
      error: {
        candidateId,
        error: 'already-resolved',
        message: `Candidate "${candidate.title}" is already ${candidate.reviewState}.`,
      },
    };
  }
  if (candidate.validation.errors.length > 0) {
    return {
      ok: false,
      error: {
        candidateId,
        error: 'invalid-validation',
        message: `Candidate "${candidate.title}" has unresolved validation errors.`,
      },
    };
  }
  if (!candidate.payload.applyActions || candidate.payload.applyActions.length === 0) {
    return {
      ok: false,
      error: {
        candidateId,
        error: 'missing-apply-actions',
        message: `Candidate "${candidate.title}" has no apply actions queued.`,
      },
    };
  }
  if (!candidate.historyRecordId?.trim()) {
    return {
      ok: false,
      error: {
        candidateId,
        error: 'missing-lineage',
        message: `Candidate "${candidate.title}" has no generation-history lineage id.`,
      },
    };
  }
  if (!candidate.resourceDiff || candidate.resourceDiff.length === 0) {
    return {
      ok: false,
      error: {
        candidateId,
        error: 'missing-diff',
        message: `Candidate "${candidate.title}" has no project-resource diff to review.`,
      },
    };
  }
  const diffErrors = validateCandidateResourceDiff(candidate.resourceDiff, {
    requireIntegrityHashes: false,
  });
  if (diffErrors.length > 0) {
    return {
      ok: false,
      error: {
        candidateId,
        error: 'invalid-diff',
        message: `Candidate "${candidate.title}" has an invalid project-resource diff: ${diffErrors[0]}`,
      },
    };
  }
  const now = options.now ?? defaultNow();
  const accepted: Candidate = {
    ...candidate,
    reviewState: 'accepted',
    reviewedAt: now,
    updatedAt: now,
    reviewerNote: options.reviewerNote,
  };
  const event: CandidateReviewEvent = {
    candidateId: candidate.id,
    previousState: candidate.reviewState,
    nextState: 'accepted',
    reviewerNote: options.reviewerNote,
    reviewedAt: now,
  };
  return { ok: true, candidate: accepted, event };
}

export function tryRejectCandidate(
  state: CandidateStoreState,
  candidateId: string,
  options: AcceptCandidateOptions = {},
): CandidateTransitionResult {
  const candidate = findCandidate(state, candidateId);
  if (!candidate) {
    return {
      ok: false,
      error: {
        candidateId,
        error: 'unknown-candidate',
        message: `No candidate with id "${candidateId}" exists in the store.`,
      },
    };
  }
  if (!CANDIDATE_REVIEWABLE_STATES.includes(candidate.reviewState)) {
    return {
      ok: false,
      error: {
        candidateId,
        error: 'already-resolved',
        message: `Candidate "${candidate.title}" is already ${candidate.reviewState}.`,
      },
    };
  }
  const now = options.now ?? defaultNow();
  const rejected: Candidate = {
    ...candidate,
    reviewState: 'rejected',
    reviewedAt: now,
    updatedAt: now,
    reviewerNote: options.reviewerNote,
  };
  const event: CandidateReviewEvent = {
    candidateId: candidate.id,
    previousState: candidate.reviewState,
    nextState: 'rejected',
    reviewerNote: options.reviewerNote,
    reviewedAt: now,
  };
  return { ok: true, candidate: rejected, event };
}

export interface UseCandidateStoreOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  initial?: CandidateStoreState;
  projectId?: string | null;
  canonicalCommits?: readonly CanonicalCandidateCommit[];
}

export interface CandidateStoreApi {
  state: CandidateStoreState;
  addCandidate: (candidate: Candidate) => void;
  markReview: (candidateId: string) => void;
  acceptCandidate: (
    candidateId: string,
    commit: CandidateCommitter,
    options?: AcceptCandidateOptions,
  ) => CandidateAcceptResult | CandidateAcceptError;
  rejectCandidate: (candidateId: string, options?: AcceptCandidateOptions) => CandidateAcceptResult | CandidateAcceptError;
  archiveCandidate: (candidateId: string) => void;
  setValidation: (candidateId: string, validation: CandidateValidation) => void;
  updateProvenance: (candidateId: string, provenance: Partial<CandidateProvenance>) => void;
  clearResolved: () => void;
}

const CANDIDATE_KINDS = new Set<CandidateKind>([
  'map-draft',
  'event-draft',
  'event-commands',
  'database-draft-actor',
  'database-draft-item',
  'asset-draft',
  'validation-repair',
  'balancing',
  'quest-draft',
]);
const CANDIDATE_REVIEW_STATES = new Set<CandidateReviewState>([
  'draft',
  'review',
  'accepted',
  'rejected',
  'expired',
]);

export function candidateStorageKey(projectId: string | null): string {
  return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(projectId ?? 'no-project')}`;
}

function textField(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function normalizeStoredCandidate(value: unknown, projectId: string | null): Candidate | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Candidate>;
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.title !== 'string'
    || !CANDIDATE_KINDS.has(candidate.kind as CandidateKind)
    || !CANDIDATE_REVIEW_STATES.has(candidate.reviewState as CandidateReviewState)
    || candidate.projectId !== projectId
    || !candidate.payload
    || typeof candidate.payload !== 'object'
    || !candidate.provenance
    || typeof candidate.provenance !== 'object'
  ) {
    return null;
  }
  const createdAt = textField(candidate.createdAt, defaultNow());
  const validation = candidate.validation && typeof candidate.validation === 'object'
    ? candidate.validation
    : { errors: [], warnings: [] };
  return {
    ...candidate,
    id: candidate.id,
    kind: candidate.kind as CandidateKind,
    title: candidate.title,
    payload: {
      summary: textField(candidate.payload.summary),
      applyActions: Array.isArray(candidate.payload.applyActions)
        ? candidate.payload.applyActions
        : [],
      output: candidate.payload.output,
    },
    provenance: {
      ...candidate.provenance,
      providerId: textField(candidate.provenance.providerId, 'unknown'),
      modelId: textField(candidate.provenance.modelId, 'unknown'),
      operation: textField(candidate.provenance.operation, 'unknown'),
      createdAt: textField(candidate.provenance.createdAt, createdAt),
    },
    reviewState: candidate.reviewState as CandidateReviewState,
    validation: {
      errors: stringArray(validation.errors),
      warnings: stringArray(validation.warnings),
    },
    resourceDiff: Array.isArray(candidate.resourceDiff)
      ? candidate.resourceDiff.filter((entry): entry is CandidateResourceDiff => Boolean(entry && typeof entry === 'object'))
      : [],
    projectId,
    historyRecordId: typeof candidate.historyRecordId === 'string'
      ? candidate.historyRecordId
      : null,
    createdAt,
    updatedAt: textField(candidate.updatedAt, createdAt),
  } as Candidate;
}

function safeRead(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  key: string,
  projectId: string | null,
  canonicalCommits: readonly CanonicalCandidateCommit[],
): { candidates: Candidate[]; events: CandidateReviewEvent[] } | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { candidates?: unknown[]; events?: CandidateReviewEvent[] };
    if (!parsed || typeof parsed !== 'object') return null;
    const candidates = (Array.isArray(parsed.candidates) ? parsed.candidates : [])
      .map(candidate => normalizeStoredCandidate(candidate, projectId))
      .filter((candidate): candidate is Candidate => candidate !== null);
    const candidateIds = new Set(candidates.map(candidate => candidate.id));
    const events = (Array.isArray(parsed.events) ? parsed.events : [])
      .filter(event => event && typeof event === 'object' && candidateIds.has(event.candidateId));
    return {
      candidates: reconcileCandidateCommits(candidates, canonicalCommits, defaultNow()),
      events,
    };
  } catch {
    return null;
  }
}

function safeWrite(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  key: string,
  state: CandidateStoreState,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({ candidates: state.candidates, events: state.events }),
    );
  } catch {
    // storage failures are non-fatal; candidates remain in memory only.
  }
}

export function useCandidateStore(options: UseCandidateStoreOptions = {}): CandidateStoreApi {
  const storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const projectId = options.projectId ?? null;
  const storageKey = candidateStorageKey(projectId);
  const canonicalCommits = [...(options.canonicalCommits ?? [])];
  const canonicalCommitSignature = canonicalCommits
    .map(commit => `${commit.historyRecordId}:${commit.committedAt}`)
    .sort()
    .join('|');
  const [state, dispatch] = useReducer(
    candidateStoreReducer,
    options.initial ?? CANDIDATE_STORE_INITIAL,
  );
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);

  useEffect(() => {
    setHydratedStorageKey(null);
    const restored = safeRead(storage, storageKey, projectId, canonicalCommits);
    dispatch({
      type: 'restore',
      candidates: restored?.candidates ?? [],
      events: restored?.events ?? [],
    });
    setHydratedStorageKey(storageKey);
    // Canonical changes are reconciled separately so they cannot rehydrate
    // stale local data over the current in-memory review session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, storage, storageKey]);

  useEffect(() => {
    dispatch({ type: 'reconcile-commits', commits: canonicalCommits });
    // canonicalCommitSignature is a stable value dependency for caller arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalCommitSignature]);

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return;
    safeWrite(storage, storageKey, state);
  }, [hydratedStorageKey, state, storage, storageKey]);

  const api: CandidateStoreApi = {
    state,
    addCandidate: candidate => dispatch({ type: 'add', candidate }),
    markReview: candidateId => dispatch({ type: 'mark-review', candidateId }),
    acceptCandidate: (candidateId, commit, opts) => {
      const result = tryAcceptCandidate(state, candidateId, opts);
      if (result.ok) {
        let commitResult: CandidateProjectApplyResult;
        try {
          commitResult = commit(result.candidate);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'The project commit failed.';
          return { candidateId, error: 'commit-failed', message };
        }
        if (!commitResult.ok) {
          return {
            candidateId,
            error: 'commit-failed',
            message: commitResult.message,
          };
        }
        dispatch({
          type: 'accept',
          candidateId,
          reviewerNote: opts?.reviewerNote,
          now: commitResult.committedAt,
        });
        return { candidate: result.candidate, applyActions: result.candidate.payload.applyActions };
      }
      return result.error;
    },
    rejectCandidate: (candidateId, opts) => {
      const result = tryRejectCandidate(state, candidateId, opts);
      if (result.ok) {
        dispatch({ type: 'reject', candidateId, reviewerNote: opts?.reviewerNote, now: result.event.reviewedAt });
        return { candidate: result.candidate, applyActions: result.candidate.payload.applyActions };
      }
      return result.error;
    },
    archiveCandidate: candidateId => dispatch({ type: 'archive', candidateId }),
    setValidation: (candidateId, validation) => dispatch({ type: 'set-validation', candidateId, validation }),
    updateProvenance: (candidateId, provenance) =>
      dispatch({ type: 'update-provenance', candidateId, provenance }),
    clearResolved: () => dispatch({ type: 'clear-resolved' }),
  };
  return api;
}

export function makeCandidateId(prefix = 'cand'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
