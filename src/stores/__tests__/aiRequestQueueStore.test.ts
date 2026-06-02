import { describe, expect, it } from 'vitest';
import {
  aiRequestQueueReducer,
  confirmAiJobBudget,
  createAiRequestQueueState,
  requiresAiJobBudgetConfirmation,
  restoreAiRequestQueueSnapshot,
  selectAiRequestQueueSummary,
  type AiRequestJob,
} from '../aiRequestQueueStore';

function queuedJob(overrides: Partial<AiRequestJob> = {}): AiRequestJob {
  return {
    id: 'job-1',
    title: 'Draft town dialogue',
    providerId: 'openai',
    capability: 'text',
    state: 'queued',
    progress: 0,
    attempt: 1,
    maxRetries: 2,
    createdAt: '2026-06-02T12:00:00.000Z',
    updatedAt: '2026-06-02T12:00:00.000Z',
    idempotencyKey: 'dialogue-town-intro',
    writeIntentId: 'preview-dialogue-town-intro',
    ...overrides,
  };
}

describe('aiRequestQueueStore', () => {
  it('bounds queued jobs and rejects duplicate active idempotency keys', () => {
    let state = createAiRequestQueueState({ maxJobs: 2, now: () => '2026-06-02T12:00:00.000Z' });

    state = aiRequestQueueReducer(state, { type: 'enqueue', job: queuedJob({ id: 'job-1' }) });
    state = aiRequestQueueReducer(state, { type: 'enqueue', job: queuedJob({ id: 'job-2', idempotencyKey: 'asset-plan' }) });
    state = aiRequestQueueReducer(state, { type: 'enqueue', job: queuedJob({ id: 'job-3', idempotencyKey: 'asset-plan' }) });
    state = aiRequestQueueReducer(state, { type: 'enqueue', job: queuedJob({ id: 'job-4', idempotencyKey: 'third-job' }) });

    expect(state.jobs.map(job => job.id)).toEqual(['job-1', 'job-2']);
    expect(state.rejected).toEqual([
      { jobId: 'job-3', reason: 'duplicate-active-idempotency-key' },
      { jobId: 'job-4', reason: 'queue-full' },
    ]);
  });

  it('moves jobs through running, progress, failure, retry, cancellation, and success states', () => {
    let state = createAiRequestQueueState({ now: () => '2026-06-02T12:00:00.000Z' });
    state = aiRequestQueueReducer(state, { type: 'enqueue', job: queuedJob() });
    state = aiRequestQueueReducer(state, { type: 'startNext', now: '2026-06-02T12:00:01.000Z' });
    state = aiRequestQueueReducer(state, { type: 'progress', jobId: 'job-1', progress: 42, message: 'Composing draft' });
    state = aiRequestQueueReducer(state, { type: 'fail', jobId: 'job-1', error: 'Provider returned fixture failure' });

    expect(state.jobs[0]).toMatchObject({
      state: 'failed',
      progress: 42,
      error: 'Provider returned fixture failure',
    });

    state = aiRequestQueueReducer(state, { type: 'retry', jobId: 'job-1' });
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]).toMatchObject({
      id: 'job-1',
      state: 'queued',
      attempt: 2,
      progress: 0,
      writeIntentId: 'preview-dialogue-town-intro',
    });

    state = aiRequestQueueReducer(state, { type: 'startNext', now: '2026-06-02T12:00:02.000Z' });
    state = aiRequestQueueReducer(state, { type: 'cancel', jobId: 'job-1' });
    expect(state.jobs[0]).toMatchObject({ state: 'cancelled', progress: 0 });

    state = aiRequestQueueReducer(state, { type: 'retry', jobId: 'job-1' });
    state = aiRequestQueueReducer(state, { type: 'startNext', now: '2026-06-02T12:00:03.000Z' });
    state = aiRequestQueueReducer(state, { type: 'succeed', jobId: 'job-1', resultSummary: 'Preview ready' });

    expect(state.jobs[0]).toMatchObject({
      state: 'succeeded',
      progress: 100,
      resultSummary: 'Preview ready',
    });
  });

  it('restores running work as failed/retryable after app restart without replaying writes', () => {
    const snapshot: AiRequestJob[] = [
      queuedJob({ id: 'running-1', state: 'running', progress: 64 }),
      queuedJob({ id: 'queued-1', state: 'queued', idempotencyKey: 'queued-1', writeIntentId: 'queued-preview' }),
      queuedJob({ id: 'done-1', state: 'succeeded', progress: 100, idempotencyKey: 'done-1', writeIntentId: 'done-preview' }),
    ];

    const state = restoreAiRequestQueueSnapshot(snapshot, { maxJobs: 5, now: () => '2026-06-02T13:00:00.000Z' });

    expect(state.jobs.map(job => [job.id, job.state])).toEqual([
      ['running-1', 'failed'],
      ['queued-1', 'queued'],
      ['done-1', 'succeeded'],
    ]);
    expect(state.jobs[0].error).toContain('interrupted before completion');
    expect(state.jobs[0].progress).toBe(64);
  });

  it('summarizes visible queue state for status UI', () => {
    const state = createAiRequestQueueState({
      initialJobs: [
        queuedJob({ id: 'queued', state: 'queued' }),
        queuedJob({ id: 'running', state: 'running', idempotencyKey: 'running' }),
        queuedJob({ id: 'failed', state: 'failed', idempotencyKey: 'failed' }),
      ],
    });

    expect(selectAiRequestQueueSummary(state)).toEqual({
      total: 3,
      active: 2,
      failed: 1,
      succeeded: 0,
      cancelled: 0,
    });
  });

  it('requires per-session confirmation before enqueueing expensive estimated-cost jobs', () => {
    const expensiveJob = queuedJob({
      id: 'expensive-image-job',
      capability: 'image',
      cost: {
        availability: 'estimated',
        estimatedUsd: 2.25,
        currency: 'USD',
        confirmationThresholdUsd: 1,
      },
      budgetConfirmation: {
        status: 'required',
        scope: 'session',
      },
    });
    let state = createAiRequestQueueState({ now: () => '2026-06-02T12:00:00.000Z' });

    expect(requiresAiJobBudgetConfirmation(expensiveJob)).toBe(true);

    state = aiRequestQueueReducer(state, { type: 'enqueue', job: expensiveJob });
    expect(state.jobs).toHaveLength(0);
    expect(state.rejected).toEqual([
      { jobId: 'expensive-image-job', reason: 'budget-confirmation-required' },
    ]);

    const confirmed = confirmAiJobBudget(expensiveJob, '2026-06-02T12:00:01.000Z');
    state = aiRequestQueueReducer(state, { type: 'enqueue', job: confirmed });

    expect(state.jobs[0]).toMatchObject({
      id: 'expensive-image-job',
      budgetConfirmation: {
        status: 'confirmed',
        confirmedAt: '2026-06-02T12:00:01.000Z',
      },
    });
  });
});
