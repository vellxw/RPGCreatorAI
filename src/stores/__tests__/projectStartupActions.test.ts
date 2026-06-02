import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetAdaptersForTest } from '../../adapters/adapterFactory';
import { createNewProjectState } from '../../adapters/projectTemplates';
import type { FullProjectState, RpgBridge } from '../../adapters/types';
import {
  formatProjectFolderError,
  performCreateProject,
  performOpenRecent,
  performOpenProject,
} from '../saveActions';
import type { ProjectAction } from '../projectStore';
import { validateProject } from '../../validation/validateProject';

declare global {
  interface Window {
    rpgBridge?: RpgBridge;
  }
}

function bridge(overrides: Partial<RpgBridge['fs']> = {}): RpgBridge {
  const fs = {
    openProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
    createProjectDialog: async (_state: FullProjectState) => ({
      root: null,
      cancelled: true,
      state: null,
    }),
    readProject: async () => {
      throw new Error('not stubbed');
    },
    writeProject: async () => ({ success: true }),
    listBackups: async () => [],
    closeProject: async () => undefined,
    createPlaytestSession: async () => ({ success: false, error: 'not stubbed' }),
    ...overrides,
  } as unknown as RpgBridge['fs'];

  return {
    shell: { info: async () => ({ name: 'tauri' as const, version: 'test' }) },
    fs,
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
      getRecents: async () => [],
      addRecent: async () => [],
    },
  };
}

describe('project startup actions', () => {
  beforeEach(() => {
    delete (window as { rpgBridge?: RpgBridge }).rpgBridge;
    _resetAdaptersForTest();
  });

  afterEach(() => {
    delete (window as { rpgBridge?: RpgBridge }).rpgBridge;
    _resetAdaptersForTest();
    vi.restoreAllMocks();
  });

  it('creates a valid new project state without manual JSON editing', () => {
    const state = createNewProjectState('Crystal Garden');

    expect(state.project.title).toBe('Crystal Garden');
    expect(state.project.startMapId).toBe('town');
    expect(Object.keys(state.maps)).toEqual(['town']);
    expect(state.maps.town.layers.map(layer => layer.role)).toEqual([
      'ground',
      'decoration',
      'foreground',
      'collision',
      'region',
    ]);
    expect(state.project.database.items).toBe('data/database/items.json');
    expect(validateProject(state).errors).toEqual([]);
  });

  it('creates an in-memory browser project while reporting the filesystem limit', async () => {
    const dispatched: ProjectAction[] = [];

    const outcome = await performCreateProject(
      action => dispatched.push(action),
      { title: 'Browser Sketch' },
    );

    expect(outcome.success).toBe(true);
    expect(outcome.browserOnly).toBe(true);
    expect(outcome.root).toBeUndefined();
    expect(outcome.state?.project.title).toBe('Browser Sketch');
    expect(outcome.warning).toContain('browser memory');
    expect(dispatched).toEqual([
      {
        type: 'LOAD_PROJECT',
        payload: expect.objectContaining({
          project: expect.objectContaining({ title: 'Browser Sketch' }),
        }),
      },
    ]);
  });

  it('creates a desktop project through the shell and sets it as the active root', async () => {
    const dispatched: ProjectAction[] = [];
    const calls: FullProjectState[] = [];
    let recentRoot = '';
    window.rpgBridge = bridge({
      createProjectDialog: async state => {
        calls.push(state);
        return { root: 'C:\\Users\\me\\Games\\Crystal', cancelled: false, state };
      },
    });
    window.rpgBridge.config.addRecent = async root => {
      recentRoot = root;
      return [root];
    };

    const outcome = await performCreateProject(
      action => dispatched.push(action),
      { title: 'Crystal Desktop' },
    );

    expect(outcome).toMatchObject({
      success: true,
      cancelled: false,
      root: 'C:\\Users\\me\\Games\\Crystal',
      browserOnly: false,
    });
    expect(calls[0].project.title).toBe('Crystal Desktop');
    expect(recentRoot).toBe('C:\\Users\\me\\Games\\Crystal');
    expect(dispatched[0]).toEqual({
      type: 'LOAD_PROJECT',
      payload: expect.objectContaining({
        project: expect.objectContaining({ title: 'Crystal Desktop' }),
      }),
    });
  });

  it('surfaces actionable folder guidance for missing project files', async () => {
    window.rpgBridge = bridge({
      openProjectDialog: async () => {
        throw new Error('selected folder does not contain data/project.json');
      },
    });

    const outcome = await performOpenProject(vi.fn());

    expect(outcome.success).toBe(false);
    expect(outcome.error).toContain('data/project.json');
    expect(outcome.error).toContain('Choose an RPGCreatorAI project root');
    expect(formatProjectFolderError('selected folder already contains data/project.json')).toContain(
      'Create New Project needs an empty folder',
    );
    expect(formatProjectFolderError('permission denied')).toContain('Check folder permissions');
    expect(formatProjectFolderError('disk full')).toContain('Free disk space');
    expect(formatProjectFolderError('Desktop shell not available')).toContain('Run the desktop app');
  });

  it('formats recent-project file access failures instead of exposing raw shell errors', async () => {
    window.rpgBridge = bridge({
      readProject: async () => {
        throw new Error('EACCES: permission denied, open C:\\Games\\Broken\\data\\project.json');
      },
    });

    const outcome = await performOpenRecent('C:\\Games\\Broken', vi.fn());

    expect(outcome.success).toBe(false);
    expect(outcome.error).toContain('Permission denied');
    expect(outcome.error).toContain('Check folder permissions');
    expect(outcome.error).not.toContain('EACCES');
  });
});
