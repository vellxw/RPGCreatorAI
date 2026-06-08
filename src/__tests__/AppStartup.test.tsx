import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { startupFailure } from '../App';
import { _resetAdaptersForTest, _setProjectDataAdapterForTest } from '../adapters/adapterFactory';
import { BrowserMemoryAdapter } from '../adapters/BrowserMemoryAdapter';
import type { FullProjectState, RpgBridge } from '../adapters/types';

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
        await Promise.resolve();
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

async function fixtureProject(title: string): Promise<FullProjectState> {
  const state = await new BrowserMemoryAdapter().loadProject();
  return { ...state, project: { ...state.project, title } };
}

function desktopBridge(options: {
  recents?: string[];
  readProject?: RpgBridge['fs']['readProject'];
  addRecent?: RpgBridge['config']['addRecent'];
}): RpgBridge {
  return {
    shell: { info: async () => ({ name: 'tauri' as const, version: 'test' }) },
    fs: {
      openProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      createProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      readProject:
        options.readProject ??
        (async () => {
          throw new Error('not stubbed');
        }),
      writeProject: async () => ({ success: true }),
      importImageAsset: async () => ({ success: false, cancelled: true }),
      importSpritesheetAsset: async () => ({ success: false, cancelled: true }),
      importAudioAsset: async () => ({ success: false, cancelled: true }),
      importTilesetAsset: async () => ({ success: false, cancelled: true }),
      listBackups: async () => [],
      closeProject: async () => undefined,
      createPlaytestSession: async () => ({ success: false, error: 'not stubbed' }),
    },
    runtime: {
      launch: async () => ({ success: false, error: 'not stubbed' }),
      kill: async () => undefined,
      status: async () => 'unavailable' as const,
      getDiagnostics: async () => ({
        success: false,
        error: 'not stubbed',
        logTailMaxBytes: 0,
        snapshotMaxBytes: 0,
      }),
      getLatestLog: async () => ({ success: false, error: 'not stubbed' }),
      readLogTail: async () => ({ success: false, error: 'not stubbed' }),
      readLatestSnapshot: async () => ({ success: false, error: 'not stubbed' }),
      openLogFolder: async () => ({ success: false, error: 'not stubbed' }),
    },
    config: {
      getRecents: async () => options.recents ?? [],
      addRecent: options.addRecent ?? (async root => [root]),
    },
  };
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
    expect(view.container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('48');

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

  it('restores a valid recent desktop project during startup', async () => {
    const recentRoot = 'C:\\Games\\Recent Quest';
    const recentState = await fixtureProject('Recent Quest');
    let readRoot = '';
    let recordedRecent = '';
    window.rpgBridge = desktopBridge({
      recents: [recentRoot],
      readProject: async root => {
        readRoot = root;
        return recentState;
      },
      addRecent: async root => {
        recordedRecent = root;
        return [root];
      },
    });

    const view = renderApp();
    await view.flush();

    expect(readRoot).toBe(recentRoot);
    expect(recordedRecent).toBe(recentRoot);
    expect(view.container.textContent).toContain('Map Tree');
    expect(view.container.textContent).not.toContain('Start a project');
    expect(view.container.textContent).toContain('Recent Quest');

    view.unmount();
  });

  it('reports a recent-project restore attempt while desktop project read is pending', async () => {
    const recentRoot = 'C:\\Games\\Pending Quest';
    const recentState = await fixtureProject('Pending Quest');
    let resolveRead: ((state: FullProjectState) => void) | undefined;
    window.rpgBridge = desktopBridge({
      recents: [recentRoot],
      readProject: async () =>
        new Promise<FullProjectState>(resolve => {
          resolveRead = resolve;
        }),
    });

    const view = renderApp();
    await view.flush();

    expect(view.container.querySelector('[data-testid="app-splash-shell"]')).not.toBeNull();
    expect(view.container.textContent).toContain('Restoring your recent project');
    expect(view.container.textContent).toContain('Opening your most recent local project.');

    expect(resolveRead).toBeDefined();
    (resolveRead as (state: FullProjectState) => void)(recentState);
    await view.flush();

    expect(view.container.textContent).toContain('Map Tree');

    view.unmount();
  });

  it('keeps manual startup actions available when recent restore fails', async () => {
    const recentRoot = 'C:\\Games\\Missing Quest';
    window.rpgBridge = desktopBridge({
      recents: [recentRoot],
      readProject: async () => {
        throw new Error('selected folder does not contain data/project.json');
      },
    });

    const view = renderApp();
    await view.flush();

    expect(view.container.textContent).toContain('Start a project');
    expect(view.container.textContent).toContain('Open Project Folder');
    expect(view.container.textContent).toContain('Create Project');
    expect(view.container.textContent).toContain('Recent project restore failed');
    expect(view.container.textContent).toContain(recentRoot);
    expect(view.container.textContent).toContain('Choose an RPGCreatorAI project root');
    expect(view.container.textContent).not.toContain('Map Tree');

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
