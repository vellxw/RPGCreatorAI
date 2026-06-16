import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  ProviderAvailabilityBanner,
  selectProviderAvailability,
  type ProviderAvailabilityView,
} from '../ProviderAvailabilityBanner';
import type { ProviderConfig } from '../../../types/project';

function renderBanner(
  view: ProviderAvailabilityView,
  props: Partial<Parameters<typeof ProviderAvailabilityBanner>[0]> = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    const root = createRoot(container);
    root.render(
      <ProviderAvailabilityBanner
        view={view}
        onOpenSettings={props.onOpenSettings ?? vi.fn()}
        onSelectProvider={props.onSelectProvider ?? vi.fn()}
      />,
    );
  });
  return { container };
}

const localMock: ProviderConfig = {
  id: 'local',
  name: 'Local mock',
  enabled: true,
  status: 'configured',
  model: 'offline-mock',
  credentialState: 'not-required',
  capabilities: ['Offline mock contracts'],
};

const anthropicMissingCreds: ProviderConfig = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  enabled: true,
  status: 'missing-credentials',
  model: 'claude-3-5-sonnet',
  credentialState: 'missing',
  capabilities: ['Text'],
};

const anthropicConfigured: ProviderConfig = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  enabled: true,
  status: 'configured',
  model: 'claude-3-5-sonnet',
  credentialState: 'configured',
  capabilities: ['Text'],
};

describe('selectProviderAvailability', () => {
  it('returns disabled when there are no providers', () => {
    const view = selectProviderAvailability([]);
    expect(view.state).toBe('no-providers');
    expect(view.readyProviderIds).toEqual([]);
    expect(view.mockProviderIds).toEqual([]);
    expect(view.unconfiguredProviderIds).toEqual([]);
  });

  it('returns mock-only when only local mock providers are configured', () => {
    const view = selectProviderAvailability([localMock]);
    expect(view.state).toBe('mock-only');
    expect(view.mockProviderIds).toEqual(['local']);
    expect(view.readyProviderIds).toEqual([]);
  });

  it('returns needs-credentials when at least one provider is enabled but missing credentials', () => {
    const view = selectProviderAvailability([anthropicMissingCreds]);
    expect(view.state).toBe('needs-credentials');
    expect(view.unconfiguredProviderIds).toEqual(['anthropic']);
  });

  it('returns ready when at least one provider is fully configured', () => {
    const view = selectProviderAvailability([anthropicConfigured, anthropicMissingCreds]);
    expect(view.state).toBe('ready');
    expect(view.readyProviderIds).toEqual(['anthropic']);
    expect(view.unconfiguredProviderIds).toEqual(['anthropic']);
  });

  it('ignores disabled providers in counts', () => {
    const view = selectProviderAvailability([
      { ...anthropicMissingCreds, enabled: false },
      localMock,
    ]);
    expect(view.state).toBe('mock-only');
    expect(view.unconfiguredProviderIds).toEqual([]);
  });
});

describe('ProviderAvailabilityBanner', () => {
  it('renders nothing when state is ready (no banner noise during normal use)', () => {
    const view: ProviderAvailabilityView = { state: 'ready', readyProviderIds: ['anthropic'], mockProviderIds: [], unconfiguredProviderIds: [] };
    const { container } = renderBanner(view);
    expect(container.textContent).toBe('');
  });

  it('renders a mock-only banner that points to local workflows and never exposes secrets', () => {
    const view: ProviderAvailabilityView = { state: 'mock-only', readyProviderIds: ['local'], mockProviderIds: ['local'], unconfiguredProviderIds: [] };
    const { container } = renderBanner(view);
    const text = container.textContent ?? '';
    expect(text).toMatch(/mock|offline|local/i);
    expect(text).not.toMatch(/sk-|key-|api[_-]?key|password|secret/i);
  });

  it('renders a needs-credentials banner with a Settings affordance and never reveals credential env var names in copy', () => {
    const view: ProviderAvailabilityView = { state: 'needs-credentials', readyProviderIds: [], mockProviderIds: [], unconfiguredProviderIds: ['anthropic'] };
    const onOpen = vi.fn();
    const { container } = renderBanner(view, { onOpenSettings: onOpen });
    const text = container.textContent ?? '';
    expect(text).toMatch(/credential/i);
    expect(text).toMatch(/settings/i);
    expect(text).not.toMatch(/sk-|key-|api[_-]?key|password|secret/i);
    const button = container.querySelector<HTMLButtonElement>('button[data-action="open-settings"]');
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders a no-providers banner with a primary action that asks for a Settings link', () => {
    const view: ProviderAvailabilityView = { state: 'no-providers', readyProviderIds: [], mockProviderIds: [], unconfiguredProviderIds: [] };
    const { container } = renderBanner(view);
    const text = container.textContent ?? '';
    expect(text).toMatch(/no.*provider|configure/i);
  });

  it('fires onSelectProvider with the provider id when a selector option is chosen', () => {
    const view: ProviderAvailabilityView = { state: 'mock-only', readyProviderIds: ['local'], mockProviderIds: ['local'], unconfiguredProviderIds: ['anthropic'] };
    const onSelect = vi.fn();
    const { container } = renderBanner(view, { onSelectProvider: onSelect });
    const picker = container.querySelector<HTMLSelectElement>('select[data-action="select-provider"]');
    expect(picker).toBeTruthy();
    act(() => {
      if (picker) {
        picker.value = 'local';
        picker.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    expect(onSelect).toHaveBeenCalled();
  });
});
