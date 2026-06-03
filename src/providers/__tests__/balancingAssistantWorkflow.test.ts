import { describe, expect, it } from 'vitest';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  buildBalancingRequest,
  generateBalancingCandidate,
  validateBalancingCandidate,
  approveBalancingCandidate,
} from '../balancingAssistantWorkflow';

const mockContext = {
  actors: [
    { id: 'hero', name: 'Hero' },
  ],
  enemies: [
    { id: 'slime', name: 'Slime' },
  ],
  items: [
    { id: 'potion', name: 'Potion' },
  ],
};

describe('balancingAssistantWorkflow', () => {
  it('builds balancing request correctly', () => {
    const req = buildBalancingRequest('make it hard', mockContext, { curve: 'hard' }, {
      requestId: 'req-bal-1',
      createdAt: '2026-06-03T00:00:00Z',
    });
    expect(req.request).toMatchObject({
      id: 'req-bal-1',
      operation: 'text.generate',
      providerId: 'local',
      modelId: 'offline-mock',
      input: {
        responseFormat: 'rpgcreatorai.balancingDraft.v1',
        fixture: 'balancing-draft',
        curve: 'hard',
      },
    });
  });

  it('generates and validates a valid balancing candidate', async () => {
    const candidate = await generateBalancingCandidate(
      createMockProviderAdapter(),
      'boost stats',
      mockContext,
      { curve: 'standard' },
      { requestId: 'req-bal-1', createdAt: '2026-06-03T00:00:00Z' }
    );

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.adjustments.actors[0].id).toBe('hero');
    expect(candidate.adjustments.enemies[0].id).toBe('slime');
    expect(validateBalancingCandidate(candidate, mockContext)).toEqual([]);
  });

  it('identifies balancing validation errors for invalid ID and negative values', async () => {
    const candidateInvalidId = await generateBalancingCandidate(
      createMockProviderAdapter(),
      'invalid id',
      mockContext,
      { curve: 'standard' },
      { requestId: 'req-bal-2', createdAt: '2026-06-03T00:00:00Z', forceInvalidId: true }
    );
    const errorsId = validateBalancingCandidate(candidateInvalidId, mockContext);
    expect(errorsId).toContain('Actor ID "non_existent_actor" in adjustments does not exist in project context');

    const candidateNegativeValue = await generateBalancingCandidate(
      createMockProviderAdapter(),
      'negative value',
      mockContext,
      { curve: 'standard' },
      { requestId: 'req-bal-3', createdAt: '2026-06-03T00:00:00Z', forceNegativeValue: true }
    );
    const errorsValue = validateBalancingCandidate(candidateNegativeValue, mockContext);
    expect(errorsValue).toContain('Actor HP adjustment must be a non-negative number');
    expect(errorsValue).toContain('Enemy gold adjustment must be a non-negative number');
    expect(errorsValue).toContain('Item price adjustment must be a non-negative number');
  });

  it('approves a valid balancing candidate', async () => {
    const candidate = await generateBalancingCandidate(
      createMockProviderAdapter(),
      'boost stats',
      mockContext,
      { curve: 'standard' },
      { requestId: 'req-bal-1', createdAt: '2026-06-03T00:00:00Z' }
    );
    const approved = approveBalancingCandidate(candidate, mockContext, {
      reviewedAt: '2026-06-03T00:05:00Z',
    });
    expect(approved.reviewState).toBe('approved');
    expect(approved.provenance.reviewedAt).toBe('2026-06-03T00:05:00Z');
  });

  it('throws error when approving invalid balancing candidate', async () => {
    const candidate = await generateBalancingCandidate(
      createMockProviderAdapter(),
      'negative value',
      mockContext,
      { curve: 'standard' },
      { requestId: 'req-bal-3', createdAt: '2026-06-03T00:00:00Z', forceNegativeValue: true }
    );
    expect(() => {
      approveBalancingCandidate(candidate, mockContext, { reviewedAt: '2026-06-03T00:05:00Z' });
    }).toThrow('Invalid balancing candidate');
  });
});
