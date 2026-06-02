import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { CredentialStoreAdapter } from '../../adapters/CredentialStoreAdapter';
import type { ProviderConfig } from '../../types/project';
import { SettingsScreen } from '../SettingsScreen';

function renderSettings(
  initialProviders: ProviderConfig[],
  credentialStore?: CredentialStoreAdapter,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;

  act(() => {
    root = createRoot(container);
    root.render(<SettingsScreen initialProviders={initialProviders} credentialStore={credentialStore} />);
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
    const credential = view.container.querySelector<HTMLInputElement>('input[type="password"]');
    expect(credential).toBeDefined();
    expect(credential?.disabled).toBe(true);
    expect(view.container.textContent).toContain('Credential storage is only available in the desktop shell.');

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
    expect(text).toContain('Cost & Budget');
    expect(text).toContain('Cost unknown');
    expect(text).toContain('Confirm paid work per session');
    const credential = view.container.querySelector<HTMLInputElement>('input[type="password"]');
    expect(credential?.value).toBe('');

    const buttons = Array.from(view.container.querySelectorAll('button'));
    expect(buttons.map(button => button.textContent ?? '').join(' ')).not.toMatch(/Generate|Test Connection|Connect/i);

    view.unmount();
  });

  it('stores credentials through the credential adapter and clears raw secret UI state', async () => {
    const secret = 'fixture-provider-token-value';
    let captured = '';
    const credentialStore: CredentialStoreAdapter = {
      isAvailable: () => true,
      getUnavailableReason: () => null,
      getStatus: async providerId => ({ providerId, configured: false, storage: 'windows-dpapi' }),
      list: async () => [],
      setCredential: async (providerId, value) => {
        captured = value;
        return {
          success: true,
          status: { providerId, configured: true, storage: 'windows-dpapi' },
        };
      },
      deleteCredential: async providerId => ({ providerId, configured: false, storage: 'windows-dpapi' }),
    };
    const view = renderSettings([
      {
        ...disabledOpenAi,
        enabled: true,
        status: 'missing-credentials',
      },
    ], credentialStore);

    await act(async () => {
      await Promise.resolve();
    });

    const input = view.container.querySelector<HTMLInputElement>('input[aria-label="Credential for OpenAI"]');
    expect(input).toBeDefined();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, secret);
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = Array.from(view.container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Save Credential'),
    );
    expect(save).toBeDefined();
    expect(save?.disabled).toBe(false);
    await act(async () => {
      save?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(captured).toBe(secret);
    expect(input?.value).toBe('');
    expect(view.container.textContent).toContain('Credential stored locally');
    expect(view.container.textContent).not.toContain(secret);

    view.unmount();
  });
});
