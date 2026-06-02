import { useEffect, useReducer } from 'react';

export type AiRequestJobState = 'queued' | 'running' | 'cancelled' | 'failed' | 'succeeded';

export interface AiRequestJob {
  id: string;
  title: string;
  providerId: string;
  capability: string;
  state: AiRequestJobState;
  progress: number;
  attempt: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  idempotencyKey?: string;
  writeIntentId?: string;
  message?: string;
  error?: string;
  resultSummary?: string;
}

export interface AiRequestQueueState {
  jobs: AiRequestJob[];
  maxJobs: number;
  rejected: Array<{ jobId: string; reason: AiRequestQueueRejectReason }>;
}

export type AiRequestQueueRejectReason =
  | 'queue-full'
  | 'duplicate-active-idempotency-key'
  | 'duplicate-succeeded-write-intent';

export type AiRequestQueueAction =
  | { type: 'enqueue'; job: AiRequestJob }
  | { type: 'startNext'; now?: string }
  | { type: 'progress'; jobId: string; progress: number; message?: string }
  | { type: 'cancel'; jobId: string }
  | { type: 'fail'; jobId: string; error: string }
  | { type: 'succeed'; jobId: string; resultSummary?: string }
  | { type: 'retry'; jobId: string }
  | { type: 'restore'; jobs: AiRequestJob[]; now?: string };

export interface AiRequestQueueSummary {
  total: number;
  active: number;
  failed: number;
  succeeded: number;
  cancelled: number;
}

interface CreateQueueOptions {
  initialJobs?: AiRequestJob[];
  maxJobs?: number;
  now?: () => string;
}

const DEFAULT_MAX_JOBS = 12;
const STORAGE_KEY = 'rpgcreatorai.aiRequestQueue.v1';

