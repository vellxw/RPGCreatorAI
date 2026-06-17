import type { ProviderAdapterRequest } from './providerAdapter';
import { createMockProviderAdapter } from './mockProviderAdapter';

export type RefinementPhase =
  | 'plan'
  | 'generate'
  | 'check'
  | 'refine'
  | 'verify'
  | 'accept'
  | 'reject'
  | 'budget-blocked';

export type RefinementStatus =
  | 'pending'
  | 'running'
  | 'accepted'
  | 'rejected'
  | 'budget-blocked';

export interface RefinementBudget {
  maxSteps: number;
  maxCostUsd: number;
  maxRefineRounds: number;
  requireUserConfirmationAbove: number;
  requireUserConfirmationKind: 'image' | 'any';
}

export const DEFAULT_REFINEMENT_BUDGET: RefinementBudget = {
  maxSteps: 8,
  maxCostUsd: 1.5,
  maxRefineRounds: 2,
  requireUserConfirmationAbove: 0.75,
  requireUserConfirmationKind: 'image',
};

export interface RefinementPlan {
  workflowId: string;
  draftId: string;
  totalStepsPlanned: number;
  budget: RefinementBudget;
  phases: ReadonlyArray<RefinementPhase>;
}

export interface RefinementStep {
  phase: RefinementPhase;
  qaStatus: 'pass' | 'warning' | 'fail' | 'skipped';
  score: number;
  notes: string;
  costEstimate: number;
  at: string;
  refineRound?: number;
}

export interface RefinementDraft {
  id: string;
  workflowId: string;
  payload: Record<string, unknown>;
}

export interface RefinementExecutorInput {
  phase: RefinementPhase;
  draft: RefinementDraft;
  refineRound: number;
  lastFailure?: string;
}

export interface RefinementExecutorOutput {
  qaStatus: 'pass' | 'warning' | 'fail';
  score: number;
  notes: string;
  costEstimate: number;
  candidateId?: string;
  shouldRefine?: boolean;
}

export type RefinementExecutor = (
  input: RefinementExecutorInput,
) => Promise<RefinementExecutorOutput>;

export interface RefinementRun {
  id: string;
  plan: RefinementPlan;
  status: RefinementStatus;
  steps: ReadonlyArray<RefinementStep>;
  finalCandidateId: string | null;
  rejectionReason: string | null;
  startedAt: string;
  completedAt: string | null;
  totalCost: number;
  requiresUserConfirmation: boolean;
  userConfirmationReason: string | null;
}

const STANDARD_PHASES: ReadonlyArray<RefinementPhase> = Object.freeze([
  'plan',
  'generate',
  'check',
  'refine',
  'verify',
  'accept',
]);

export function planRefinementRun(
  draft: RefinementDraft,
  budget: RefinementBudget = DEFAULT_REFINEMENT_BUDGET,
): RefinementPlan {
  const phases: RefinementPhase[] = [...STANDARD_PHASES];
  return {
    workflowId: draft.workflowId,
    draftId: draft.id,
    totalStepsPlanned: phases.length,
    budget,
    phases: Object.freeze(phases) as ReadonlyArray<RefinementPhase>,
  };
}

export function shouldRequireUserConfirmation(
  costEstimate: number,
  budget: RefinementBudget,
): { required: boolean; reason: string | null } {
  if (costEstimate > budget.requireUserConfirmationAbove) {
    return {
      required: true,
      reason: `Estimated cost $${costEstimate.toFixed(2)} exceeds the $${budget.requireUserConfirmationAbove.toFixed(2)} confirmation threshold.`,
    };
  }
  return { required: false, reason: null };
}

export function isBudgetBlocked(
  run: Pick<RefinementRun, 'steps' | 'status' | 'totalCost' | 'plan'>,
  budget: RefinementBudget = run.plan.budget,
): boolean {
  if (run.status === 'budget-blocked') return true;
  if (run.steps.length > budget.maxSteps) return true;
  if (run.totalCost > budget.maxCostUsd) return true;
  const refineSteps = run.steps.filter(step => step.phase === 'refine');
  if (refineSteps.length > budget.maxRefineRounds) return true;
  return false;
}

