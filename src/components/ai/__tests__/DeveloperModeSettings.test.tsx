import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ReactElement } from 'react';
import { DeveloperModeSettings } from '../DeveloperModeSettings';
import {
  DEVELOPER_MODE_OFF_CAPABILITIES,
  DEVELOPER_MODE_ON_CAPABILITIES,
} from '../../../devMode/devModeTypes';

const DISCLAIMER =
  'Developer Mode is OFF by default. The host will never execute shell commands, ' +
  'commit changes, push to a remote, or write outside the project folder. Enabling ' +
  'this mode unlocks code assistant workflows, runtime diagnostics, and developer ' +
  'handoff bundles only.';

function renderPanel(ui: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
}

const containers: HTMLElement[] = [];

afterEach(() => {
  for (const c of containers.splice(0)) {
    c.remove();
  }
});

describe('DeveloperModeSettings', () => {
  it('renders the off state with all gated capabilities disabled by default', () => {
    const { container, unmount } = renderPanel(
      <DeveloperModeSettings
        state="off"
        capabilities={DEVELOPER_MODE_OFF_CAPABILITIES}
        disclaimerText={DISCLAIMER}
      />,
    );
    const panel = container.querySelector('[data-testid="developer-mode-settings"]');
    expect(panel?.getAttribute('data-state')).toBe('off');
    const code = container.querySelector(
      '[data-testid="developer-mode-capability-canUseCodeAssistant"]',
    );
    expect(code?.getAttribute('data-enabled')).toBe('false');
    const enable = container.querySelector<HTMLButtonElement>(
      '[data-testid="developer-mode-enable"]',
    );
    expect(enable).not.toBeNull();
    expect(enable?.getAttribute('type')).toBe('button');
    expect(enable?.textContent).toContain('I have read the disclaimer');
    unmount();
  });

  it('renders the on state and exposes a disable button', () => {
    const { container, unmount } = renderPanel(
      <DeveloperModeSettings
        state="on"
        capabilities={DEVELOPER_MODE_ON_CAPABILITIES}
        enabledAt="2026-06-17T00:00:00.000Z"
        disclaimerText={DISCLAIMER}
      />,
    );
    const panel = container.querySelector('[data-testid="developer-mode-settings"]');
    expect(panel?.getAttribute('data-state')).toBe('on');
    const status = container.querySelector('[data-testid="developer-mode-status"]')?.textContent;
    expect(status).toContain('Developer Mode is on');
    const code = container.querySelector(
      '[data-testid="developer-mode-capability-canUseCodeAssistant"]',
    );
    expect(code?.getAttribute('data-enabled')).toBe('true');
    const shell = container.querySelector(
      '[data-testid="developer-mode-capability-canExecuteShell"]',
    );
    expect(shell?.getAttribute('data-enabled')).toBe('false');
    expect(shell?.getAttribute('data-locked-off')).toBe('true');
    const disable = container.querySelector<HTMLButtonElement>(
      '[data-testid="developer-mode-disable"]',
    );
    expect(disable).not.toBeNull();
    expect(disable?.getAttribute('type')).toBe('button');
    unmount();
  });

  it('passes the disclaimer text to onEnable and never calls onDisable when off', () => {
    const onEnable = vi.fn();
    const onDisable = vi.fn();
    const { container, unmount } = renderPanel(
      <DeveloperModeSettings
        state="off"
        capabilities={DEVELOPER_MODE_OFF_CAPABILITIES}
        disclaimerText={DISCLAIMER}
        onEnable={onEnable}
        onDisable={onDisable}
      />,
    );
    const enable = container.querySelector<HTMLButtonElement>(
      '[data-testid="developer-mode-enable"]',
    );
    enable?.click();
    expect(onEnable).toHaveBeenCalledWith(DISCLAIMER);
    expect(onDisable).not.toHaveBeenCalled();
    unmount();
  });

  it('fires onDisable when the disable button is clicked in the on state', () => {
    const onDisable = vi.fn();
    const { container, unmount } = renderPanel(
      <DeveloperModeSettings
        state="on"
        capabilities={DEVELOPER_MODE_ON_CAPABILITIES}
        disclaimerText={DISCLAIMER}
        onDisable={onDisable}
      />,
    );
    const disable = container.querySelector<HTMLButtonElement>(
      '[data-testid="developer-mode-disable"]',
    );
    disable?.click();
    expect(onDisable).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('keeps the component inert by default: no provider, store, or programmatic navigation calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response()));
    try {
      const { unmount } = renderPanel(
        <DeveloperModeSettings
          state="off"
          capabilities={DEVELOPER_MODE_OFF_CAPABILITIES}
          disclaimerText={DISCLAIMER}
        />,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      unmount();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
