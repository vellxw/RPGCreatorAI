import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ReactElement } from 'react';
import { AICandidateReviewPanel } from '../AICandidateReviewPanel';
import type { Candidate } from '../../../aiCandidates/candidateTypes';

const NOW = '2026-06-17T00:00:00.000Z';

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'cand-1',
    kind: 'event-draft',
    title: 'Bridge event',
    payload: {
      summary: 'Adds a bridge event on the active map.',
      applyActions: [
        {
          type: 'ADD_EVENT',
          mapId: 'map-a',
          event: { id: 'ev-1', type: 'npc', x: 0, y: 0, solid: false, commands: [], trigger: 'interact' },
        },
      ],
      output: { eventId: 'ev-1' },
    },
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      operation: 'event-draft',
      createdAt: NOW,
    },
    reviewState: 'review',
    validation: { errors: [], warnings: [] },
    projectId: 'p1',
    historyRecordId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function renderPanel(ui: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
}

const containers: HTMLElement[] = [];

afterEach(() => {
  for (const c of containers.splice(0)) {
    c.remove();
  }
});

describe('AICandidateReviewPanel', () => {
  it('renders the empty state when there are no candidates', () => {
    const { container, unmount } = renderPanel(<AICandidateReviewPanel candidates={[]} />);
    const empty = container.querySelector('[data-testid="ai-candidate-review-panel-empty"]');
    expect(empty).not.toBeNull();
    unmount();
  });

  it('shows the reviewable candidate with accept/reject affordances and fires callbacks', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const candidate = makeCandidate();
    const { container, unmount } = renderPanel(
      <AICandidateReviewPanel
        candidates={[candidate]}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );
    const accept = container.querySelector<HTMLButtonElement>('[data-testid="ai-candidate-accept"]');
    const reject = container.querySelector<HTMLButtonElement>('[data-testid="ai-candidate-reject"]');
    expect(accept).not.toBeNull();
    expect(reject).not.toBeNull();
    expect(accept?.getAttribute('data-candidate-id')).toBe('cand-1');
    expect(accept?.getAttribute('type')).toBe('button');
    expect(reject?.getAttribute('type')).toBe('button');
    accept?.click();
    reject?.click();
    expect(onAccept).toHaveBeenCalledWith('cand-1');
    expect(onReject).toHaveBeenCalledWith('cand-1');
    unmount();
  });

  it('hides accept affordance when the candidate has validation errors', () => {
    const candidate = makeCandidate({ validation: { errors: ['bad ref'], warnings: [] } });
    const { container, unmount } = renderPanel(
      <AICandidateReviewPanel candidates={[candidate]} onAccept={vi.fn()} />,
    );
    const accept = container.querySelector<HTMLButtonElement>('[data-testid="ai-candidate-accept"]');
    expect(accept?.hasAttribute('disabled')).toBe(true);
    unmount();
  });

  it('does not show accept/reject for terminal-state candidates', () => {
    const candidate = makeCandidate({ reviewState: 'accepted' });
    const { container, unmount } = renderPanel(
      <AICandidateReviewPanel candidates={[candidate]} onAccept={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="ai-candidate-accept"]')).toBeNull();
    unmount();
  });

  it('renders resolved candidates inside a collapsible details', () => {
    const accepted = makeCandidate({ id: 'a', reviewState: 'accepted', reviewerNote: 'good' });
    const rejected = makeCandidate({ id: 'b', reviewState: 'rejected' });
    const { container, unmount } = renderPanel(
      <AICandidateReviewPanel candidates={[accepted, rejected]} onAccept={vi.fn()} />,
    );
    const resolved = container.querySelector('[data-testid="ai-candidate-review-panel-resolved"]');
    expect(resolved).not.toBeNull();
    const note = container.querySelector('[data-testid="ai-candidate-reviewer-note"]')?.textContent;
    expect(note).toBe('good');
    unmount();
  });

  it('keeps the panel inert by default: no provider, store, or programmatic navigation calls', () => {
    const candidate = makeCandidate();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response()));
    try {
      const { unmount } = renderPanel(
        <AICandidateReviewPanel
          candidates={[candidate]}
          onAccept={vi.fn()}
          onReject={vi.fn()}
        />,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      unmount();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