function defaultNow(): string {
  return new Date().toISOString();
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function isActive(job: AiRequestJob): boolean {
  return job.state === 'queued' || job.state === 'running';
}

function normalizeJob(job: AiRequestJob, fallbackNow: string): AiRequestJob {
  return {
    ...job,
    id: job.id.trim(),
    title: job.title.trim() || 'AI request',
    providerId: job.providerId.trim() || 'unknown',
    capability: job.capability.trim() || 'unknown',
    progress: clampProgress(job.progress),
    attempt: Math.max(1, Math.floor(job.attempt || 1)),
    maxRetries: Math.max(0, Math.floor(job.maxRetries || 0)),
    createdAt: job.createdAt || fallbackNow,
    updatedAt: job.updatedAt || fallbackNow,
  };
}

function reject(
  state: AiRequestQueueState,
  jobId: string,
  reason: AiRequestQueueRejectReason,
): AiRequestQueueState {
  return {
    ...state,
    rejected: [...state.rejected, { jobId, reason }],
  };
}

function hasActiveDuplicate(state: AiRequestQueueState, job: AiRequestJob): boolean {
  return !!job.idempotencyKey && state.jobs.some(existing =>
    existing.id !== job.id &&
    existing.idempotencyKey === job.idempotencyKey &&
    isActive(existing),
  );
}

function hasSucceededWriteIntent(state: AiRequestQueueState, job: AiRequestJob): boolean {
  return !!job.writeIntentId && state.jobs.some(existing =>
    existing.id !== job.id &&
    existing.writeIntentId === job.writeIntentId &&
    existing.state === 'succeeded',
  );
}

export function createAiRequestQueueState(options: CreateQueueOptions = {}): AiRequestQueueState {
  const now = options.now?.() ?? defaultNow();
  const maxJobs = options.maxJobs ?? DEFAULT_MAX_JOBS;
  return {
    jobs: (options.initialJobs ?? []).slice(0, maxJobs).map(job => normalizeJob(job, now)),
    maxJobs,
    rejected: [],
  };
}

export function canRetryAiJob(job: AiRequestJob): boolean {
  return (job.state === 'failed' || job.state === 'cancelled') && job.attempt - 1 < job.maxRetries;
}

export function restoreAiRequestQueueSnapshot(
  jobs: AiRequestJob[],
  options: CreateQueueOptions = {},
): AiRequestQueueState {
  const now = options.now?.() ?? defaultNow();
  const maxJobs = options.maxJobs ?? DEFAULT_MAX_JOBS;
  return createAiRequestQueueState({
    maxJobs,
    now: () => now,
    initialJobs: jobs.slice(0, maxJobs).map(job => {
      if (job.state !== 'running') return job;
      return {
        ...job,
        state: 'failed',
        updatedAt: now,
        error: 'Job was interrupted before completion; retry is available.',
      };
    }),
  });
}

export function aiRequestQueueReducer(
  state: AiRequestQueueState,
  action: AiRequestQueueAction,
): AiRequestQueueState {
  const now = 'now' in action && action.now ? action.now : defaultNow();

  switch (action.type) {
    case 'enqueue': {
      const job = normalizeJob(action.job, now);
      if (hasActiveDuplicate(state, job)) return reject(state, job.id, 'duplicate-active-idempotency-key');
      if (hasSucceededWriteIntent(state, job)) return reject(state, job.id, 'duplicate-succeeded-write-intent');
      if (state.jobs.length >= state.maxJobs) return reject(state, job.id, 'queue-full');
      return { ...state, jobs: [...state.jobs, job] };
    }
    case 'startNext': {
      let started = false;
      return {
        ...state,
        jobs: state.jobs.map(job => {
          if (started || job.state !== 'queued') return job;
          started = true;
          return {
            ...job,
            state: 'running',
            startedAt: now,
            updatedAt: now,
            error: undefined,
            resultSummary: undefined,
          };
        }),
      };
    }
    case 'progress':
      return {
        ...state,
        jobs: state.jobs.map(job =>
          job.id === action.jobId && job.state === 'running'
            ? {
                ...job,
                progress: clampProgress(action.progress),
                message: action.message,
                updatedAt: now,
              }
            : job,
        ),
      };
    case 'cancel':
      return {
        ...state,
        jobs: state.jobs.map(job =>
          job.id === action.jobId && isActive(job)
            ? {
                ...job,
                state: 'cancelled',
                updatedAt: now,
                completedAt: now,
                message: 'Cancelled by user.',
              }
            : job,
        ),
      };
    case 'fail':
      return {
        ...state,
        jobs: state.jobs.map(job =>
          job.id === action.jobId && job.state === 'running'
            ? {
                ...job,
                state: 'failed',
                updatedAt: now,
                completedAt: now,
                error: action.error,
              }
            : job,
        ),
      };
    case 'succeed':
      return {
        ...state,
        jobs: state.jobs.map(job => {
          if (job.id !== action.jobId || job.state !== 'running') return job;
          if (hasSucceededWriteIntent(state, job)) {
            return {
              ...job,
              state: 'failed',
              updatedAt: now,
              completedAt: now,
              error: 'Write intent already completed; retry blocked to avoid duplicate writes.',
            };
          }
          return {
            ...job,
            state: 'succeeded',
            progress: 100,
            updatedAt: now,
            completedAt: now,
            resultSummary: action.resultSummary,
            error: undefined,
          };
        }),
      };
    case 'retry':
      return {
        ...state,
        jobs: state.jobs.map(job => {
          if (job.id !== action.jobId || !canRetryAiJob(job)) return job;
          if (hasSucceededWriteIntent(state, job)) {
            return {
              ...job,
              state: 'failed',
              updatedAt: now,
              error: 'Write intent already completed; retry blocked to avoid duplicate writes.',
            };
          }
          return {
            ...job,
            state: 'queued',
            progress: 0,
            attempt: job.attempt + 1,
            updatedAt: now,
            startedAt: undefined,
            completedAt: undefined,
            message: undefined,
            error: undefined,
            resultSummary: undefined,
          };
        }),
      };
    case 'restore':
      return restoreAiRequestQueueSnapshot(action.jobs, {
        maxJobs: state.maxJobs,
        now: () => now,
      });
    default:
      return state;
  }
}

export function selectAiRequestQueueSummary(state: AiRequestQueueState): AiRequestQueueSummary {
  return state.jobs.reduce<AiRequestQueueSummary>(
    (summary, job) => ({
      total: summary.total + 1,
      active: summary.active + (isActive(job) ? 1 : 0),
      failed: summary.failed + (job.state === 'failed' ? 1 : 0),
      succeeded: summary.succeeded + (job.state === 'succeeded' ? 1 : 0),
      cancelled: summary.cancelled + (job.state === 'cancelled' ? 1 : 0),
    }),
    { total: 0, active: 0, failed: 0, succeeded: 0, cancelled: 0 },
  );
}

function loadQueueSnapshot(): AiRequestJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useAiRequestQueue(maxJobs = DEFAULT_MAX_JOBS) {
  const [queue, dispatch] = useReducer(
    aiRequestQueueReducer,
    undefined,
    () => restoreAiRequestQueueSnapshot(loadQueueSnapshot(), { maxJobs }),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.jobs));
    } catch {
      // Local storage is best-effort history, not a queue correctness boundary.
    }
  }, [queue.jobs]);

  return {
    queue,
    cancel: (jobId: string) => dispatch({ type: 'cancel', jobId }),
    retry: (jobId: string) => dispatch({ type: 'retry', jobId }),
    dispatch,
  };
}
