import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ReactElement } from 'react';
import { FirstRunGate } from '../FirstRunGate';

function renderGate(ui: ReactElement) {
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

describe('FirstRunGate', () => {
  it('renders the starter-path selector when isFirstRun is true', () => {
    const { container, unmount } = renderGate(
      <FirstRunGate
        isFirstRun
        selectedPath={null}
        onSelectPath={vi.fn()}
        onConfirm={vi.fn()}
      >
        <div data-testid="host-children">host shell</div>
      </FirstRunGate>,
    );
    const selector = container.querySelector('[data-testid="first-run-path-selector"]');
    expect(selector).not.toBeNull();
    expect(selector?.getAttribute('data-has-completed')).toBe('false');
    expect(container.querySelector('[data-testid="host-children"]')).toBeNull();
    unmount();
  });

  it('renders the host children when isFirstRun is false', () => {
    const { container, unmount } = renderGate(
      <FirstRunGate
        isFirstRun={false}
        selectedPath={null}
        onSelectPath={vi.fn()}
        onConfirm={vi.fn()}
      >
        <div data-testid="host-children">host shell</div>
      </FirstRunGate>,
    );
    expect(container.querySelector('[data-testid="first-run-path-selector"]')).toBeNull();
    const children = container.querySelector('[data-testid="host-children"]');
    expect(children).not.toBeNull();
    expect(children?.textContent).toBe('host shell');
    unmount();
  });

  it('forwards onSelectPath and onConfirm to the underlying selector', () => {
    const onSelectPath = vi.fn();
    const onConfirm = vi.fn();
    const { container, unmount } = renderGate(
      <FirstRunGate
        isFirstRun
        selectedPath="town-template"
        onSelectPath={onSelectPath}
        onConfirm={onConfirm}
      >
        <span />
      </FirstRunGate>,
    );
    const radio = container.querySelector<HTMLInputElement>(
      '[data-testid="first-run-path-radio-bundled-sample"]',
    );
    radio?.click();
    expect(onSelectPath).toHaveBeenCalledWith('bundled-sample');

    const confirm = container.querySelector<HTMLButtonElement>(
      '[data-testid="first-run-confirm"]',
    );
    confirm?.click();
    expect(onConfirm).toHaveBeenCalledWith('town-template');
    unmount();
  });

  it('is inert: no fetch, no programmatic navigation, no provider calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response()),
    );
    const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined);
    try {
      const { container, unmount } = renderGate(
        <FirstRunGate
          isFirstRun
          selectedPath="blank"
          onSelectPath={vi.fn()}
          onConfirm={vi.fn()}
        >
          <span />
        </FirstRunGate>,
      );
      const confirm = container.querySelector<HTMLButtonElement>(
        '[data-testid="first-run-confirm"]',
      );
      confirm?.click();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(pushStateSpy).not.toHaveBeenCalled();
      unmount();
    } finally {
      fetchSpy.mockRestore();
      pushStateSpy.mockRestore();
    }
  });
});
