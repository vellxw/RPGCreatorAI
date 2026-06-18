import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// First-run onboarding is gated separately from project startup. The startup
// tests assert the post-onboarding flow, so we force `useFirstRun` to report
// "already completed" for the duration of this suite.
vi.mock('../firstRun/firstRunStore', async () => {
  const actual = await vi.importActual<typeof import('../firstRun/firstRunStore')>(
    '../firstRun/firstRunStore',
  );
  return {
    ...actual,
    useFirstRun: () => ({
      isFirstRun: false,
      preferences: { selectedPath: 'bundled-sample' as const, completedAt: '2026-06-17' },
      selectPath: vi.fn(),
      complete: vi.fn(),
      reset: vi.fn(),
    }),
  };
});

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
  openProjectDialog?: RpgBridge['fs']['openProjectDialog'];
  createProjectDialog?: RpgBridge['fs']['createProjectDialog'];
  readProject?: RpgBridge['fs']['readProject'];
  addRecent?: RpgBridge['config']['addRecent'];
  runtimeAvailability?: RpgBridge['runtime']['availability'];
  runtimeLaunch?: RpgBridge['runtime']['launch'];
}): RpgBridge {
  return {
    shell: { info: async () => ({ name: 'tauri' as const, version: 'test' }) },
    fs: {
      openProjectDialog:
        options.openProjectDialog ?? (async () => ({ root: null, cancelled: true, state: null })),
      createProjectDialog:
        options.createProjectDialog ?? (async () => ({ root: null, cancelled: true, state: null })),
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
      availability:
        options.runtimeAvailability ??
        (async () => ({ available: false, status: 'unavailable' as const, error: 'not stubbed' })),
      launch: options.runtimeLaunch ?? (async () => ({ success: false, error: 'not stubbed' })),
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
    expect(splash?.getAttribute('aria-busy')).toBe('true');
    expect(splash?.getAttribute('aria-label')).toBe('RPGCreatorAI startup status');
    expect(view.container.textContent).toContain('RPGCreatorAI');
    expect(view.container.textContent).toContain('Preparing your workspace');
    expect(view.container.textContent).toContain('Reading project files and editor state.');
    expect(view.container.textContent).not.toContain('provider');
    const progress = view.container.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute('aria-valuenow')).toBe('48');
    expect(progress?.getAttribute('aria-valuetext')).toBe(
      'Reading project files and editor state. 48 percent complete.',
    );

    view.unmount();
  });

  it('ships a static splash shell before React mounts', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('data-rpg-splash-shell');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="RPGCreatorAI startup status"');
    expect(html).toContain('Preparing your workspace');
    expect(html).toContain('Loading project data and editor state.');
    expect(html).toContain('aria-valuenow="20"');
    expect(html).toContain('aria-valuetext="Loading project data and editor state. 20 percent complete."');
    expect(html).toContain('pre-react-splash');
    expect(html).toContain('__RPG_STARTUP_MARKS__');
    expect(html).toContain('rpg-static-splash-dom-ready');
    expect(html).not.toContain('provider');
  });

  it('keeps provider settings behind a lazy startup boundary', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');

    expect(source).not.toContain("import { SettingsScreen } from './screens/SettingsScreen'");
    expect(source).not.toContain("import { useProviderStore } from './stores/providerStore'");
    expect(source).not.toContain('useProviderStore()');
    expect(source).toContain("lazy(() => import('./screens/ProviderSettingsBoundary'))");
  });

  it('keeps asset previews behind a lazy startup boundary', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');

    expect(source).not.toContain("import { AssetsScreen } from './screens/AssetsScreen'");
    expect(source).toContain("lazy(() => import('./screens/AssetWorkspaceBoundary'))");
  });

  it('keeps playtest diagnostics behind a lazy startup boundary', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');

    expect(source).not.toContain("import { PlaytestScreen } from './screens/PlaytestScreen'");
    expect(source).toContain("lazy(() => import('./screens/PlaytestWorkspaceBoundary'))");
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
    expect(view.container.textContent).toContain('Open project failed');
    expect(view.container.textContent).toContain('Fixture load failed.');
    expect(view.container.textContent).toContain('Recovery options');
    expect(view.container.textContent).toContain('Import Project Bundle');
    expect(view.container.textContent).toContain('Use bundled sample');

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
    expect(view.container.textContent).toContain('Recent project could not be restored');
    expect(view.container.textContent).toContain(recentRoot);
    expect(view.container.textContent).toContain('Choose another project folder');
    expect(view.container.textContent).toContain('Recovery options');
    expect(view.container.textContent).not.toContain('Map Tree');

    view.unmount();
  });

  it('shows pending feedback while opening a desktop project and clears it after success', async () => {
    const openedState = await fixtureProject('Opened Quest');
    let resolveOpen:
      | ((result: { root: string; cancelled: false; state: FullProjectState }) => void)
      | undefined;
    window.rpgBridge = desktopBridge({
      recents: [],
      openProjectDialog: async () =>
        new Promise(resolve => {
          resolveOpen = resolve;
        }),
    });

    const view = renderApp();
    await view.flush();

    act(() => button(view.container, 'Open Project Folder').click());
    await view.flush();

    expect(view.container.textContent).toContain('Opening project folder...');
    expect(button(view.container, 'Open Project Folder').disabled).toBe(true);
    expect(button(view.container, 'Create Project').disabled).toBe(true);

    expect(resolveOpen).toBeDefined();
    (resolveOpen as (result: { root: string; cancelled: false; state: FullProjectState }) => void)({
      root: 'C:\\Games\\Opened Quest',
      cancelled: false,
      state: openedState,
    });
    await view.flush();

    expect(view.container.textContent).toContain('Map Tree');
    expect(view.container.textContent).not.toContain('Opening project folder...');

    view.unmount();
  });

  it('returns from create-project loading feedback to recovery copy after failure', async () => {
    let rejectCreate: ((error: Error) => void) | undefined;
    window.rpgBridge = desktopBridge({
      recents: [],
      createProjectDialog: async () =>
        new Promise((_, reject) => {
          rejectCreate = reject;
        }),
    });

    const view = renderApp();
    await view.flush();

    act(() => button(view.container, 'Create Project').click());
    await view.flush();

    expect(view.container.textContent).toContain('Creating project...');
    expect(button(view.container, 'Create Project').disabled).toBe(true);

    expect(rejectCreate).toBeDefined();
    await act(async () => {
      (rejectCreate as (error: Error) => void)(
        new Error('selected folder does not contain data/project.json'),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain('Create project failed');
    expect(view.container.textContent).toContain('Recovery options');
    expect(view.container.textContent).not.toContain('Creating project...');
    expect(button(view.container, 'Create Project').disabled).toBe(false);

    view.unmount();
  });

  it('reports desktop runtime availability during startup without launching it', async () => {
    let launchCalled = false;
    window.rpgBridge = desktopBridge({
      recents: [],
      runtimeAvailability: async () => ({
        available: true,
        status: 'ready',
        executablePath: 'C:\\Tools\\rpg_creator_runtime.exe',
      }),
      runtimeLaunch: async () => {
        launchCalled = true;
        return { success: true, pid: 1234 };
      },
    });

    const view = renderApp();
    await view.flush();

    expect(view.container.textContent).toContain('Native runtime ready');
    expect(view.container.textContent).toContain('Playtest can launch after you enter the editor');
    expect(view.container.textContent).not.toContain('PID');
    expect(launchCalled).toBe(false);

    view.unmount();
  });

  it('reports desktop runtime unavailability while keeping editing available', async () => {
    let launchCalled = false;
    window.rpgBridge = desktopBridge({
      recents: [],
      runtimeAvailability: async () => ({
        available: false,
        status: 'unavailable',
        error: 'rpg_creator_runtime executable not found',
      }),
      runtimeLaunch: async () => {
        launchCalled = true;
        return { success: false, error: 'should not launch during startup' };
      },
    });

    const view = renderApp();
    await view.flush();

    expect(view.container.textContent).toContain('Native runtime unavailable');
    expect(view.container.textContent).toContain('rpg_creator_runtime executable not found');
    expect(view.container.textContent).toContain('You can keep editing');
    expect(launchCalled).toBe(false);

    view.unmount();
  });

  it('reports browser runtime unavailability during startup', async () => {
    const view = renderApp();
    await view.flush();

    expect(view.container.textContent).toContain('Native runtime unavailable in browser mode');
    expect(view.container.textContent).toContain('Use the desktop app to launch playtests');

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
