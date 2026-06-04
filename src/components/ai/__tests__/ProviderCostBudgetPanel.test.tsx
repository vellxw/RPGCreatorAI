import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ProviderCostBudgetPanel } from '../ProviderCostBudgetPanel';
import type { ProviderConfig } from '../../../types/project';
import type { ProviderMetadata } from '../../../providers/providerRegistry';

function renderPanel(providers: ProviderConfig[], registry?: ProviderMetadata[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;

  act(() => {
    root = createRoot(container);
    root.render(<ProviderCostBudgetPanel providers={providers} registry={registry} />);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const openAiReady: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  enabled: true,
  status: 'configured',
  model: 'gpt-image-2',
  credentialEnvVar: 'OPENAI_API_KEY',
  credentialState: 'configured',
  capabilities: ['Text generation', 'Image generation', 'Image editing'],
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

describe('ProviderCostBudgetPanel', () => {
  it('shows cost unknown, provider rate-limit guidance, and session confirmation without live actions', () => {
    const view = renderPanel([openAiReady]);
    const text = view.container.textContent ?? '';

    expect(text).toContain('Cost & Budget');
    expect(text).toContain('OpenAI');
    expect(text).toContain('Cost unknown');
    expect(text).toContain('Provider-managed limits');
    expect(text).toContain('Confirm paid work per session');
    expect(text).not.toMatch(/Generate|Connect|Test Connection/i);

    view.unmount();
  });

  it('shows known provider estimates and expensive-job confirmation thresholds', () => {
    const view = renderPanel([estimatedProvider], estimatedRegistry);
    const text = view.container.textContent ?? '';

    expect(text).toContain('Estimated cost');
    expect(text).toContain('$0.08');
    expect(text).toContain('Confirm jobs above $0.10');

    view.unmount();
  });
});
