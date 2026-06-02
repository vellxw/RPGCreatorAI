import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { _resetAdaptersForTest } from '../adapters/adapterFactory';

function renderApp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
  return {
    container,
    flush: async () => {
      await act(async () => {
        await Promise.resolve();
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find(
    candidate => candidate.textContent?.includes(label),
  );
  if (!match) throw new Error(`Missing button ${label}`);
  return match;
}

describe('App startup project flow', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    delete window.rpgBridge;
    _resetAdaptersForTest();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.rpgBridge;
    _resetAdaptersForTest();
    document.body.innerHTML = '';
  });

  it('starts on a discoverable project screen before entering the editor', async () => {
    const view = renderApp();
    await view.flush();

    expect(view.container.textContent).toContain('Start a project');
    expect(view.container.textContent).toContain('Create Browser Project');

    act(() => button(view.container, 'Use My First RPG').click());

    expect(view.container.textContent).toContain('Map Tree');
    expect(view.container.textContent).not.toContain('Start a project');

    view.unmount();
  });
});
