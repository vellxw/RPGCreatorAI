import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProviderConfig } from '../../types/project';
import { SettingsScreen } from '../SettingsScreen';

function renderSettings(initialProviders: ProviderConfig[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;

  act(() => {
    root = createRoot(container);
    root.render(<SettingsScreen initialProviders={initialProviders} />);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const disabledOpenAi: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  enabled: false,
  status: 'disabled',
  model: '',
  credentialEnvVar: 'OPENAI_API_KEY',
  credentialState: 'missing',
  capabilities: ['Text generation', 'Image generation', 'Image editing'],
};

describe('SettingsScreen provider settings', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps local editor use clear when no providers are configured', () => {
    const view = renderSettings([]);
    const text = view.container.textContent ?? '';

    expect(text).toContain('Provider Settings');
    expect(text).toContain('Providers are optional');
    expect(text).toContain('No providers configured');
    expect(text).toContain('Maps, database, assets, and playtest stay available');
    expect(view.container.querySelector('input[type="password"]')).toBeNull();

    const enabledButtons = Array.from(view.container.querySelectorAll('button')).filter(button => !button.disabled);
    expect(enabledButtons.map(button => button.textContent ?? '').join(' ')).not.toMatch(/Generate|Test Connection|Connect/i);

    view.unmount();
  });

  it('shows disabled providers with capabilities and missing-credential state after enablement', () => {
    const view = renderSettings([disabledOpenAi]);

    expect(view.container.textContent).toContain('OpenAI');
    expect(view.container.textContent).toContain('Disabled');
    expect(view.container.textContent).toContain('Text generation');
    expect(view.container.textContent).toContain('Image generation');
    expect(view.container.textContent).toContain('OPENAI_API_KEY');

    const enable = view.container.querySelector<HTMLButtonElement>('button[aria-label="Enable OpenAI provider"]');
    expect(enable).toBeDefined();

    act(() => {
      enable?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(view.container.textContent).toContain('Needs credentials');
    expect(view.container.querySelector('input[type="password"]')).toBeNull();

    view.unmount();
  });

  it('shows configured providers without exposing secret fields or generation actions', () => {
    const view = renderSettings([
      {
        ...disabledOpenAi,
        enabled: true,
        status: 'configured',
        credentialState: 'configured',
        model: 'gpt-image-2',
      },
    ]);
    const text = view.container.textContent ?? '';
    const model = view.container.querySelector<HTMLInputElement>('input[aria-label="Model for OpenAI"]');

    expect(text).toContain('Configured');
    expect(model?.value).toBe('gpt-image-2');
    expect(text).toContain('Image editing');
    expect(view.container.querySelector('input[type="password"]')).toBeNull();

    const buttons = Array.from(view.container.querySelectorAll('button'));
    expect(buttons.map(button => button.textContent ?? '').join(' ')).not.toMatch(/Generate|Test Connection|Connect/i);

    view.unmount();
  });
});
