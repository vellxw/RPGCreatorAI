import { describe, expect, it, vi } from 'vitest';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  DEFAULT_REFINEMENT_BUDGET,
  buildRefinementProviderRequest,
  createMockRefinementExecutor,
  executeRefinementRun,
  isBudgetBlocked,
  makeOfflineRefinementExecutor,
  planRefinementRun,
  shouldRequireUserConfirmation,
  type RefinementDraft,
} from '../refinementPipeline';

const baseDraft: RefinementDraft = {
  id: 'draft-m10-happy',
  workflowId: 'sprite-sheet',
  payload: { action: 'walk', direction: 'down' },
};

describe('refinementPipeline planning', () => {
  it('produces a deterministic plan with the standard phase sequence', () => {
    const plan = planRefinementRun(baseDraft);
    expect(plan.workflowId).toBe('sprite-sheet');
    expect(plan.draftId).toBe('draft-m10-happy');
    expect(plan.phases).toEqual(['plan', 'generate', 'check', 'refine', 'verify', 'accept']);
    expect(plan.totalStepsPlanned).toBe(6);
    expect(plan.budget).toEqual(DEFAULT_REFINEMENT_BUDGET);
  });

  it('respects a custom budget', () => {
    const plan = planRefinementRun(baseDraft, {
      maxSteps: 4,
      maxCostUsd: 0.25,
      maxRefineRounds: 1,
      requireUserConfirmationAbove: 0.1,
      requireUserConfirmationKind: 'image',
    });
    expect(plan.budget.maxRefineRounds).toBe(1);
    expect(plan.budget.maxCostUsd).toBe(0.25);
  });
});

describe('refinementPipeline guard rails', () => {
  it('flags user confirmation when cost exceeds the threshold', () => {
    const result = shouldRequireUserConfirmation(1.0, {
      ...DEFAULT_REFINEMENT_BUDGET,
      requireUserConfirmationAbove: 0.5,
    });
    expect(result.required).toBe(true);
    expect(result.reason).toContain('confirmation threshold');
  });

  it('does not flag user confirmation when cost is at or below the threshold', () => {
    const result = shouldRequireUserConfirmation(0.4, {
      ...DEFAULT_REFINEMENT_BUDGET,
      requireUserConfirmationAbove: 0.5,
    });
    expect(result.required).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('detects budget block from cost or refine rounds', () => {
    const plan = planRefinementRun(baseDraft);
    const overCostRun = {
      id: 'r1',
      plan,
      status: 'running' as const,
      steps: [],
      finalCandidateId: null,
      rejectionReason: null,
      startedAt: '2026-06-02T00:00:00.000Z',
      completedAt: null,
      totalCost: plan.budget.maxCostUsd + 0.1,
      requiresUserConfirmation: false,
      userConfirmationReason: null,
    };
    expect(isBudgetBlocked(overCostRun, plan.budget)).toBe(true);

    const manyRefines = {
      ...overCostRun,
      totalCost: 0,
      status: 'running' as const,
      steps: Array.from({ length: plan.budget.maxRefineRounds + 1 }).map(() => ({
        phase: 'refine' as const,
        qaStatus: 'pass' as const,
        score: 50,
        notes: 'r',
        costEstimate: 0,
        at: '2026-06-02T00:00:00.000Z',
      })),
    };
    expect(isBudgetBlocked(manyRefines, plan.budget)).toBe(true);
  });
});

describe('refinementPipeline run execution', () => {
  it('happy path: every check passes and the run is accepted', async () => {
    const plan = planRefinementRun(baseDraft);
    const executor = createMockRefinementExecutor();
    const run = await executeRefinementRun(plan, executor, { clockStart: '2026-06-02T00:00:00.000Z' });
    expect(run.status).toBe('accepted');
    expect(run.completedAt).not.toBeNull();
    expect(run.steps.length).toBe(6);
    const phases = run.steps.map(step => step.phase);
    expect(phases).toEqual(['plan', 'generate', 'check', 'refine', 'verify', 'accept']);
    expect(run.finalCandidateId).toMatch(/^mock-candidate-/);
    expect(run.totalCost).toBeGreaterThan(0);
  });

  it('caps refine rounds at maxRefineRounds and marks the run as budget-blocked when checks keep failing', async () => {
    const plan = planRefinementRun(baseDraft, {
      ...DEFAULT_REFINEMENT_BUDGET,
      maxRefineRounds: 1,
      maxCostUsd: 10,
    });
    const executor = createMockRefinementExecutor({ alwaysFailCheck: true, alwaysFailVerify: true });
    const run = await executeRefinementRun(plan, executor);
    expect(run.status).toBe('rejected');
    const refineSteps = run.steps.filter(step => step.phase === 'refine');
    expect(refineSteps.length).toBe(1);
  });

  it('blocks when an individual step would push the total cost past the budget', async () => {
    const plan = planRefinementRun(baseDraft, {
      ...DEFAULT_REFINEMENT_BUDGET,
      maxCostUsd: 0.15,
      maxRefineRounds: 5,
    });
    const executor = createMockRefinementExecutor({ costPerStep: 0.1 });
    const run = await executeRefinementRun(plan, executor);
    expect(run.status).toBe('budget-blocked');
    expect(run.totalCost).toBeLessThanOrEqual(plan.budget.maxCostUsd + 0.1);
  });

  it('never calls a live provider — every step uses the offline mock executor', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response()),
    );
    const adapter = createMockProviderAdapter();
    const executeSpy = vi.spyOn(adapter, 'execute');

    const plan = planRefinementRun(baseDraft);
    const executor = makeOfflineRefinementExecutor(adapter);
    const run = await executeRefinementRun(plan, executor);

    expect(run.status).toBe('accepted');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalled();
    for (const call of executeSpy.mock.calls) {
      const request = call[0];
      expect(request.providerId).toBe('local');
      expect(request.modelId).toBe('offline-image-mock');
      expect(JSON.stringify(request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
    }
    fetchSpy.mockRestore();
  });
});

describe('refinementPipeline request builder', () => {
  it('builds an offline image-generate request that targets the local mock', () => {
    const built = buildRefinementProviderRequest(baseDraft, 'generate');
    expect(built.providerId).toBe('local');
    expect(built.modelId).toBe('offline-image-mock');
    expect(built.input?.operation).toBe('image.generate');
    expect(built.input?.fixture).toBe('offline-image');
  });
});
