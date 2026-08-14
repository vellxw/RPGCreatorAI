export const AI_STUDIO_JOB_STATUSES = [
  'requested',
  'generating',
  'quarantined',
  'review',
  'approved',
  'rejected',
] as const;

export type AiStudioJobStatus = (typeof AI_STUDIO_JOB_STATUSES)[number];
export type AiStudioCostAvailability = 'free' | 'estimated' | 'unknown';
export type AiStudioBudgetConfirmationStatus = 'not-required' | 'required' | 'confirmed' | 'declined';
export type AiStudioJobRejectionKind =
  | 'cancelled'
  | 'provider-error'
  | 'timeout'
  | 'rate-limit'
  | 'quota-exceeded'
  | 'budget-exceeded'
  | 'validation-failed'
  | 'review-rejected'
  | 'unsupported-operation'
  | 'interrupted';

export interface AiStudioBudgetConfirmation {
  status: AiStudioBudgetConfirmationStatus;
  scope: 'job' | 'session';
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface AiStudioJobBudget {
  availability: AiStudioCostAvailability;
  currency: 'USD';
  estimatedUsd?: number;
  maxJobUsd?: number;
  sessionRemainingUsd?: number;
  confirmation: AiStudioBudgetConfirmation;
}

export type AiStudioBudgetBlockReason =
  | 'invalid-budget'
  | 'confirmation-required'
  | 'confirmation-declined'
  | 'job-limit-exceeded'
  | 'session-budget-exceeded';

export type AiStudioBudgetDecision =
  | { allowed: true }
  | { allowed: false; reason: AiStudioBudgetBlockReason; message: string };

export interface AiStudioJobCancellation {
  status: 'none' | 'requested';
  requestedAt?: string;
  requestedBy?: string;
  reason?: string;
}

export interface AiStudioJobRejection {
  kind: AiStudioJobRejectionKind;
  message: string;
  retryable: boolean;
  rejectedAt: string;
  retryAfterSeconds?: number;
}

export type AiStudioJobEventKind =
  | 'created'
  | 'status-changed'
  | 'budget-confirmed'
  | 'cancellation-requested'
  | 'retry-created';

export interface AiStudioJobEvent {
  kind: AiStudioJobEventKind;
  at: string;
  actor: string;
  from?: AiStudioJobStatus;
  to?: AiStudioJobStatus;
  message?: string;
  relatedJobId?: string;
}

export interface AiStudioJob {
  schemaVersion: 1;
  id: string;
  rootJobId: string;
  retryOfJobId?: string;
  candidateId: string;
  projectId: string | null;
  title: string;
  providerId: string;
  modelId: string;
  operation: string;
  requestId?: string;
  idempotencyKey?: string;
  writeIntentId?: string;
  status: AiStudioJobStatus;
  attempt: number;
  maxRetries: number;
  budget: AiStudioJobBudget;
  cancellation: AiStudioJobCancellation;
  rejection?: AiStudioJobRejection;
  history: AiStudioJobEvent[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CreateAiStudioJobInput {
  id: string;
  candidateId: string;
  projectId: string | null;
  title: string;
  providerId: string;
  modelId: string;
  operation: string;
  requestId?: string;
  idempotencyKey?: string;
  writeIntentId?: string;
  budget: AiStudioJobBudget;
  maxRetries?: number;
  now?: string;
  actor?: string;
}

export interface AiStudioJobRejectionInput {
  kind: AiStudioJobRejectionKind;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

export interface AiStudioJobTransitionInput {
  now?: string;
  actor?: string;
  note?: string;
  rejection?: AiStudioJobRejectionInput;
}

export type AiStudioJobErrorCode =
  | 'invalid-input'
  | 'invalid-budget'
  | 'budget-blocked'
  | 'transition-denied'
  | 'cancellation-denied'
  | 'cancellation-pending'
  | 'missing-rejection'
  | 'retry-denied'
  | 'retry-wait';

export type AiStudioJobResult =
  | { ok: true; job: AiStudioJob }
  | {
      ok: false;
      code: AiStudioJobErrorCode;
      message: string;
      budgetReason?: AiStudioBudgetBlockReason;
      retryAt?: string;
    };

const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRIES = 5;
const ALLOWED_TRANSITIONS: Readonly<Record<AiStudioJobStatus, readonly AiStudioJobStatus[]>> = {
  requested: ['generating', 'rejected'],
  generating: ['quarantined', 'rejected'],
  quarantined: ['review', 'rejected'],
  review: ['approved', 'rejected'],
  approved: [],
  rejected: [],
};

function timestamp(now?: string): string {
  return now ?? new Date().toISOString();
}

function nonNegativeFinite(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

function cloneBudget(budget: AiStudioJobBudget): AiStudioJobBudget {
  return { ...budget, confirmation: { ...budget.confirmation } };
}

function fail(
  code: AiStudioJobErrorCode,
  message: string,
  details: Pick<Extract<AiStudioJobResult, { ok: false }>, 'budgetReason' | 'retryAt'> = {},
): AiStudioJobResult {
  return { ok: false, code, message, ...details };
}

export function validateAiStudioJobBudget(budget: AiStudioJobBudget): string[] {
  const errors: string[] = [];
  if (budget.currency !== 'USD') errors.push('Budget currency must be USD.');
  if (!nonNegativeFinite(budget.estimatedUsd)) errors.push('estimatedUsd must be finite and non-negative.');
  if (!nonNegativeFinite(budget.maxJobUsd)) errors.push('maxJobUsd must be finite and non-negative.');
  if (!nonNegativeFinite(budget.sessionRemainingUsd)) errors.push('sessionRemainingUsd must be finite and non-negative.');
  if (budget.availability === 'estimated' && budget.estimatedUsd === undefined) {
    errors.push('Estimated cost availability requires estimatedUsd.');
  }
  if (budget.availability === 'free' && (budget.estimatedUsd ?? 0) > 0) {
    errors.push('Free jobs cannot carry a positive cost estimate.');
  }
  if (budget.confirmation.status === 'confirmed' && !budget.confirmation.confirmedAt?.trim()) {
    errors.push('Confirmed budgets require confirmedAt.');
  }
  return errors;
}

export function evaluateAiStudioJobBudget(budget: AiStudioJobBudget): AiStudioBudgetDecision {
  const errors = validateAiStudioJobBudget(budget);
  if (errors.length > 0) return { allowed: false, reason: 'invalid-budget', message: errors[0] };

  const estimate = budget.estimatedUsd;
  if (estimate !== undefined && budget.maxJobUsd !== undefined && estimate > budget.maxJobUsd) {
    return { allowed: false, reason: 'job-limit-exceeded', message: 'Estimated cost exceeds the per-job budget.' };
  }
  if (estimate !== undefined && budget.sessionRemainingUsd !== undefined && estimate > budget.sessionRemainingUsd) {
    return { allowed: false, reason: 'session-budget-exceeded', message: 'Estimated cost exceeds the remaining session budget.' };
  }
  if (budget.confirmation.status === 'declined') {
    return { allowed: false, reason: 'confirmation-declined', message: 'Paid work was declined for this budget scope.' };
  }
  if (budget.confirmation.status === 'required' ||
      (budget.availability === 'unknown' && budget.confirmation.status !== 'confirmed')) {
    return { allowed: false, reason: 'confirmation-required', message: 'Explicit budget confirmation is required.' };
  }
  return { allowed: true };
}

export function createAiStudioJob(input: CreateAiStudioJobInput): AiStudioJobResult {
  const required = [input.id, input.candidateId, input.title, input.providerId, input.modelId, input.operation];
  if (required.some(value => !value.trim()) || (input.projectId !== null && !input.projectId.trim())) {
    return fail('invalid-input', 'Job, candidate, title, provider, model, operation and project identifiers must be valid.');
  }
  const maxRetries = input.maxRetries ?? DEFAULT_MAX_RETRIES;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > MAX_RETRIES) {
    return fail('invalid-input', `maxRetries must be an integer between 0 and ${MAX_RETRIES}.`);
  }
  const budgetErrors = validateAiStudioJobBudget(input.budget);
  if (budgetErrors.length > 0) return fail('invalid-budget', budgetErrors[0], { budgetReason: 'invalid-budget' });

  const now = timestamp(input.now);
  const actor = input.actor?.trim() || 'system';
  return {
    ok: true,
    job: {
      schemaVersion: 1,
      id: input.id.trim(),
      rootJobId: input.id.trim(),
      candidateId: input.candidateId.trim(),
      projectId: input.projectId,
      title: input.title.trim(),
      providerId: input.providerId.trim(),
      modelId: input.modelId.trim(),
      operation: input.operation.trim(),
      requestId: input.requestId?.trim() || undefined,
      idempotencyKey: input.idempotencyKey?.trim() || undefined,
      writeIntentId: input.writeIntentId?.trim() || undefined,
      status: 'requested',
      attempt: 1,
      maxRetries,
      budget: cloneBudget(input.budget),
      cancellation: { status: 'none' },
      history: [{ kind: 'created', at: now, actor, to: 'requested' }],
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function transitionAiStudioJob(
  job: AiStudioJob,
  to: AiStudioJobStatus,
  input: AiStudioJobTransitionInput = {},
): AiStudioJobResult {
  if (!ALLOWED_TRANSITIONS[job.status].includes(to)) {
    return fail('transition-denied', `Transition ${job.status} -> ${to} is not allowed.`);
  }
  if (job.cancellation.status === 'requested' && to !== 'rejected') {
    return fail('cancellation-pending', 'A cancellation request must settle before the job can advance.');
  }
  if (to === 'generating') {
    const budget = evaluateAiStudioJobBudget(job.budget);
    if (!budget.allowed) return fail('budget-blocked', budget.message, { budgetReason: budget.reason });
  }

  const now = timestamp(input.now);
  let rejection: AiStudioJobRejection | undefined;
  if (to === 'rejected') {
    if (!input.rejection?.message.trim()) return fail('missing-rejection', 'Rejected jobs require a sanitized reason.');
    if (job.cancellation.status === 'requested' && input.rejection.kind !== 'cancelled') {
      return fail('missing-rejection', 'A pending cancellation must settle as a cancelled rejection.');
    }
    const retryAfterSeconds = input.rejection.retryAfterSeconds;
    if (retryAfterSeconds !== undefined && (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0)) {
      return fail('invalid-input', 'retryAfterSeconds must be finite and non-negative.');
    }
    rejection = {
      kind: input.rejection.kind,
      message: input.rejection.message.trim(),
      retryable: input.rejection.retryable,
      rejectedAt: now,
      retryAfterSeconds: retryAfterSeconds === undefined ? undefined : Math.ceil(retryAfterSeconds),
    };
  }

  return {
    ok: true,
    job: {
      ...job,
      status: to,
      rejection,
      updatedAt: now,
      startedAt: to === 'generating' ? (job.startedAt ?? now) : job.startedAt,
      completedAt: to === 'approved' || to === 'rejected' ? now : undefined,
      history: [
        ...job.history,
        {
          kind: 'status-changed',
          at: now,
          actor: input.actor?.trim() || 'system',
          from: job.status,
          to,
          message: input.note?.trim() || rejection?.message,
        },
      ],
    },
  };
}

export function confirmAiStudioJobBudget(
  job: AiStudioJob,
  input: { now?: string; actor?: string },
): AiStudioJobResult {
  if (job.status === 'approved') return fail('transition-denied', 'Approved jobs are immutable.');
  if (job.budget.confirmation.status === 'not-required' || job.budget.confirmation.status === 'confirmed') {
    return { ok: true, job };
  }
  const now = timestamp(input.now);
  const budget: AiStudioJobBudget = {
    ...job.budget,
    confirmation: {
      ...job.budget.confirmation,
      status: 'confirmed',
      confirmedAt: now,
      confirmedBy: input.actor?.trim() || 'creator',
    },
  };
  return {
    ok: true,
    job: {
      ...job,
      budget,
      updatedAt: now,
      history: [...job.history, { kind: 'budget-confirmed', at: now, actor: budget.confirmation.confirmedBy! }],
    },
  };
}

export function requestAiStudioJobCancellation(
  job: AiStudioJob,
  input: { now?: string; actor?: string; reason?: string } = {},
): AiStudioJobResult {
  if (job.status !== 'requested' && job.status !== 'generating') {
    return fail('cancellation-denied', `Jobs in ${job.status} cannot be cancelled.`);
  }
  if (job.cancellation.status === 'requested') return { ok: true, job };
  const now = timestamp(input.now);
  const actor = input.actor?.trim() || 'creator';
  const reason = input.reason?.trim() || 'Cancelled by user.';
  return {
    ok: true,
    job: {
      ...job,
      cancellation: { status: 'requested', requestedAt: now, requestedBy: actor, reason },
      updatedAt: now,
      history: [...job.history, { kind: 'cancellation-requested', at: now, actor, message: reason }],
    },
  };
}

export function settleAiStudioJobCancellation(
  job: AiStudioJob,
  input: { now?: string; actor?: string; retryable?: boolean } = {},
): AiStudioJobResult {
  if (job.cancellation.status !== 'requested') {
    return fail('cancellation-denied', 'No cancellation request is pending.');
  }
  return transitionAiStudioJob(job, 'rejected', {
    now: input.now,
    actor: input.actor ?? 'provider-executor',
    rejection: {
      kind: 'cancelled',
      message: job.cancellation.reason ?? 'Cancelled by user.',
      retryable: input.retryable ?? true,
    },
  });
}

export function canRetryAiStudioJob(
  job: AiStudioJob,
  now: string = new Date().toISOString(),
): { allowed: true } | { allowed: false; reason: string; retryAt?: string } {
  if (job.status !== 'rejected' || !job.rejection) return { allowed: false, reason: 'Only rejected jobs can be retried.' };
  if (!job.rejection.retryable) return { allowed: false, reason: 'The rejection is not retryable.' };
  if (job.attempt - 1 >= job.maxRetries) return { allowed: false, reason: 'The retry limit has been reached.' };
  if (job.rejection.retryAfterSeconds !== undefined) {
    const rejectedAt = Date.parse(job.rejection.rejectedAt);
    const current = Date.parse(now);
    if (Number.isFinite(rejectedAt) && Number.isFinite(current)) {
      const retryAtMs = rejectedAt + job.rejection.retryAfterSeconds * 1000;
      if (current < retryAtMs) {
        return { allowed: false, reason: 'Provider retry delay is still active.', retryAt: new Date(retryAtMs).toISOString() };
      }
    }
  }
  return { allowed: true };
}

function budgetForRetry(budget: AiStudioJobBudget): AiStudioJobBudget {
  const confirmation = { ...budget.confirmation };
  if (confirmation.scope === 'job' && confirmation.status === 'confirmed') {
    confirmation.status = 'required';
    confirmation.confirmedAt = undefined;
    confirmation.confirmedBy = undefined;
  }
  return { ...budget, confirmation };
}

export function retryAiStudioJob(
  job: AiStudioJob,
  input: { id: string; candidateId: string; now?: string; actor?: string; budget?: AiStudioJobBudget },
): AiStudioJobResult {
  const now = timestamp(input.now);
  const retry = canRetryAiStudioJob(job, now);
  if (!retry.allowed) {
    return fail(retry.retryAt ? 'retry-wait' : 'retry-denied', retry.reason, { retryAt: retry.retryAt });
  }
  if (!input.id.trim() || !input.candidateId.trim() || input.id === job.id || input.candidateId === job.candidateId) {
    return fail('invalid-input', 'A retry requires new job and candidate identifiers.');
  }
  const budget = cloneBudget(input.budget ?? budgetForRetry(job.budget));
  const errors = validateAiStudioJobBudget(budget);
  if (errors.length > 0) return fail('invalid-budget', errors[0], { budgetReason: 'invalid-budget' });
  const actor = input.actor?.trim() || 'creator';
  return {
    ok: true,
    job: {
      ...job,
      id: input.id.trim(),
      candidateId: input.candidateId.trim(),
      retryOfJobId: job.id,
      status: 'requested',
      attempt: job.attempt + 1,
      budget,
      cancellation: { status: 'none' },
      rejection: undefined,
      history: [{ kind: 'retry-created', at: now, actor, to: 'requested', relatedJobId: job.id }],
      createdAt: now,
      updatedAt: now,
      startedAt: undefined,
      completedAt: undefined,
    },
  };
}

export function isAiStudioJobTerminal(job: AiStudioJob): boolean {
  return job.status === 'approved' || job.status === 'rejected';
}
