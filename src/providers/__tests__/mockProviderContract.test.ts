import { describe, expect, it } from 'vitest';
import type { ProviderAdapterRequest } from '../providerAdapter';
import {
  mockProviderContractFixtures,
  providerContractReadiness,
  runMockProviderContractFixture,
} from '../mockProviderContract';
import {
  normalizeProviderResponse,
  serializeProviderRequest,
} from '../providerResponseNormalization';
import type { ProviderConfig } from '../../types/project';

function request(overrides: Partial<ProviderAdapterRequest> = {}): ProviderAdapterRequest {
  return {
    id: 'contract-request',
    operation: 'text.generate',
    providerId: 'local',
    modelId: 'offline-mock',
    prompt: 'Draft a deterministic innkeeper line.',
    createdAt: '2026-06-02T14:00:00.000Z',
    input: {},
    ...overrides,
  };
}

describe('mocked provider contract suite', () => {
  it('declares every required offline fixture without live provider metadata', () => {
    expect(mockProviderContractFixtures.map(fixture => fixture.id)).toEqual([
      'success',
      'image-success',
      'malformed-response',
      'provider-error',
      'rate-limit',
      'timeout',
      'cancellation',
    ]);

    for (const fixture of mockProviderContractFixtures) {
      expect(fixture.request.providerId).toBe('local');
      expect(fixture.request.modelId).toMatch(/^offline-(image-)?mock$/);
      expect(JSON.stringify(fixture)).not.toMatch(/apiKey|OPENAI_API_KEY|ANTHROPIC_API_KEY|https:\/\/api\./i);
    }
  });

  it('serializes provider requests deterministically and redacts secret-looking fields', () => {
    const serialized = serializeProviderRequest(request({
      input: {
        b: 2,
        a: 1,
        nested: {
          token: 'fixture-token-value',
          prompt: 'safe text',
        },
      },
    }));

    expect(serialized).toBe(serializeProviderRequest(request({
      input: {
        nested: {
          prompt: 'safe text',
          token: 'fixture-token-value',
        },
        a: 1,
        b: 2,
      },
    })));
    expect(serialized).toContain('"a":1');
    expect(serialized).toContain('"b":2');
    expect(serialized).toContain('"token":"[redacted]"');
    expect(serialized).not.toContain('fixture-token-value');
  });

  it('normalizes malformed raw responses into deterministic provider failures', () => {
    const normalized = normalizeProviderResponse(request(), {
      status: 'ok',
      output: 'not-a-valid-output-shape',
    });

    expect(normalized).toMatchObject({
      id: 'contract-request',
      providerId: 'local',
      operation: 'text.generate',
      status: 'failed',
      failure: {
        kind: 'provider-error',
        message: 'Malformed provider response.',
      },
    });
  });

  it('runs every fixture through the offline mock adapter contract', async () => {
    const results = await Promise.all(mockProviderContractFixtures.map(runMockProviderContractFixture));

    expect(results.map(result => [result.fixtureId, result.response.status, result.response.failure?.kind ?? 'none'])).toEqual([
      ['success', 'succeeded', 'none'],
      ['image-success', 'succeeded', 'none'],
      ['malformed-response', 'failed', 'provider-error'],
      ['provider-error', 'failed', 'provider-error'],
      ['rate-limit', 'failed', 'rate-limit'],
      ['timeout', 'failed', 'timeout'],
      ['cancellation', 'cancelled', 'cancelled'],
    ]);
    expect(results.find(result => result.fixtureId === 'success')?.response.output?.text).toContain('Offline mock response');
    expect(results.find(result => result.fixtureId === 'image-success')?.response.output?.assetRefs).toEqual([
      'mock://generated/mock-contract-image-success.png',
    ]);
    expect(results.find(result => result.fixtureId === 'rate-limit')?.response.failure?.retryGuidance).toContain('Wait');
    expect(results.find(result => result.fixtureId === 'timeout')?.response.failure?.retryGuidance).toContain('Retry after');
    expect(results.every(result => result.serializedRequest.includes('"providerId":"local"'))).toBe(true);
  });

  it('classifies disabled and missing-credential providers before contract execution', () => {
    const disabled: ProviderConfig = {
      id: 'openai',
      name: 'OpenAI',
      enabled: false,
      status: 'disabled',
      model: '',
      credentialEnvVar: 'OPENAI_API_KEY',
      credentialState: 'missing',
      capabilities: ['Text generation'],
    };
    const missingCredential: ProviderConfig = {
      ...disabled,
      enabled: true,
      status: 'missing-credentials',
    };
    const readyLocal: ProviderConfig = {
      id: 'local',
      name: 'Local gateway',
      enabled: true,
      status: 'configured',
      model: 'offline-mock',
      credentialState: 'not-required',
      capabilities: ['Offline mock contracts'],
    };

    expect(providerContractReadiness(disabled)).toMatchObject({
      state: 'disabled',
      canRun: false,
    });
    expect(providerContractReadiness(missingCredential)).toMatchObject({
      state: 'missing-credentials',
      canRun: false,
    });
    expect(providerContractReadiness(readyLocal)).toMatchObject({
      state: 'ready',
      canRun: true,
    });
  });
});
