import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AIStudioScreen } from '../AIStudioScreen';
import { defaultProviderConfigs } from '../../../stores/providerStore';
import { buildProjectContext } from '../projectContext';
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

describe('AIStudioShellIntegration', () => {
  it('renders the dock shell with the chat pane selected by default', () => {
    const { container, unmount } = renderStudio();
    const screen = container.querySelector('[data-testid="ai-studio-screen"]');
    expect(screen?.getAttribute('data-active-pane')).toBe('chat');
    const dock = container.querySelector('[data-testid="ai-studio-dock"]');
    expect(dock?.getAttribute('data-active-pane')).toBe('chat');
    const chatPanel = container.querySelector('[data-pane-panel="chat"]');
    expect(chatPanel).toBeTruthy();
    unmount();
  });

  it('switches dock panes without leaving the AI Studio shell', () => {
    const { container, unmount } = renderStudio();
    const queueTab = container.querySelector('[data-pane="queue"]') as HTMLButtonElement;
    act(() => queueTab.click());
    const dock = container.querySelector('[data-testid="ai-studio-dock"]');
    expect(dock?.getAttribute('data-active-pane')).toBe('queue');
    const queuePanel = container.querySelector('[data-pane-panel="queue"]');
    expect(queuePanel).toBeTruthy();
    unmount();
  });

  it('surfaces the bounded project context inside the context pane', () => {
    const { container, unmount } = renderStudio({
      projectId: 'project-1',
      projectTitle: 'Sample RPG',
      mapCount: 4,
      eventCount: 12,
      validationStatus: 'valid',
      selectedMap: { id: 'map-1', name: 'Town', width: 20, height: 15, tilesetId: 'tileset-1' },
      selectedEvent: { id: 'event-1', pageIndex: 0, trigger: 'action' },
      database: { selectedTables: ['actors'], selectedRecordCount: 0, truncated: false },
    });
    const contextTab = container.querySelector('[data-pane="context"]') as HTMLButtonElement;
    act(() => contextTab.click());
    const panel = container.querySelector('[data-pane-panel="context"]');
    expect(panel?.textContent).toContain('Sample RPG');
    expect(panel?.textContent).toContain('Town');
    unmount();
  });

  it('shows the no-project context state when projectId is null', () => {
    const { container, unmount } = renderStudio({ projectId: null });
    const contextTab = container.querySelector('[data-pane="context"]') as HTMLButtonElement;
    act(() => contextTab.click());
    const panel = container.querySelector('[data-pane-panel="context"]');
    expect(panel?.textContent).toContain('No project open');
    unmount();
  });

  it('records a session activity entry when a draft is canceled', () => {
    const { container, unmount } = renderStudio();
    const actorButton = container.querySelector(
      '[data-starter-task="actors"]',
    ) as HTMLButtonElement;
    act(() => actorButton.click());
    const chatPanel = container.querySelector('[data-pane-panel="chat"]');
    const cancel = chatPanel?.querySelector(
      '[data-testid="chat-transcript-cancel"]',
    ) as HTMLButtonElement;
    act(() => cancel.click());
    const activityTab = container.querySelector('[data-pane="activity"]') as HTMLButtonElement;
    act(() => activityTab.click());
    const activityPanel = container.querySelector('[data-pane-panel="activity"]');
    expect(activityPanel?.querySelector('[data-activity-kind="cancel"]')).toBeTruthy();
    unmount();
  });

  it('keeps the AI Studio shell inert by default: never mutates project or call providers directly', () => {
    const onOpenSettings = vi.fn();
    const onSelectProvider = vi.fn();
    const { container, unmount } = renderStudio({
      onOpenSettings,
      onSelectProvider,
    });
    const actorButton = container.querySelector(
      '[data-starter-task="actors"]',
    ) as HTMLButtonElement;
    act(() => actorButton.click());
    const contextTab = container.querySelector('[data-pane="context"]') as HTMLButtonElement;
    act(() => contextTab.click());
    const queueTab = container.querySelector('[data-pane="queue"]') as HTMLButtonElement;
    act(() => queueTab.click());
    const activityTab = container.querySelector('[data-pane="activity"]') as HTMLButtonElement;
    act(() => activityTab.click());
    expect(onOpenSettings).not.toHaveBeenCalled();
    expect(onSelectProvider).not.toHaveBeenCalled();
    unmount();
  });

  it('exposes a buildProjectContext helper that returns null for an absent project', () => {
    expect(buildProjectContext({ projectId: null })).toBeNull();
  });
});
