import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ProviderCapabilityGatesPanel } from '../ProviderCapabilityGatesPanel';
import type { ProviderConfig } from '../../../types/project';

function renderPanel(providers: ProviderConfig[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<ProviderCapabilityGatesPanel providers={providers} />);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const localReady: ProviderConfig = {
  id: 'local',
  name: 'Local gateway',
  enabled: true,
  status: 'configured',
  model: 'offline-mock',
  credentialState: 'not-required',
  capabilities: ['Offline mock contracts'],
};

describe('ProviderCapabilityGatesPanel', () => {
  it('shows read-only workflow availability driven by model capabilities', () => {
    const view = renderPanel([localReady]);
    const text = view.container.textContent ?? '';

    expect(text).toContain('Capability Gates');
    expect(text).toContain('Text draft');
    expect(text).toContain('Ready');
    expect(text).toContain('Local gateway');
    expect(text).toContain('Image generation');
    expect(text).toContain('Unavailable');
    expect(text).not.toMatch(/Generate|Connect|Test Connection/i);

    view.unmount();
  });

  it('keeps all workflows unavailable when providers have no configured model capability data', () => {
    const view = renderPanel([
      {
        ...localReady,
        enabled: false,
        status: 'disabled',
        model: '',
      },
    ]);
    const text = view.container.textContent ?? '';

    expect(text).toContain('0 ready');
    expect(text).toContain('Text draft');
    expect(text).toContain('Unavailable');

    view.unmount();
  });
});
