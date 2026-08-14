import type { ProjectAction } from '../stores/projectStore';

export type CandidateKind =
  | 'map-draft'
  | 'event-draft'
  | 'event-commands'
  | 'database-draft-actor'
  | 'database-draft-item'
  | 'asset-draft'
  | 'validation-repair'
  | 'balancing'
  | 'quest-draft';

export type CandidateReviewState = 'draft' | 'review' | 'accepted' | 'rejected' | 'expired';

export interface CandidateProvenance {
  providerId: string;
  modelId: string;
  operation: string;
  promptTemplateId?: string;
  promptTemplateVersion?: number;
  requestId?: string;
  promptHash?: string;
  outputHash?: string;
  sourceAssetIds?: string[];
  license?: string;
  consent?: string;
  createdAt: string;
}

export type CandidatePipelineStatus =
  | 'requested'
  | 'generating'
  | 'quarantined'
  | 'normalized'
  | 'review'
  | 'approved'
  | 'frozen'
  | 'packaged';

export type CandidateResourceChangeKind = 'add' | 'modify' | 'delete';

export interface CandidateResourceDiff {
  path: string;
  kind: CandidateResourceChangeKind;
  summary: string;
  beforeHash?: string;
  afterHash?: string;
}

export interface CandidateValidation {
  errors: string[];
  warnings: string[];
}

export interface CandidatePayload {
  summary: string;
  applyActions: ProjectAction[];
  output: unknown;
}

export interface Candidate {
  id: string;
  kind: CandidateKind;
  title: string;
  payload: CandidatePayload;
  provenance: CandidateProvenance;
  reviewState: CandidateReviewState;
  validation: CandidateValidation;
  /** Concrete project resources shown to the reviewer before commit. */
  resourceDiff: CandidateResourceDiff[];
  projectId: string | null;
  historyRecordId: string | null;
  reviewedAt?: string;
  reviewerNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type CandidateStoreError =
  | 'already-resolved'
  | 'missing-apply-actions'
  | 'missing-diff'
  | 'invalid-diff'
  | 'missing-lineage'
  | 'invalid-validation'
  | 'unknown-candidate'
  | 'commit-failed'
  | 'blocked-by-provenance';

export interface CandidateReviewEvent {
  candidateId: string;
  previousState: CandidateReviewState;
  nextState: CandidateReviewState;
  reviewerNote?: string;
  reviewedAt: string;
}

export interface CandidateStoreState {
  candidates: Candidate[];
  events: CandidateReviewEvent[];
  maxCandidates: number;
}

export const CANDIDATE_REVIEWABLE_STATES: ReadonlyArray<CandidateReviewState> = ['draft', 'review'];

export const CANDIDATE_TERMINAL_STATES: ReadonlyArray<CandidateReviewState> = [
  'accepted',
  'rejected',
  'expired',
];

export function isCandidateReviewable(candidate: Candidate): boolean {
  return CANDIDATE_REVIEWABLE_STATES.includes(candidate.reviewState);
}

export function isCandidateTerminal(candidate: Candidate): boolean {
  return CANDIDATE_TERMINAL_STATES.includes(candidate.reviewState);
}

export function isCandidateAccepted(candidate: Candidate): boolean {
  return candidate.reviewState === 'accepted';
}
