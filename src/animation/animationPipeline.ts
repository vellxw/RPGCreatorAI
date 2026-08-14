import type { AnimationPackageQaReport, AnimationPackageV1 } from './animationPackage';
import { validateAnimationPackage } from './animationPackage';

export type AnimationPipelineStatus =
  | 'requested'
  | 'generating'
  | 'quarantined'
  | 'normalized'
  | 'review'
  | 'approved'
  | 'frozen'
  | 'packaged'
  | 'rejected'
  | 'failed';

export interface AnimationPipelineProvenance {
  provider?: string;
  model?: string;
  promptHash?: string;
  inputHashes?: readonly string[];
  tool?: string;
  toolVersion?: string;
  license?: string;
  attribution?: string;
}

export interface AnimationPipelineJob {
  id: string;
  status: AnimationPipelineStatus;
  createdAt: string;
  updatedAt: string;
  package?: AnimationPackageV1;
  qa?: AnimationPackageQaReport;
  provenance: AnimationPipelineProvenance;
  warnings: readonly string[];
  error?: string;
}

export interface AnimationPipelineCandidateInput {
  id: string;
  package: AnimationPackageV1;
  provenance?: AnimationPipelineProvenance;
  createdAt?: string;
}

const ALLOWED_TRANSITIONS: Readonly<Record<AnimationPipelineStatus, readonly AnimationPipelineStatus[]>> = {
  requested: ['generating', 'failed'],
  generating: ['quarantined', 'failed'],
  quarantined: ['normalized', 'rejected', 'failed'],
  normalized: ['review', 'rejected', 'failed'],
  review: ['approved', 'rejected', 'failed'],
  approved: ['frozen', 'rejected'],
  frozen: ['packaged'],
  packaged: [],
  rejected: [],
  failed: [],
};

function nowIso(): string {
  return new Date().toISOString();
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Creates a quarantined candidate without mutating project data. */
export function createAnimationPipelineJob(input: AnimationPipelineCandidateInput): AnimationPipelineJob {
  const createdAt = input.createdAt ?? nowIso();
  const qa = validateAnimationPackage(input.package);
  return {
    id: input.id,
    status: qa.valid ? 'quarantined' : 'failed',
    createdAt,
    updatedAt: createdAt,
    package: copy(input.package),
    qa,
    provenance: copy(input.provenance ?? {}),
    warnings: qa.issues.filter(issue => issue.severity === 'warning').map(issue => issue.message),
    ...(qa.valid ? {} : { error: 'Animation package failed validation before review.' }),
  };
}

/**
 * Applies one explicit checkpoint transition. Invalid transitions fail closed;
 * the original job remains untouched so UI review can safely retry or reject.
 */
export function transitionAnimationPipelineJob(
  job: AnimationPipelineJob,
  nextStatus: AnimationPipelineStatus,
  options: { reviewedAt?: string; note?: string } = {},
): AnimationPipelineJob {
  if (!ALLOWED_TRANSITIONS[job.status].includes(nextStatus)) {
    throw new Error(`Animation job "${job.id}" cannot transition ${job.status} → ${nextStatus}.`);
  }
  const updatedAt = options.reviewedAt ?? nowIso();
  const warnings = options.note ? [...job.warnings, options.note] : [...job.warnings];
  return {
    ...copy(job),
    status: nextStatus,
    updatedAt,
    warnings,
    ...(nextStatus === 'rejected' ? { error: options.note ?? 'Rejected during review.' } : {}),
  };
}

export function isAnimationPipelineReleaseReady(job: AnimationPipelineJob): boolean {
  return job.status === 'frozen' || job.status === 'packaged';
}

