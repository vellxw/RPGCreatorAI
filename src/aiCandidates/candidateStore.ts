import { useEffect, useReducer } from 'react';
import {
  CANDIDATE_REVIEWABLE_STATES,
  CANDIDATE_TERMINAL_STATES,
  type Candidate,
  type CandidateProvenance,
  type CandidateReviewEvent,
  type CandidateStoreError,
  type CandidateStoreState,
  type CandidateValidation,
} from './candidateTypes';
import type { ProjectAction } from '../stores/projectStore';

const STORAGE_KEY = 'rpgcreatorai:phase12:candidate-store:v1';
const DEFAULT_MAX_CANDIDATES = 50;

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
}

export interface CandidateStoreApi {
  state: CandidateStoreState;
  addCandidate: (candidate: Candidate) => void;
  markReview: (candidateId: string) => void;
  acceptCandidate: (candidateId: string, options?: AcceptCandidateOptions) => CandidateAcceptResult | CandidateAcceptError;
  rejectCandidate: (candidateId: string, options?: AcceptCandidateOptions) => CandidateAcceptResult | CandidateAcceptError;
  archiveCandidate: (candidateId: string) => void;
  setValidation: (candidateId: string, validation: CandidateValidation) => void;
  updateProvenance: (candidateId: string, provenance: Partial<CandidateProvenance>) => void;
  clearResolved: () => void;
}

function safeRead(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  key: string,
): { candidates: Candidate[]; events: CandidateReviewEvent[] } | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { candidates?: Candidate[]; events?: CandidateReviewEvent[] };
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
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
  const [state, dispatch] = useReducer(
    candidateStoreReducer,
    options.initial ?? CANDIDATE_STORE_INITIAL,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !storage) return;
    const restored = safeRead(storage, STORAGE_KEY);
    if (restored) {
      dispatch({ type: 'restore', candidates: restored.candidates, events: restored.events });
    }
    // intentional one-shot hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    safeWrite(storage, STORAGE_KEY, state);
  }, [state, storage]);

  const api: CandidateStoreApi = {
    state,
    addCandidate: candidate => dispatch({ type: 'add', candidate }),
    markReview: candidateId => dispatch({ type: 'mark-review', candidateId }),
    acceptCandidate: (candidateId, opts) => {
      const result = tryAcceptCandidate(state, candidateId, opts);
      if (result.ok) {
        dispatch({ type: 'accept', candidateId, reviewerNote: opts?.reviewerNote, now: result.event.reviewedAt });
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
