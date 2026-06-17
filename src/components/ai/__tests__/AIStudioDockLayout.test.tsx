import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  AIStudioDockLayout,
  type AIStudioDockPane,
} from '../AIStudioDockLayout';

function renderDock(
  activePane: AIStudioDockPane,
  onSelectPane: (pane: AIStudioDockPane) => void,
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot> | null = null;
  act(() => {
    root = createRoot(container);
    root.render(
      <AIStudioDockLayout
        activePane={activePane}
        onSelectPane={onSelectPane}
        contextPane={<div>context content</div>}
        chatPane={<div>chat content</div>}
        queuePane={<div>queue content</div>}
        activityPane={<div>activity content</div>}
        onKeyDown={onKeyDown}
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

describe('AIStudioDockLayout', () => {
  it('renders every dock pane tab with stable data-pane attributes', () => {
    const { container, unmount } = renderDock('chat', () => undefined);
    const tabs = container.querySelectorAll('[data-pane]');
    const seen = new Set<string>();
    tabs.forEach((tab) => {
      const id = tab.getAttribute('data-pane');
      expect(id).toBeTruthy();
      seen.add(id as string);
    });
    expect(seen.size).toBe(4);
    const dock = container.querySelector('[data-testid="ai-studio-dock"]');
    expect(dock?.getAttribute('data-active-pane')).toBe('chat');
    unmount();
  });

  it('shows the panel that matches activePane and hides the rest', () => {
    const { container, unmount } = renderDock('queue', () => undefined);
    const panel = container.querySelector('[data-pane-panel="queue"]');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain('queue content');
    expect(container.querySelector('[data-pane-panel="context"]')).toBeNull();
    expect(container.querySelector('[data-pane-panel="chat"]')).toBeNull();
    expect(container.querySelector('[data-pane-panel="activity"]')).toBeNull();
    unmount();
  });

  it('invokes onSelectPane with the clicked pane id', () => {
    const handle = vi.fn();
    const { container, unmount } = renderDock('chat', handle);
    const activityTab = container.querySelector('[data-pane="activity"]') as HTMLButtonElement;
    act(() => {
      activityTab.click();
    });
    expect(handle).toHaveBeenCalledWith('activity');
    unmount();
  });

  it('exposes aria-selected on the active tab and keeps others unselected', () => {
    const { container, unmount } = renderDock('context', () => undefined);
    const tabs = container.querySelectorAll('[data-pane]');
    const selected = Array.from(tabs).filter(
      (tab) => tab.getAttribute('aria-selected') === 'true',
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute('data-pane')).toBe('context');
    unmount();
  });

  it('forwards keyboard events to the host onKeyDown handler', () => {
    const handleKeyDown = vi.fn();
    const { container, unmount } = renderDock('chat', () => undefined, handleKeyDown);
    const dock = container.querySelector('[data-testid="ai-studio-dock"]') as HTMLElement;
    act(() => {
      dock.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(handleKeyDown).toHaveBeenCalled();
    unmount();
  });

  it('keeps the component inert by default: no provider, store, or programmatic navigation calls', () => {
    const handle = vi.fn();
    const { container, unmount } = renderDock('context', handle);
    const queueTab = container.querySelector('[data-pane="queue"]') as HTMLButtonElement;
    act(() => {
      queueTab.click();
    });
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith('queue');
    unmount();
  });
});
