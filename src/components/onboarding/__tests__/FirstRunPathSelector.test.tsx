import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ReactElement } from 'react';
import { FirstRunPathSelector } from '../FirstRunPathSelector';

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

describe('FirstRunPathSelector', () => {
  it('renders three starter paths and a confirm button', () => {
    const { container, unmount } = renderPanel(
      <FirstRunPathSelector
        selectedPath={null}
        hasCompletedFirstRun={false}
        onSelectPath={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const selector = container.querySelector('[data-testid="first-run-path-selector"]');
    expect(selector?.getAttribute('data-has-completed')).toBe('false');
    const items = container.querySelectorAll('[data-testid="first-run-path-item"]');
    expect(items.length).toBe(3);
    const confirm = container.querySelector<HTMLButtonElement>(
      '[data-testid="first-run-confirm"]',
    );
    expect(confirm).not.toBeNull();
    expect(confirm?.getAttribute('type')).toBe('button');
    expect(confirm?.hasAttribute('disabled')).toBe(true);
    unmount();
  });

  it('invokes onSelectPath when a radio is chosen and enables the confirm button', () => {
    const onSelectPath = vi.fn();
    const { container, unmount } = renderPanel(
      <FirstRunPathSelector
        selectedPath={null}
        hasCompletedFirstRun={false}
        onSelectPath={onSelectPath}
        onConfirm={vi.fn()}
      />,
    );
    const radio = container.querySelector<HTMLInputElement>(
      '[data-testid="first-run-path-radio-town-template"]',
    );
    radio?.click();
    expect(onSelectPath).toHaveBeenCalledWith('town-template');
    unmount();
  });

  it('renders the skip button only after the first run was completed', () => {
    const onSkip = vi.fn();
    const onConfirm = vi.fn();
    const { container, unmount } = renderPanel(
      <FirstRunPathSelector
        selectedPath="blank"
        hasCompletedFirstRun
        onSelectPath={vi.fn()}
        onConfirm={onConfirm}
        onSkip={onSkip}
      />,
    );
    const skip = container.querySelector<HTMLButtonElement>('[data-testid="first-run-skip"]');
    expect(skip).not.toBeNull();
    expect(skip?.getAttribute('type')).toBe('button');
    skip?.click();
    expect(onSkip).toHaveBeenCalledTimes(1);
    const confirm = container.querySelector<HTMLButtonElement>(
      '[data-testid="first-run-confirm"]',
    );
    expect(confirm?.hasAttribute('disabled')).toBe(false);
    confirm?.click();
    expect(onConfirm).toHaveBeenCalledWith('blank');
    unmount();
  });

  it('keeps the selector inert by default: no provider, store, or programmatic navigation calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response()),
    );
    try {
      const { unmount } = renderPanel(
        <FirstRunPathSelector
          selectedPath={null}
          hasCompletedFirstRun={false}
          onSelectPath={vi.fn()}
          onConfirm={vi.fn()}
        />,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      unmount();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
