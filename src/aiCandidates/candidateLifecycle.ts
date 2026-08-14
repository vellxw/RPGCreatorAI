import type {
  CandidateKind,
  CandidatePipelineStatus,
  CandidateProvenance,
  CandidateResourceDiff,
  CandidateValidation,
} from './candidateTypes';

const SHA256 = /^[a-f0-9]{64}$/i;
const UNSAFE_PATH = /(^|[\\/])\.\.([\\/]|$)|^[\\/]|^[A-Za-z]:|[<>:"|?*]|^[a-z][a-z0-9+.-]*:\/\//i;

const ALLOWED_TRANSITIONS: Readonly<Record<CandidatePipelineStatus, readonly CandidatePipelineStatus[]>> = {
  requested: ['generating'],
  generating: ['quarantined'],
  quarantined: ['normalized'],
  normalized: ['review'],
  review: ['approved', 'normalized'],
  approved: ['frozen', 'review'],
  frozen: ['packaged'],
  packaged: [],
};

export interface CandidateLifecycleEvent {
  from: CandidatePipelineStatus;
  to: CandidatePipelineStatus;
  at: string;
  actor: string;
  note?: string;
}

export interface CandidateApproval {
  reviewerId: string;
  reviewedAt: string;
  note?: string;
}

export interface CandidateFrozenArtifact {
  contentHash: string;
  frozenAt: string;
}

export interface CandidatePackageArtifact {
  path: string;
  sha256: string;
  packagedAt: string;
}

export interface AiCandidateLifecycle<TOutput = unknown, TNormalized = TOutput> {
  schemaVersion: 1;
  id: string;
  kind: CandidateKind;
  projectId: string | null;
  status: CandidatePipelineStatus;
  provenance: CandidateProvenance;
  output?: TOutput;
  normalizedOutput?: TNormalized;
  diff: CandidateResourceDiff[];
  validation: CandidateValidation;
  quarantineReasons: string[];
  approval?: CandidateApproval;
  frozenArtifact?: CandidateFrozenArtifact;
  packageArtifact?: CandidatePackageArtifact;
  history: CandidateLifecycleEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCandidateLifecycleInput {
  id: string;
  kind: CandidateKind;
  projectId: string | null;
  provenance: CandidateProvenance;
  now?: string;
}

export interface CandidateTransitionPatch<TOutput = unknown, TNormalized = TOutput> {
  output?: TOutput;
  normalizedOutput?: TNormalized;
  diff?: CandidateResourceDiff[];
  validation?: CandidateValidation;
  quarantineReasons?: string[];
  approval?: CandidateApproval;
  contentHash?: string;
  packageArtifact?: CandidatePackageArtifact;
  actor?: string;
  note?: string;
  now?: string;
}

export type CandidateLifecycleErrorCode =
  | 'transition-denied'
  | 'invalid-provenance'
  | 'missing-output'
  | 'invalid-validation'
  | 'invalid-diff'
  | 'missing-approval'
  | 'invalid-hash'
  | 'invalid-package';

export type CandidateLifecycleResult<TOutput = unknown, TNormalized = TOutput> =
  | { ok: true; candidate: AiCandidateLifecycle<TOutput, TNormalized> }
  | { ok: false; code: CandidateLifecycleErrorCode; message: string };

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function isSafeRelativePath(path: string): boolean {
  const normalized = path.trim();
  return normalized.length > 0 && !UNSAFE_PATH.test(normalized);
}

function hasCompleteProvenance(provenance: CandidateProvenance): boolean {
  return [provenance.providerId, provenance.modelId, provenance.operation, provenance.createdAt]
    .every(value => typeof value === 'string' && value.trim().length > 0);
}

export interface ValidateCandidateResourceDiffOptions {
  /**
   * Frozen/package lifecycle checkpoints require content hashes. Editor
   * review diffs may validate their paths and shape before files exist.
   */
  requireIntegrityHashes?: boolean;
}

export function validateCandidateResourceDiff(
  diff: readonly CandidateResourceDiff[],
  options: ValidateCandidateResourceDiffOptions = {},
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const requireIntegrityHashes = options.requireIntegrityHashes ?? true;
  diff.forEach((entry, index) => {
    const label = `diff[${index}]`;
    if (!isSafeRelativePath(entry.path)) errors.push(`${label}.path must be a safe project-relative path.`);
    if (seen.has(entry.path)) errors.push(`${label}.path duplicates another resource change.`);
    seen.add(entry.path);
    if (!entry.summary.trim()) errors.push(`${label}.summary is required.`);
    if (entry.beforeHash && !SHA256.test(entry.beforeHash)) errors.push(`${label}.beforeHash must be SHA-256.`);
    if (entry.afterHash && !SHA256.test(entry.afterHash)) errors.push(`${label}.afterHash must be SHA-256.`);
    if (requireIntegrityHashes && entry.kind === 'add' && !entry.afterHash) errors.push(`${label}.afterHash is required for add.`);
    if (requireIntegrityHashes && entry.kind === 'delete' && !entry.beforeHash) errors.push(`${label}.beforeHash is required for delete.`);
    if (requireIntegrityHashes && entry.kind === 'modify') {
      if (!entry.beforeHash || !entry.afterHash) errors.push(`${label} requires beforeHash and afterHash for modify.`);
      if (entry.beforeHash && entry.beforeHash === entry.afterHash) errors.push(`${label} does not describe a material change.`);
    }
  });
  return errors;
}

export function createCandidateLifecycle<TOutput = unknown, TNormalized = TOutput>(
  input: CreateCandidateLifecycleInput,
): CandidateLifecycleResult<TOutput, TNormalized> {
  if (!hasCompleteProvenance(input.provenance)) {
    return { ok: false, code: 'invalid-provenance', message: 'Provider, model, operation and createdAt are required.' };
  }
  const now = nowIso(input.now);
  return {
    ok: true,
    candidate: {
      schemaVersion: 1,
      id: input.id,
      kind: input.kind,
      projectId: input.projectId,
      status: 'requested',
      provenance: { ...input.provenance, sourceAssetIds: [...(input.provenance.sourceAssetIds ?? [])] },
      diff: [],
      validation: { errors: [], warnings: [] },
      quarantineReasons: [],
      history: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

function fail(code: CandidateLifecycleErrorCode, message: string): CandidateLifecycleResult<never, never> {
  return { ok: false, code, message };
}

export function transitionCandidateLifecycle<TOutput, TNormalized>(
  candidate: AiCandidateLifecycle<TOutput, TNormalized>,
  to: CandidatePipelineStatus,
  patch: CandidateTransitionPatch<TOutput, TNormalized> = {},
): CandidateLifecycleResult<TOutput, TNormalized> {
  if (!ALLOWED_TRANSITIONS[candidate.status].includes(to)) {
    return fail('transition-denied', `Transition ${candidate.status} -> ${to} is not allowed.`);
  }
  if (!hasCompleteProvenance(candidate.provenance)) {
    return fail('invalid-provenance', 'Candidate provenance is incomplete.');
  }

  const output = patch.output ?? candidate.output;
  const normalizedOutput = patch.normalizedOutput ?? candidate.normalizedOutput;
  const validation = patch.validation ?? candidate.validation;
  const diff = patch.diff ? patch.diff.map(entry => ({ ...entry })) : candidate.diff;

  if (to === 'quarantined' && output === undefined) {
    return fail('missing-output', 'Generated output must enter quarantine before normalization.');
  }
  if (to === 'normalized' && normalizedOutput === undefined) {
    return fail('missing-output', 'Normalized output is required.');
  }
  if ((to === 'normalized' || to === 'review' || to === 'approved') && validation.errors.length > 0) {
    return fail('invalid-validation', 'Unresolved validation errors block this transition.');
  }
  if (to === 'review') {
    const diffErrors = validateCandidateResourceDiff(diff);
    if (diff.length === 0 || diffErrors.length > 0) {
      return fail('invalid-diff', diffErrors[0] ?? 'At least one resource change is required for review.');
    }
  }
  if (to === 'approved' && (!patch.approval?.reviewerId.trim() || !patch.approval.reviewedAt.trim())) {
    return fail('missing-approval', 'Explicit reviewer identity and timestamp are required.');
  }
  if (to === 'frozen' && (!patch.contentHash || !SHA256.test(patch.contentHash))) {
    return fail('invalid-hash', 'A SHA-256 content hash is required to freeze a candidate.');
  }
  if (to === 'packaged') {
    const artifact = patch.packageArtifact;
    if (!artifact || !isSafeRelativePath(artifact.path) || !SHA256.test(artifact.sha256)) {
      return fail('invalid-package', 'A safe package path and SHA-256 hash are required.');
    }
  }

  const now = nowIso(patch.now);
  const next: AiCandidateLifecycle<TOutput, TNormalized> = {
    ...candidate,
    status: to,
    output,
    normalizedOutput,
    validation: { errors: [...validation.errors], warnings: [...validation.warnings] },
    diff,
    quarantineReasons: [...(patch.quarantineReasons ?? candidate.quarantineReasons)],
    approval: to === 'approved' ? { ...patch.approval! } : candidate.approval,
    frozenArtifact: to === 'frozen'
      ? { contentHash: patch.contentHash!, frozenAt: now }
      : candidate.frozenArtifact,
    packageArtifact: to === 'packaged' ? { ...patch.packageArtifact! } : candidate.packageArtifact,
    history: [
      ...candidate.history,
      {
        from: candidate.status,
        to,
        at: now,
        actor: patch.actor?.trim() || 'system',
        note: patch.note,
      },
    ],
    updatedAt: now,
  };
  return { ok: true, candidate: next };
}

export function isCandidateReleaseReady(candidate: AiCandidateLifecycle): boolean {
  return candidate.status === 'packaged'
    && Boolean(candidate.approval)
    && Boolean(candidate.frozenArtifact)
    && Boolean(candidate.packageArtifact)
    && candidate.validation.errors.length === 0
    && candidate.diff.length > 0;
}
