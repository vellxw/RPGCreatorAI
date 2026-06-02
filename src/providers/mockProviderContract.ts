import type { ProviderConfig } from '../types/project';
import type { ProviderAdapterRequest, ProviderAdapterResponse } from './providerAdapter';
import { createMockProviderAdapter } from './mockProviderAdapter';
import { serializeProviderRequest } from './providerResponseNormalization';

export type MockProviderContractFixtureId =
  | 'success'
  | 'image-success'
  | 'malformed-response'
  | 'provider-error'
  | 'rate-limit'
  | 'timeout'
  | 'cancellation';

export interface MockProviderContractFixture {
  id: MockProviderContractFixtureId;
  description: string;
  request: ProviderAdapterRequest;
  cancelBeforeExecute?: boolean;
}

export interface MockProviderContractResult {
  fixtureId: MockProviderContractFixtureId;
  serializedRequest: string;
  response: ProviderAdapterResponse;
}

export interface ProviderContractReadiness {
  state: 'disabled' | 'missing-credentials' | 'ready';
  canRun: boolean;
  reason: string;
}

function contractRequest(
  id: MockProviderContractFixtureId,
  input: Record<string, unknown> = {},
  operation: ProviderAdapterRequest['operation'] = 'text.generate',
  modelId = 'offline-mock',
): ProviderAdapterRequest {
  return {
    id: `mock-contract-${id}`,
    operation,
    providerId: 'local',
    modelId,
    prompt: operation === 'image.generate'
      ? 'Create a deterministic RPG icon fixture.'
      : 'Draft a deterministic innkeeper line.',
    createdAt: '2026-06-02T14:00:00.000Z',
    input,
  };
}

export const mockProviderContractFixtures: MockProviderContractFixture[] = [
  {
    id: 'success',
    description: 'Successful deterministic text generation fixture.',
    request: contractRequest('success'),
  },
  {
    id: 'image-success',
    description: 'Successful deterministic image generation fixture.',
    request: contractRequest('image-success', {
      quality: 'low',
      size: '1024x1024',
      outputFormat: 'png',
    }, 'image.generate', 'offline-image-mock'),
  },
  {
    id: 'malformed-response',
    description: 'Malformed provider payload fixture normalized to provider-error.',
    request: contractRequest('malformed-response', { fixtureFailure: 'malformed-response' }),
  },
  {
    id: 'provider-error',
    description: 'Provider error fixture with retry guidance.',
    request: contractRequest('provider-error', { fixtureFailure: 'provider-error' }),
  },
  {
    id: 'rate-limit',
    description: '429/rate-limit fixture with retry-after guidance.',
    request: contractRequest('rate-limit', { fixtureFailure: 'rate-limit', retryAfterSeconds: 90 }),
  },
  {
    id: 'timeout',
    description: 'Timeout fixture with bounded retry guidance.',
    request: contractRequest('timeout', { fixtureFailure: 'timeout', retryAfterSeconds: 30 }),
  },
  {
    id: 'cancellation',
    description: 'AbortSignal cancellation fixture.',
    request: contractRequest('cancellation'),
    cancelBeforeExecute: true,
  },
];

export async function runMockProviderContractFixture(
  fixture: MockProviderContractFixture,
): Promise<MockProviderContractResult> {
  const adapter = createMockProviderAdapter();
  const controller = new AbortController();
  if (fixture.cancelBeforeExecute) {
    controller.abort();
  }
  const response = await adapter.execute(fixture.request, { signal: controller.signal });
  return {
    fixtureId: fixture.id,
    serializedRequest: serializeProviderRequest(fixture.request),
    response,
  };
}

export function providerContractReadiness(provider: ProviderConfig): ProviderContractReadiness {
  if (!provider.enabled) {
    return {
      state: 'disabled',
      canRun: false,
      reason: 'Provider is disabled; mocked contract execution should not route real jobs through it.',
    };
  }
  if (provider.credentialState === 'missing') {
    return {
      state: 'missing-credentials',
      canRun: false,
      reason: 'Provider credentials are missing; normal validation must use offline fixtures.',
    };
  }
  return {
    state: 'ready',
    canRun: true,
    reason: 'Provider is enabled and can be evaluated by mocked contract fixtures.',
  };
}
