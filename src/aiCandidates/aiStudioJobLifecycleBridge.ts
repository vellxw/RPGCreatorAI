import type { AiCandidateLifecycle } from './candidateLifecycle';
import type { CandidatePipelineStatus } from './candidateTypes';
import {
  createAiStudioJob,
  retryAiStudioJob,
  transitionAiStudioJob,
  type AiStudioJob,
  type AiStudioJobResult,
  type AiStudioJobStatus,
  type AiStudioJobTransitionInput,
  type CreateAiStudioJobInput,
} from '../providers/aiStudioJobContracts';

const CANDIDATE_STATUS_TO_JOB: Readonly<Record<CandidatePipelineStatus, Exclude<AiStudioJobStatus, 'rejected'>>> = {
  requested: 'requested',
  generating: 'generating',
  quarantined: 'quarantined',
  normalized: 'quarantined',
  review: 'review',
  approved: 'approved',
  frozen: 'approved',
  packaged: 'approved',
};

export type AiStudioJobCandidateBridgeErrorCode =
  | 'candidate-mismatch'
  | 'candidate-status-mismatch'
  | 'candidate-already-approved';

export type AiStudioJobCandidateBridgeResult =
  | { ok: true; job: AiStudioJob }
  | { ok: false; code: AiStudioJobCandidateBridgeErrorCode; message: string }
  | Exclude<AiStudioJobResult, { ok: true }>;

export function aiStudioJobStatusForCandidate(
  status: CandidatePipelineStatus,
): Exclude<AiStudioJobStatus, 'rejected'> {
  return CANDIDATE_STATUS_TO_JOB[status];
}

export function validateAiStudioJobCandidateLink(
  job: Pick<AiStudioJob, 'candidateId' | 'projectId' | 'status'>,
  candidate: Pick<AiCandidateLifecycle, 'id' | 'projectId' | 'status'>,
): string[] {
  const errors: string[] = [];
  if (job.candidateId !== candidate.id) errors.push('Job candidateId does not match the candidate lifecycle id.');
  if (job.projectId !== candidate.projectId) errors.push('Job and candidate belong to different projects.');
  if (job.status !== 'rejected' && aiStudioJobStatusForCandidate(candidate.status) !== job.status) {
    errors.push(`Job status ${job.status} is not aligned with candidate status ${candidate.status}.`);
  }
  if (job.status === 'rejected' && ['approved', 'frozen', 'packaged'].includes(candidate.status)) {
    errors.push('A rejected job cannot reference an approved candidate lifecycle.');
  }
  return errors;
}

export function createAiStudioJobForCandidate<TOutput, TNormalized>(
  candidate: AiCandidateLifecycle<TOutput, TNormalized>,
  input: Omit<CreateAiStudioJobInput, 'candidateId' | 'projectId' | 'providerId' | 'modelId' | 'operation'>,
): AiStudioJobCandidateBridgeResult {
  if (candidate.status !== 'requested') {
    return { ok: false, code: 'candidate-status-mismatch', message: 'New jobs require a requested candidate lifecycle.' };
  }
  return createAiStudioJob({
    ...input,
    candidateId: candidate.id,
    projectId: candidate.projectId,
    providerId: candidate.provenance.providerId,
    modelId: candidate.provenance.modelId,
    operation: candidate.provenance.operation,
    requestId: input.requestId ?? candidate.provenance.requestId,
  });
}

function candidateCanRepresentTarget(
  candidateStatus: CandidatePipelineStatus,
  target: AiStudioJobStatus,
): boolean {
  if (target === 'rejected') return !['approved', 'frozen', 'packaged'].includes(candidateStatus);
  return aiStudioJobStatusForCandidate(candidateStatus) === target;
}

export function transitionAiStudioJobForCandidate<TOutput, TNormalized>(
  job: AiStudioJob,
  candidate: AiCandidateLifecycle<TOutput, TNormalized>,
  to: AiStudioJobStatus,
  input: AiStudioJobTransitionInput = {},
): AiStudioJobCandidateBridgeResult {
  if (job.candidateId !== candidate.id || job.projectId !== candidate.projectId) {
    return { ok: false, code: 'candidate-mismatch', message: 'Job and candidate identifiers must match.' };
  }
  if (!candidateCanRepresentTarget(candidate.status, to)) {
    return {
      ok: false,
      code: to === 'rejected' ? 'candidate-already-approved' : 'candidate-status-mismatch',
      message: `Candidate status ${candidate.status} cannot represent job status ${to}.`,
    };
  }
  return transitionAiStudioJob(job, to, input);
}

export function retryAiStudioJobForCandidate<TOutput, TNormalized>(
  rejectedJob: AiStudioJob,
  nextCandidate: AiCandidateLifecycle<TOutput, TNormalized>,
  input: { id: string; now?: string; actor?: string; budget?: AiStudioJob['budget'] },
): AiStudioJobCandidateBridgeResult {
  if (nextCandidate.status !== 'requested') {
    return { ok: false, code: 'candidate-status-mismatch', message: 'Retries require a fresh requested candidate lifecycle.' };
  }
  if (nextCandidate.id === rejectedJob.candidateId || nextCandidate.projectId !== rejectedJob.projectId) {
    return { ok: false, code: 'candidate-mismatch', message: 'Retries require a new candidate in the same project.' };
  }
  if (nextCandidate.provenance.providerId !== rejectedJob.providerId ||
      nextCandidate.provenance.modelId !== rejectedJob.modelId ||
      nextCandidate.provenance.operation !== rejectedJob.operation) {
    return { ok: false, code: 'candidate-mismatch', message: 'Retry provenance must match the rejected provider operation.' };
  }
  return retryAiStudioJob(rejectedJob, {
    ...input,
    candidateId: nextCandidate.id,
  });
}
