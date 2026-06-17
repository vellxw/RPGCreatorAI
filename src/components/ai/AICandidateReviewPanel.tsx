import type { ReactNode } from 'react';
import {
  isCandidateReviewable,
  type Candidate,
  type CandidateKind,
  type CandidateReviewState,
} from '../../aiCandidates/candidateTypes';

export interface AICandidateReviewPanelProps {
  candidates: ReadonlyArray<Candidate>;
  onAccept?: (candidateId: string) => void;
  onReject?: (candidateId: string) => void;
  onSelectCandidate?: (candidateId: string) => void;
  emptyMessage?: string;
}

const STATE_LABEL: Record<CandidateReviewState, string> = {
  draft: 'Draft',
  review: 'In review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

const KIND_LABEL: Record<CandidateKind, string> = {
  'map-draft': 'Map draft',
  'event-draft': 'Event draft',
  'event-commands': 'Event commands',
  'database-draft-actor': 'Actor draft',
  'database-draft-item': 'Item draft',
  'asset-draft': 'Asset draft',
  'validation-repair': 'Validation repair',
  balancing: 'Balancing',
  'quest-draft': 'Quest draft',
};

function reviewStateToAIActionCardState(
  reviewState: CandidateReviewState,
  hasErrors: boolean,
): 'pending' | 'valid' | 'invalid' | 'applied' | 'rejected' {
  if (reviewState === 'accepted') return 'applied';
  if (reviewState === 'rejected') return 'rejected';
  if (reviewState === 'expired') return 'invalid';
  if (hasErrors) return 'invalid';
  return 'pending';
}

function toAIActionCardKind(kind: CandidateKind): string {
  if (kind === 'database-draft-actor' || kind === 'database-draft-item') return 'database-draft';
  if (kind === 'quest-draft') return 'map-draft';
  return kind;
}

function formatProvenance(candidate: Candidate): string {
  const provider = candidate.provenance.providerId;
  const model = candidate.provenance.modelId;
  return `${provider} · ${model}`;
}

export function AICandidateReviewPanel({
  candidates,
  onAccept,
  onReject,
  onSelectCandidate,
  emptyMessage = 'No AI candidates waiting for review.',
}: AICandidateReviewPanelProps): ReactNode {
  const reviewable = candidates.filter(c => c.reviewState === 'draft' || c.reviewState === 'review');
  const resolved = candidates.filter(
    c => c.reviewState === 'accepted' || c.reviewState === 'rejected' || c.reviewState === 'expired',
  );

  return (
    <section
      data-testid="ai-candidate-review-panel"
      data-reviewable-count={reviewable.length}
      data-resolved-count={resolved.length}
      aria-label="AI candidate review"
    >
      <header className="ai-candidate-review-panel__header">
        <h2>Candidate review</h2>
        <p className="ai-candidate-review-panel__intro">
          Drafts only. Nothing is written to your project until you accept a candidate.
        </p>
      </header>

      {candidates.length === 0 ? (
        <p
          className="ai-candidate-review-panel__empty"
          data-testid="ai-candidate-review-panel-empty"
        >
          {emptyMessage}
        </p>
      ) : null}

      {reviewable.length > 0 ? (
        <ul
          className="ai-candidate-review-panel__list ai-candidate-review-panel__list--reviewable"
          data-testid="ai-candidate-review-panel-reviewable"
        >
          {reviewable.map(candidate => {
            const cardState = reviewStateToAIActionCardState(
              candidate.reviewState,
              candidate.validation.errors.length > 0,
            );
            return (
              <li
                key={candidate.id}
                data-candidate-id={candidate.id}
                data-review-state={candidate.reviewState}
              >
                <article
                  data-testid="ai-candidate-card"
                  data-kind={candidate.kind}
                  data-review-state={candidate.reviewState}
                  data-candidate-id={candidate.id}
                  onClick={() => onSelectCandidate?.(candidate.id)}
                >
                  <header>
                    <span data-testid="ai-candidate-kind">{KIND_LABEL[candidate.kind]}</span>
                    <h3>{candidate.title}</h3>
                    <p data-testid="ai-candidate-summary">{candidate.payload.summary}</p>
                    <p data-testid="ai-candidate-provenance">
                      {formatProvenance(candidate)} · {STATE_LABEL[candidate.reviewState]}
                    </p>
                  </header>
                  {candidate.validation.errors.length > 0 ? (
                    <ul
                      data-testid="ai-candidate-errors"
                      className="ai-candidate-card__errors"
                    >
                      {candidate.validation.errors.map(err => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  ) : null}
                  {candidate.validation.warnings.length > 0 ? (
                    <ul
                      data-testid="ai-candidate-warnings"
                      className="ai-candidate-card__warnings"
                    >
                      {candidate.validation.warnings.map(warn => (
                        <li key={warn}>{warn}</li>
                      ))}
                    </ul>
                  ) : null}
                  <footer>
                    <button
                      type="button"
                      data-testid="ai-candidate-accept"
                      data-action="accept"
                      data-candidate-id={candidate.id}
                      data-state={cardState}
                      disabled={
                        !isCandidateReviewable(candidate) ||
                        candidate.validation.errors.length > 0
                      }
                      onClick={event => {
                        event.stopPropagation();
                        onAccept?.(candidate.id);
                      }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      data-testid="ai-candidate-reject"
                      data-action="reject"
                      data-candidate-id={candidate.id}
                      disabled={!isCandidateReviewable(candidate)}
                      onClick={event => {
                        event.stopPropagation();
                        onReject?.(candidate.id);
                      }}
                    >
                      Reject
                    </button>
                    <span data-testid="ai-candidate-card-state" data-state={cardState} hidden>
                      {cardState}
                    </span>
                    <span data-testid="ai-candidate-card-kind-mapped" data-kind-mapped={toAIActionCardKind(candidate.kind)} hidden>
                      {toAIActionCardKind(candidate.kind)}
                    </span>
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}

      {resolved.length > 0 ? (
        <details
          className="ai-candidate-review-panel__resolved"
          data-testid="ai-candidate-review-panel-resolved"
        >
          <summary>
            {resolved.length === 1
              ? '1 resolved candidate'
              : `${resolved.length} resolved candidates`}
          </summary>
          <ul data-testid="ai-candidate-review-panel-resolved-list">
            {resolved.map(candidate => (
              <li
                key={candidate.id}
                data-candidate-id={candidate.id}
                data-review-state={candidate.reviewState}
              >
                <strong>{candidate.title}</strong>
                <span data-state={candidate.reviewState}>{STATE_LABEL[candidate.reviewState]}</span>
                {candidate.reviewerNote ? (
                  <p data-testid="ai-candidate-reviewer-note">{candidate.reviewerNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
