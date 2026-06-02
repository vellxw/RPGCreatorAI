import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ProviderCostBudgetPanel } from '../ProviderCostBudgetPanel';
import type { ProviderConfig } from '../../../types/project';

function renderPanel(providers: ProviderConfig[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;

  act(() => {
    root = createRoot(container);
    root.render(<ProviderCostBudgetPanel providers={providers} />);
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
});
