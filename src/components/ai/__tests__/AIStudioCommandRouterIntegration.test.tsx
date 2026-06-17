import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AIStudioScreen } from '../AIStudioScreen';
import { defaultProviderConfigs } from '../../../stores/providerStore';
import type { ProviderConfig } from '../../../types/project';

const enabledProviders: ProviderConfig[] = defaultProviderConfigs.map((provider) => ({
  ...provider,
  enabled: true,
  credentialState: 'configured',
  status: 'configured',
}));

function renderStudio(props: Partial<React.ComponentProps<typeof AIStudioScreen>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot> | null = null;
  act(() => {
    root = createRoot(container);
    root.render(
      <AIStudioScreen
        providers={enabledProviders}
        projectId="project-1"
        projectTitle="Sample RPG"
        onOpenSettings={vi.fn()}
        onSelectProvider={vi.fn()}
        {...props}
      />,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root?.unmount());
      container.remove();
    },
  };
}

function typeInto(container: HTMLElement, testId: string, value: string) {
  const input = container.querySelector(`[data-testid="${testId}"]`) as HTMLTextAreaElement;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}

describe('AIStudio command router integration', () => {
  it('renders the router form inside the chat pane', () => {
    const { container, unmount } = renderStudio();
    const form = container.querySelector('[data-testid="ai-studio-router-form"]');
    expect(form).toBeTruthy();
    const input = container.querySelector('[data-testid="ai-studio-router-input"]');
    expect(input).toBeTruthy();
    const submit = container.querySelector('[data-testid="ai-studio-router-submit"]') as HTMLButtonElement;
    expect(submit).toBeTruthy();
    expect(submit.getAttribute('type')).toBe('submit');
    expect(submit.hasAttribute('disabled')).toBe(true);
    unmount();
  });

  it('routes a focused balancing request to a mutation intent preview', () => {
    const { container, unmount } = renderStudio();
    typeInto(container, 'ai-studio-router-input', 'Rebalance this enemy stats so it survives two hits.');
    const submit = container.querySelector('[data-testid="ai-studio-router-submit"]') as HTMLButtonElement;
    expect(submit.hasAttribute('disabled')).toBe(false);
    act(() => submit.click());
    const result = container.querySelector('[data-testid="command-router-result"]');
    expect(result).toBeTruthy();
    expect(result?.getAttribute('data-kind')).toBe('intent');
    expect(result?.getAttribute('data-pipeline')).toBe('balancing');
    expect(container.querySelector('[data-testid="command-router-intent-preview-accept"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="command-router-intent-preview-reject"]')).toBeTruthy();
    unmount();
  });

  it('asks for clarification when the message cannot be routed to a known pipeline', () => {
    const { container, unmount } = renderStudio();
    typeInto(container, 'ai-studio-router-input', 'Help me with this project.');
    const submit = container.querySelector('[data-testid="ai-studio-router-submit"]') as HTMLButtonElement;
    act(() => submit.click());
    const result = container.querySelector('[data-testid="command-router-result"]');
    expect(result?.getAttribute('data-state')).toBe('clarification');
    const clarification = container.querySelector('[data-testid="command-router-clarification"]');
    expect(clarification).toBeTruthy();
    expect(container.querySelectorAll('[data-testid^="command-router-clarification-option-"]').length).toBeGreaterThan(0);
    unmount();
  });

  it('discards a draft without mutating the project when the user clicks Discard', () => {
    const { container, unmount } = renderStudio();
    typeInto(container, 'ai-studio-router-input', 'Rebalance this enemy stats so it survives two hits.');
    const submit = container.querySelector('[data-testid="ai-studio-router-submit"]') as HTMLButtonElement;
    act(() => submit.click());
    const reject = container.querySelector(
      '[data-testid="command-router-intent-preview-reject"]',
    ) as HTMLButtonElement;
    act(() => reject.click());
    expect(container.querySelector('[data-testid="command-router-result"]')).toBeNull();
    const activityTab = container.querySelector('[data-pane="activity"]') as HTMLButtonElement;
    act(() => activityTab.click());
    const activityEntries = container.querySelectorAll('[data-activity-kind]');
    const kinds = Array.from(activityEntries).map((entry) => entry.getAttribute('data-activity-kind'));
    expect(kinds).toContain('reject');
    unmount();
  });

  it('records a routed activity entry when a request produces an intent', () => {
    const { container, unmount } = renderStudio();
    typeInto(container, 'ai-studio-router-input', 'Rebalance this enemy stats so it survives two hits.');
    const submit = container.querySelector('[data-testid="ai-studio-router-submit"]') as HTMLButtonElement;
    act(() => submit.click());
    const activityTab = container.querySelector('[data-pane="activity"]') as HTMLButtonElement;
    act(() => activityTab.click());
    const activityEntries = container.querySelectorAll('[data-activity-kind]');
    const kinds = Array.from(activityEntries).map((entry) => entry.getAttribute('data-activity-kind'));
    expect(kinds).toContain('route');
    unmount();
  });

  it('disables the router form when no project is open', () => {
    const { container, unmount } = renderStudio({ projectId: null });
    const input = container.querySelector('[data-testid="ai-studio-router-input"]') as HTMLTextAreaElement;
    expect(input.hasAttribute('disabled')).toBe(true);
    const submit = container.querySelector('[data-testid="ai-studio-router-submit"]') as HTMLButtonElement;
    expect(submit.hasAttribute('disabled')).toBe(true);
    unmount();
  });

  it('keeps submit and discard buttons as type=button (form-safe)', () => {
    const { container, unmount } = renderStudio();
    typeInto(container, 'ai-studio-router-input', 'Rebalance this enemy stats so it survives two hits.');
    const submit = container.querySelector('[data-testid="ai-studio-router-submit"]') as HTMLButtonElement;
    act(() => submit.click());
    for (const button of Array.from(container.querySelectorAll('button'))) {
      const testId = button.getAttribute('data-testid') ?? '';
      if (
        testId.startsWith('command-router-clarification-option-') ||
        testId === 'command-router-intent-preview-accept' ||
        testId === 'command-router-intent-preview-reject'
      ) {
        expect(button.getAttribute('type')).toBe('button');
      }
    }
    unmount();
  });
});
