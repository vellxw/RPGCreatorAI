import { describe, expect, it } from 'vitest';
import { buildProviderCostBudgetStates } from '../providerCostBudget';
import { defaultProviderRegistry, type ProviderMetadata } from '../providerRegistry';
import type { ProviderConfig } from '../../types/project';

const configuredOpenAi: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  enabled: true,
  status: 'configured',
  model: 'user-selected-model',
  credentialEnvVar: 'OPENAI_API_KEY',
  credentialState: 'configured',
  capabilities: ['Text generation', 'Image generation'],
};

const localReady: ProviderConfig = {
  id: 'local',
  name: 'Local gateway',
  enabled: true,
  status: 'configured',
  model: 'offline-mock',
  credentialState: 'not-required',
  capabilities: ['Offline mock contracts'],
};

const estimatedProvider: ProviderConfig = {
  id: 'fixture-estimated',
  name: 'Fixture Estimated',
  enabled: true,
  status: 'configured',
  model: 'fixture-image',
  credentialState: 'configured',
  capabilities: ['Image generation'],
};

const estimatedRegistry: ProviderMetadata[] = [
  {
    id: 'fixture-estimated',
    name: 'Fixture Estimated',
    adapterKind: 'mock-local',
    credential: { required: false },
    cost: {
      estimateAvailability: 'estimated',
      paidOperations: true,
      confirmationPolicy: 'confirm-expensive-session',
      currency: 'USD',
      estimatedUsd: 0.08,
      expensiveJobThresholdUsd: 0.1,
      detail: 'Estimated local fixture cost is available before execution.',
    },
    rateLimit: {
      status: 'provider-managed',
      retryGuidance: 'Retry after fixture guidance.',
    },
    operations: ['image.generate'],
    models: [
      {
        id: 'fixture-image',
        label: 'Fixture Image',
        operations: ['image.generate'],
      },
    ],
    modelSelection: 'registry',
  },
];

describe('providerCostBudget', () => {
  it('reports unknown live-provider cost honestly and requires paid-work confirmation', () => {
    const states = buildProviderCostBudgetStates([configuredOpenAi], defaultProviderRegistry);

    expect(states[0]).toMatchObject({
      providerId: 'openai',
      providerName: 'OpenAI',
      cost: {
        availability: 'unknown',
        label: 'Cost unknown',
      },
      rateLimit: {
        status: 'provider-managed',
        label: 'Provider-managed limits',
      },
      budget: {
        requiresConfirmation: true,
        label: 'Confirm paid work per session',
      },
    });
    expect(states[0].cost.detail).toContain('Exact pricing is not stored in this local registry');
    expect(states[0].rateLimit.retryGuidance).toContain('Retry only after provider guidance');
  });

  it('marks the offline mock provider as free and not rate limited by a remote service', () => {
    const states = buildProviderCostBudgetStates([localReady], defaultProviderRegistry);

    expect(states[0]).toMatchObject({
      providerId: 'local',
      cost: {
        availability: 'free',
        label: 'Free/offline',
      },
      rateLimit: {
        status: 'not-applicable',
        label: 'No remote rate limit',
      },
      budget: {
        requiresConfirmation: false,
        label: 'No paid-work confirmation needed',
      },
    });
  });

  it('surfaces known provider estimates and expensive-job thresholds before execution', () => {
    const states = buildProviderCostBudgetStates([estimatedProvider], estimatedRegistry);

    expect(states[0]).toMatchObject({
      providerId: 'fixture-estimated',
      cost: {
        availability: 'estimated',
        label: 'Estimated cost',
        estimatedUsd: 0.08,
        currency: 'USD',
      },
      budget: {
        requiresConfirmation: true,
        label: 'Confirm jobs above $0.10',
      },
    });
    expect(states[0].cost.detail).toContain('available before execution');
  });
});