async function runStep(
  run: RefinementRun,
  phase: RefinementPhase,
  executor: RefinementExecutor,
  refineRound: number,
  lastFailure: string | undefined,
  now: () => string,
): Promise<{ run: RefinementRun; step: RefinementStep }> {
  const draft: RefinementDraft = {
    id: run.plan.draftId,
    workflowId: run.plan.workflowId,
    payload: { refineRound, lastFailure },
  };
  const result = await executor({ phase, draft, refineRound, lastFailure });
  const step: RefinementStep = {
    phase,
    qaStatus: result.qaStatus,
    score: result.score,
    notes: result.notes,
    costEstimate: result.costEstimate,
    at: now(),
    refineRound: phase === 'refine' ? refineRound : undefined,
  };
  const nextSteps = [...run.steps, step];
  const nextRun: RefinementRun = {
    ...run,
    steps: nextSteps,
    totalCost: run.totalCost + result.costEstimate,
    finalCandidateId: result.candidateId ?? run.finalCandidateId,
  };
  return { run: nextRun, step };
}

export async function executeRefinementRun(
  plan: RefinementPlan,
  executor: RefinementExecutor,
  options: { id?: string; now?: () => string; clockStart?: string } = {},
): Promise<RefinementRun> {
  const id = options.id ?? `run-${plan.draftId}-${Date.now()}`;
  const now = options.now ?? (() => new Date().toISOString());
  const startedAt = options.clockStart ?? now();
  let run: RefinementRun = {
    id,
    plan,
    status: 'running',
    steps: [],
    finalCandidateId: null,
    rejectionReason: null,
    startedAt,
    completedAt: null,
    totalCost: 0,
    requiresUserConfirmation: false,
    userConfirmationReason: null,
  };
  let refineRound = 0;
  let lastFailure: string | undefined;

  for (const phase of plan.phases) {
    if (run.status === 'budget-blocked' || run.status === 'rejected') break;
    if (phase === 'refine' && refineRound >= plan.budget.maxRefineRounds + 1) {
      const step: RefinementStep = {
        phase: 'budget-blocked',
        qaStatus: 'skipped',
        score: 0,
        notes: `Refine round ${refineRound + 1} skipped — reached maxRefineRounds=${plan.budget.maxRefineRounds}.`,
        costEstimate: 0,
        at: now(),
      };
      run = {
        ...run,
        status: 'budget-blocked',
        steps: [...run.steps, step],
        completedAt: now(),
      };
      break;
    }
    const { run: nextRun, step } = await runStep(run, phase, executor, refineRound, lastFailure, now);
    run = nextRun;
    if (step.costEstimate > plan.budget.maxCostUsd - (run.totalCost - step.costEstimate)) {
      const blockStep: RefinementStep = {
        phase: 'budget-blocked',
        qaStatus: 'skipped',
        score: 0,
        notes: `Step ${phase} would push total cost $${run.totalCost.toFixed(2)} past budget $${plan.budget.maxCostUsd.toFixed(2)}.`,
        costEstimate: 0,
        at: now(),
      };
      run = {
        ...run,
        status: 'budget-blocked',
        steps: [...run.steps, blockStep],
        completedAt: now(),
      };
      break;
    }
    const confirmation = shouldRequireUserConfirmation(step.costEstimate, plan.budget);
    if (confirmation.required) {
      run = {
        ...run,
        requiresUserConfirmation: true,
        userConfirmationReason: confirmation.reason,
      };
    }
    if (phase === 'check' && step.qaStatus === 'fail') {
      lastFailure = step.notes;
      refineRound += 1;
    } else if (phase === 'refine') {
      refineRound += 1;
    } else if (phase === 'verify' && step.qaStatus === 'fail') {
      run = {
        ...run,
        status: 'rejected',
        rejectionReason: step.notes,
        steps: [
          ...run.steps,
          {
            phase: 'reject',
            qaStatus: 'fail',
            score: 0,
            notes: `Verify failed: ${step.notes}`,
            costEstimate: 0,
            at: now(),
          },
        ],
        completedAt: now(),
      };
      break;
    } else if (phase === 'accept' && step.qaStatus === 'pass') {
      run = {
        ...run,
        status: 'accepted',
        completedAt: now(),
      };
    }
  }

  if (run.status === 'running') {
    run = { ...run, status: 'rejected', rejectionReason: 'Run did not reach an accept step.', completedAt: now() };
  }
  return run;
}

