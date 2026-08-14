import { describe, expect, it } from 'vitest';
import {
  createCandidateLifecycle,
  isCandidateReleaseReady,
  transitionCandidateLifecycle,
  validateCandidateResourceDiff,
} from '../candidateLifecycle';

const NOW = '2026-08-13T20:00:00.000Z';
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

function requested() {
  const result = createCandidateLifecycle<{ raw: string }, { value: string }>({
    id: 'candidate-1',
    kind: 'asset-draft',
    projectId: 'project-1',
    provenance: {
      providerId: 'local-provider',
      modelId: 'offline-model',
      operation: 'image.generate',
      requestId: 'request-1',
      createdAt: NOW,
    },
    now: NOW,
  });
  if (!result.ok) throw new Error(result.message);
  return result.candidate;
}

function advance(candidate: ReturnType<typeof requested>, to: Parameters<typeof transitionCandidateLifecycle>[1], patch: Parameters<typeof transitionCandidateLifecycle>[2] = {}) {
  const result = transitionCandidateLifecycle(candidate, to, { ...patch, now: NOW });
  if (!result.ok) throw new Error(result.message);
  return result.candidate as ReturnType<typeof requested>;
}

it('runs the complete checkpointed lifecycle and keeps an audit trail', () => {
  let candidate = requested();
  candidate = advance(candidate, 'generating');
  candidate = advance(candidate, 'quarantined', { output: { raw: 'provider output' }, quarantineReasons: ['untrusted provider output'] });
  candidate = advance(candidate, 'normalized', { normalizedOutput: { value: 'normalized' } });
  candidate = advance(candidate, 'review', {
    diff: [{ path: 'assets/runtime/portrait.webp', kind: 'add', summary: 'New portrait', afterHash: A }],
  });
  candidate = advance(candidate, 'approved', {
    approval: { reviewerId: 'creator', reviewedAt: NOW, note: 'Approved preview.' },
  });
  candidate = advance(candidate, 'frozen', { contentHash: B });
  candidate = advance(candidate, 'packaged', {
    packageArtifact: { path: 'release/candidate-1.zip', sha256: A, packagedAt: NOW },
  });

  expect(candidate.status).toBe('packaged');
  expect(candidate.history.map(event => event.to)).toEqual([
    'generating', 'quarantined', 'normalized', 'review', 'approved', 'frozen', 'packaged',
  ]);
  expect(isCandidateReleaseReady(candidate)).toBe(true);
});

it('denies skipped or backwards transitions by default', () => {
  const skipped = transitionCandidateLifecycle(requested(), 'approved', { now: NOW });
  expect(skipped).toMatchObject({ ok: false, code: 'transition-denied' });

  const generating = advance(requested(), 'generating');
  const backwards = transitionCandidateLifecycle(generating, 'requested', { now: NOW });
  expect(backwards).toMatchObject({ ok: false, code: 'transition-denied' });
});

it('does not allow review without a valid resource diff', () => {
  let candidate = advance(requested(), 'generating');
  candidate = advance(candidate, 'quarantined', { output: { raw: 'x' } });
  candidate = advance(candidate, 'normalized', { normalizedOutput: { value: 'x' } });

  expect(transitionCandidateLifecycle(candidate, 'review', { now: NOW }))
    .toMatchObject({ ok: false, code: 'invalid-diff' });
  expect(validateCandidateResourceDiff([
    { path: '../outside.exe', kind: 'add', summary: 'unsafe', afterHash: A },
  ])).toContain('diff[0].path must be a safe project-relative path.');
});

it('requires explicit approval and immutable hashes before packaging', () => {
  let candidate = advance(requested(), 'generating');
  candidate = advance(candidate, 'quarantined', { output: { raw: 'x' } });
  candidate = advance(candidate, 'normalized', { normalizedOutput: { value: 'x' } });
  candidate = advance(candidate, 'review', {
    diff: [{ path: 'data/scene.json', kind: 'modify', summary: 'Dialogue edit', beforeHash: A, afterHash: B }],
  });

  expect(transitionCandidateLifecycle(candidate, 'approved', { now: NOW }))
    .toMatchObject({ ok: false, code: 'missing-approval' });
  candidate = advance(candidate, 'approved', { approval: { reviewerId: 'creator', reviewedAt: NOW } });
  expect(transitionCandidateLifecycle(candidate, 'frozen', { contentHash: 'not-a-hash', now: NOW }))
    .toMatchObject({ ok: false, code: 'invalid-hash' });
});

it('blocks normalization while validation errors remain', () => {
  let candidate = advance(requested(), 'generating');
  candidate = advance(candidate, 'quarantined', { output: { raw: 'x' } });
  const result = transitionCandidateLifecycle(candidate, 'normalized', {
    normalizedOutput: { value: 'x' },
    validation: { errors: ['invalid dimensions'], warnings: [] },
    now: NOW,
  });
  expect(result).toMatchObject({ ok: false, code: 'invalid-validation' });
});
