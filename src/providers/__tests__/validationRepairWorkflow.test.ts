import { describe, it, expect } from 'vitest';
import {
  buildValidationRepairRequest,
  generateValidationRepairCandidate,
  validateRepairCandidate,
  approveRepairCandidate,
} from '../validationRepairWorkflow';
import type { ValidationMessage } from '../../types/project';
import { createMockProviderAdapter } from '../mockProviderAdapter';

describe('validationRepairWorkflow', () => {
  const mockErrors: ValidationMessage[] = [
    { level: 'error', message: 'Map "dungeon_01" does not exist in project', source: 'transferMap command' },
    { level: 'error', message: 'Actor HP must be a non-negative number', source: 'actors.hero' },
  ];
  const mockWarnings: ValidationMessage[] = [
    { level: 'warning', message: 'Empty drop list for enemy "slime"', source: 'enemies.slime' },
  ];
  const metadata = { requestId: 'test-repair-001', createdAt: '2026-06-03T00:00:00Z' };

  it('builds repair request correctly', () => {
    const { request } = buildValidationRepairRequest(mockErrors, mockWarnings, metadata);
    expect(request.id).toBe('test-repair-001');
    expect(request.operation).toBe('text.generate');
    expect(request.providerId).toBe('local');
    expect(request.modelId).toBe('offline-mock');
    expect(request.input.responseFormat).toBe('rpgcreatorai.validationRepair.v1');
    expect(request.input.errorCount).toBe(2);
    expect(request.input.warningCount).toBe(1);
  });

  it('generates and validates a valid repair candidate', async () => {
    const adapter = createMockProviderAdapter();
    const candidate = await generateValidationRepairCandidate(adapter, mockErrors, mockWarnings, metadata);
    expect(candidate.reviewState).toBe('pending');
    expect(candidate.suggestions.length).toBe(3);
    expect(candidate.provenance.providerId).toBe('local');
    expect(candidate.provenance.modelId).toBe('offline-mock');
    expect(candidate.provenance.responseFormat).toBe('rpgcreatorai.validationRepair.v1');

    // First suggestion should be reference-repair type (contains "does not exist")
    expect(candidate.suggestions[0].actionType).toBe('reference-repair');
    expect(candidate.suggestions[0].confidence).toBe('high');

    // Second suggestion should be data-fix type (contains "must be" and "non-negative")
    expect(candidate.suggestions[1].actionType).toBe('data-fix');

    const errors = validateRepairCandidate(candidate);
    expect(errors).toEqual([]);
  });

  it('validates repair candidate detects missing fields', () => {
    const errors = validateRepairCandidate({
      suggestions: [
        { errorMessage: '', suggestion: 'fix it', actionType: 'manual', confidence: 'high' },
        { errorMessage: 'some error', suggestion: '', actionType: 'manual', confidence: 'high' },
        { errorMessage: 'error', suggestion: 'fix', actionType: 'invalid', confidence: 'high' },
        { errorMessage: 'error', suggestion: 'fix', actionType: 'manual', confidence: 'invalid' },
      ],
    });
    expect(errors.length).toBe(4);
    expect(errors[0]).toContain('errorMessage is required');
    expect(errors[1]).toContain('suggestion text is required');
    expect(errors[2]).toContain('actionType');
    expect(errors[3]).toContain('confidence');
  });

  it('approves a valid repair candidate', async () => {
    const adapter = createMockProviderAdapter();
    const candidate = await generateValidationRepairCandidate(adapter, mockErrors, mockWarnings, metadata);
    const approved = approveRepairCandidate(candidate, { reviewedAt: '2026-06-03T01:00:00Z' });
    expect(approved.reviewState).toBe('approved');
    expect(approved.provenance.reviewedAt).toBe('2026-06-03T01:00:00Z');
  });

  it('throws error when approving invalid candidate', () => {
    const invalid = {
      reviewState: 'pending' as const,
      suggestions: [{ errorMessage: '', suggestion: '', actionType: 'bad', confidence: 'bad' }],
      summary: 'test',
      provenance: { providerId: 'local', modelId: 'offline-mock', responseFormat: 'v1', requestId: 'test' },
    };
    expect(() => approveRepairCandidate(invalid, { reviewedAt: '2026-06-03T01:00:00Z' })).toThrow(
      'Invalid validation repair candidate'
    );
  });

  it('handles empty error/warning lists', async () => {
    const adapter = createMockProviderAdapter();
    const candidate = await generateValidationRepairCandidate(adapter, [], [], metadata);
    expect(candidate.suggestions.length).toBe(0);
    expect(candidate.summary).toContain('0 repair suggestions');
  });

  it('categorizes different error types correctly', async () => {
    const adapter = createMockProviderAdapter();
    const mixedErrors: ValidationMessage[] = [
      { level: 'error', message: 'Actor "hero" missing required name', source: 'actors' },
      { level: 'error', message: 'duplicate actor ID "warrior"', source: 'actors' },
      { level: 'error', message: 'broken reference to map "castle"', source: 'events' },
    ];
    const candidate = await generateValidationRepairCandidate(adapter, mixedErrors, [], metadata);
    expect(candidate.suggestions[0].actionType).toBe('data-fix'); // "required"/"missing" → data-fix
    expect(candidate.suggestions[1].actionType).toBe('manual'); // "duplicate" → manual
    expect(candidate.suggestions[2].actionType).toBe('reference-repair'); // "broken" → reference-repair
  });
});
