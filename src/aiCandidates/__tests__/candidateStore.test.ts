import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_STORE_INITIAL,
  candidateStoreReducer,
  tryAcceptCandidate,
  tryRejectCandidate,
} from '../candidateStore';
import { makeCandidateId } from '../candidateStore';
import type { Candidate } from '../candidateTypes';
import type { ProjectAction } from '../../stores/projectStore';

const FIXED_NOW = '2026-06-17T00:00:00.000Z';

function buildCandidate(overrides: Partial<Candidate> = {}): Candidate {
  const applyActions: ProjectAction[] = [
    {
      type: 'ADD_EVENT',
      mapId: 'map-a',
      event: {
        id: 'ev-1',
        type: 'npc',
        x: 0,
        y: 0,
        solid: false,
        commands: [],
        trigger: 'interact',
      },
    },
  ];
  return {
    id: makeCandidateId('test'),
    kind: 'event-draft',
    title: 'Auto event',
    payload: {
      summary: 'Adds an event to the active map.',
      applyActions,
      output: { eventId: 'ev-1' },
    },
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      operation: 'event-draft',
      createdAt: FIXED_NOW,
    },
    reviewState: 'review',
    validation: { errors: [], warnings: [] },
    resourceDiff: [{
      path: 'data/maps/map-a.json',
      kind: 'modify',
      summary: 'Add event ev-1.',
    }],
    projectId: 'project-1',
    historyRecordId: 'ai-studio:test-candidate',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

describe('candidateStoreReducer', () => {
  it('adds a candidate, sorts by createdAt, and updates timestamps', () => {
    const c1 = buildCandidate({ id: 'a', createdAt: '2026-06-17T00:00:01.000Z' });
    const c2 = buildCandidate({ id: 'b', createdAt: '2026-06-17T00:00:02.000Z' });
    const after1 = candidateStoreReducer(CANDIDATE_STORE_INITIAL, { type: 'add', candidate: c1, now: FIXED_NOW });
    const after2 = candidateStoreReducer(after1, { type: 'add', candidate: c2, now: FIXED_NOW });
    expect(after2.candidates.map(c => c.id)).toEqual(['a', 'b']);
    expect(after2.candidates[0].updatedAt).toBe(FIXED_NOW);
  });

  it('marks a draft candidate as in-review', () => {
    const c = buildCandidate({ reviewState: 'draft' });
    const after = candidateStoreReducer(
      { ...CANDIDATE_STORE_INITIAL, candidates: [c] },
      { type: 'mark-review', candidateId: c.id, now: FIXED_NOW },
    );
    expect(after.candidates[0].reviewState).toBe('review');
  });

  it('refuses to mark-review a candidate that is no longer a draft', () => {
    const c = buildCandidate({ reviewState: 'accepted' });
    const after = candidateStoreReducer(
      { ...CANDIDATE_STORE_INITIAL, candidates: [c] },
      { type: 'mark-review', candidateId: c.id, now: FIXED_NOW },
    );
    expect(after).toEqual({ ...CANDIDATE_STORE_INITIAL, candidates: [c] });
  });

  it('sets validation, updates updatedAt, leaves reviewState alone', () => {
    const c = buildCandidate();
    const after = candidateStoreReducer(
      { ...CANDIDATE_STORE_INITIAL, candidates: [c] },
      {
        type: 'set-validation',
        candidateId: c.id,
        validation: { errors: ['bad'], warnings: [] },
        now: FIXED_NOW,
      },
    );
    expect(after.candidates[0].validation.errors).toEqual(['bad']);
    expect(after.candidates[0].reviewState).toBe('review');
  });

  it('clear-resolved drops only accepted/rejected/expired candidates', () => {
    const accepted = buildCandidate({ id: 'a', reviewState: 'accepted' });
    const rejected = buildCandidate({ id: 'b', reviewState: 'rejected' });
    const draft = buildCandidate({ id: 'c', reviewState: 'draft' });
    const review = buildCandidate({ id: 'd', reviewState: 'review' });
    const after = candidateStoreReducer(
      {
        ...CANDIDATE_STORE_INITIAL,
        candidates: [accepted, rejected, draft, review],
      },
      { type: 'clear-resolved', now: FIXED_NOW },
    );
    expect(after.candidates.map(c => c.id)).toEqual(['c', 'd']);
  });
});

describe('tryAcceptCandidate', () => {
  it('accepts a clean review-state candidate with apply actions', () => {
    const c = buildCandidate();
    const state = { ...CANDIDATE_STORE_INITIAL, candidates: [c] };
    const result = tryAcceptCandidate(state, c.id, { reviewerNote: 'looks good', now: FIXED_NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.reviewState).toBe('accepted');
    expect(result.candidate.reviewerNote).toBe('looks good');
    expect(result.event.previousState).toBe('review');
  });

  it('rejects accepting a candidate with validation errors', () => {
    const c = buildCandidate({ validation: { errors: ['bad'], warnings: [] } });
    const result = tryAcceptCandidate(
      { ...CANDIDATE_STORE_INITIAL, candidates: [c] },
      c.id,
      { now: FIXED_NOW },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error).toBe('invalid-validation');
  });

  it('rejects accepting a candidate with no apply actions', () => {
    const c = buildCandidate({ payload: { summary: 'x', applyActions: [], output: null } });
    const result = tryAcceptCandidate(
      { ...CANDIDATE_STORE_INITIAL, candidates: [c] },
      c.id,
      { now: FIXED_NOW },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error).toBe('missing-apply-actions');
  });

  it('rejects accepting an already-resolved candidate', () => {
    const c = buildCandidate({ reviewState: 'accepted' });
    const result = tryAcceptCandidate(
      { ...CANDIDATE_STORE_INITIAL, candidates: [c] },
      c.id,
      { now: FIXED_NOW },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error).toBe('already-resolved');
  });

  it('rejects accepting an unknown candidate', () => {
    const result = tryAcceptCandidate(CANDIDATE_STORE_INITIAL, 'missing', { now: FIXED_NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error).toBe('unknown-candidate');
  });
});

describe('tryRejectCandidate', () => {
  it('rejects a reviewable candidate and records the event', () => {
    const c = buildCandidate();
    const result = tryRejectCandidate(
      { ...CANDIDATE_STORE_INITIAL, candidates: [c] },
      c.id,
      { reviewerNote: 'not what I wanted', now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.reviewState).toBe('rejected');
    expect(result.candidate.reviewerNote).toBe('not what I wanted');
  });

  it('refuses to reject an already-rejected candidate', () => {
    const c = buildCandidate({ reviewState: 'rejected' });
    const result = tryRejectCandidate(
      { ...CANDIDATE_STORE_INITIAL, candidates: [c] },
      c.id,
      { now: FIXED_NOW },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error).toBe('already-resolved');
  });
});

describe('runtime guard', () => {
  it('rejected candidates are never accepted', () => {
    const c = buildCandidate();
    let state = { ...CANDIDATE_STORE_INITIAL, candidates: [c] };
    const rejected = tryRejectCandidate(state, c.id, { now: FIXED_NOW });
    if (rejected.ok) {
      state = candidateStoreReducer(state, {
        type: 'reject',
        candidateId: c.id,
        now: FIXED_NOW,
      });
    }
    const attempt = tryAcceptCandidate(state, c.id, { now: FIXED_NOW });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) {
      expect(attempt.error.error).toBe('already-resolved');
    }
  });
});
