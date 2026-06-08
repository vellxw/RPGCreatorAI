import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { startupFailure } from '../App';
import { _resetAdaptersForTest, _setProjectDataAdapterForTest } from '../adapters/adapterFactory';
import { BrowserMemoryAdapter } from '../adapters/BrowserMemoryAdapter';
import type { FullProjectState } from '../adapters/types';

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

  it('shows a branded splash shell before project data resolves', () => {
    const view = renderApp();

    const splash = view.container.querySelector('[data-testid="app-splash-shell"]');
    expect(splash).not.toBeNull();
    expect(view.container.textContent).toContain('RPGCreatorAI');
    expect(view.container.textContent).toContain('Preparing your workspace');
    expect(view.container.textContent).toContain('Reading project files and editor state.');
    expect(view.container.textContent).not.toContain('provider');
    expect(view.container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('58');

    view.unmount();
  });

  it('ships a static splash shell before React mounts', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('data-rpg-splash-shell');
    expect(html).toContain('Preparing your workspace');
    expect(html).toContain('Loading project data and editor state.');
    expect(html).toContain('aria-valuenow="20"');
    expect(html).toContain('pre-react-splash');
    expect(html).not.toContain('provider');
  });

  it('falls back to the startup screen when initial project load fails', async () => {
    class FailingAdapter extends BrowserMemoryAdapter {
      override async loadProject(): Promise<FullProjectState> {
        throw new Error('Fixture load failed.');
      }
    }
    _setProjectDataAdapterForTest(new FailingAdapter());

    const view = renderApp();
    await view.flush();

    expect(view.container.textContent).toContain('Start a project');
    expect(view.container.textContent).toContain('Open failed: Fixture load failed.');

    view.unmount();
  });

  it('formats startup failures without vague unknown-error copy', () => {
    expect(startupFailure('Open')).toContain('No details were returned');
    expect(startupFailure('Open')).not.toContain('unknown error');
    expect(startupFailure('Import', 'Permission denied while reading bundle.')).toBe(
      'Import failed: Permission denied while reading bundle.',
    );
  });
});