export function createMockRefinementExecutor(
  options: { alwaysFailCheck?: boolean; alwaysFailVerify?: boolean; costPerStep?: number } = {},
): RefinementExecutor {
  const costPerStep = options.costPerStep ?? 0.1;
  let candidateCounter = 0;
  return async ({ phase, refineRound }) => {
    switch (phase) {
      case 'plan':
        return { qaStatus: 'pass', score: 100, notes: 'Plan drafted.', costEstimate: 0 };
      case 'generate':
        candidateCounter += 1;
        return {
          qaStatus: 'pass',
          score: 80,
          notes: `Generated candidate ${candidateCounter}.`,
          costEstimate: costPerStep,
          candidateId: `mock-candidate-${candidateCounter}`,
        };
      case 'check':
        if (options.alwaysFailCheck) {
          return {
            qaStatus: 'fail',
            score: 30,
            notes: 'QA check failed (fixture).',
            costEstimate: 0,
            shouldRefine: true,
          };
        }
        return { qaStatus: 'pass', score: 95, notes: 'QA checks passed.', costEstimate: 0 };
      case 'refine':
        return {
          qaStatus: 'pass',
          score: 85,
          notes: `Refined (round ${refineRound}).`,
          costEstimate: costPerStep,
        };
      case 'verify':
        if (options.alwaysFailVerify) {
          return {
            qaStatus: 'fail',
            score: 25,
            notes: 'Verify failed (fixture).',
            costEstimate: 0,
          };
        }
        return { qaStatus: 'pass', score: 100, notes: 'Verify passed.', costEstimate: 0 };
      case 'accept':
        return { qaStatus: 'pass', score: 100, notes: 'Accepted.', costEstimate: 0 };
      default:
        return { qaStatus: 'skipped' as 'pass', score: 0, notes: `Skipped ${phase}.`, costEstimate: 0 };
    }
  };
}

export interface ProviderRequestFromRefinement {
  input: ProviderAdapterRequest['input'];
  providerId: string;
  modelId: string;
}

export function buildRefinementProviderRequest(
  draft: RefinementDraft,
  phase: RefinementPhase,
): ProviderRequestFromRefinement {
  return {
    input: {
      operation: 'image.generate',
      prompt: `Refinement phase: ${phase} for draft ${draft.id}`,
      fixture: 'offline-image',
    },
    providerId: 'local',
    modelId: 'offline-image-mock',
  };
}

export function makeOfflineRefinementExecutor(
  adapter: ReturnType<typeof createMockProviderAdapter> = createMockProviderAdapter(),
): RefinementExecutor {
  return async ({ phase, draft, refineRound }) => {
    if (phase === 'generate') {
      const request = buildRefinementProviderRequest(draft, phase);
      await adapter.execute({
        id: `refine-${draft.id}-${Date.now()}`,
        createdAt: new Date().toISOString(),
        operation: 'image.generate',
        providerId: request.providerId,
        modelId: request.modelId,
        prompt: 'mock prompt',
        input: request.input,
      });
      return {
        qaStatus: 'pass',
        score: 90,
        notes: `Offline mock generated for ${phase} round ${refineRound}.`,
        costEstimate: 0.05,
        candidateId: `offline-${draft.id}-${refineRound}`,
      };
    }
    return { qaStatus: 'pass', score: 80, notes: `Offline phase ${phase} ok.`, costEstimate: 0 };
  };
}
