import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BrowserPlaytestSessionAdapter,
  DesktopPlaytestSessionAdapter,
} from '../PlaytestSessionAdapter';
import type { FullProjectState, RpgBridge } from '../types';
import { mergeDatabases } from '../defaultDatabases';

function makeState(): FullProjectState {
  return {
    project: {
      schemaVersion: 1,
      title: 'Session Test',
      startMapId: 'town',
      startPosition: { x: 1, y: 2, direction: 'down' },
      maps: [
        { id: 'town', path: 'data/maps/town.json' },
        { id: 'house', path: 'data/maps/house.json' },
      ],
      database: { items: 'data/database/items.json' },
    },
    maps: {
      town: {
        schemaVersion: 1,
        id: 'town',
        name: 'Town',
        width: 2,
        height: 2,
        tileSize: 32,
        layers: [],
        events: [],
      },
      house: {
        schemaVersion: 1,
        id: 'house',
        name: 'House',
        width: 2,
        height: 2,
        tileSize: 32,
        layers: [],
        events: [
          { id: 'npc_1', type: 'npc', x: 1, y: 0, solid: false, trigger: 'interact', commands: [] },
        ],
      },
    },
    items: { items: [] },
    databases: mergeDatabases(undefined),
  };
}

function bridge(overrides: Partial<RpgBridge['fs']>): RpgBridge {
  return {
    shell: { info: async () => ({ name: 'tauri' as const, version: 'test' }) },
    fs: {
      openProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      createProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      readProject: async () => { throw new Error('not stubbed'); },
      writeProject: async () => ({ success: true }),
      listBackups: async () => [],
      closeProject: async () => undefined,
      createPlaytestSession: async () => ({ success: false, error: 'not stubbed' }),
      ...overrides,
    },
    runtime: {
      launch: async () => ({ success: true, pid: 1 }),
      kill: async () => undefined,
      status: async () => 'ready' as const,
      getDiagnostics: async () => ({ success: false, error: 'not stubbed', logTailMaxBytes: 0, snapshotMaxBytes: 0 }),
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

describe('PlaytestSessionAdapter', () => {
  beforeEach(() => {
    delete (window as { rpgBridge?: RpgBridge }).rpgBridge;
  });

  afterEach(() => {
    delete (window as { rpgBridge?: RpgBridge }).rpgBridge;
  });

  it('routes desktop session creation through the bridge with mode metadata', async () => {
    const calls: unknown[] = [];
    window.rpgBridge = bridge({
      createPlaytestSession: async (sourceRoot, state, request) => {
        calls.push({ sourceRoot, state, request });
        return { success: true, sessionRoot: 'C:\\appdata\\RPGCreatorAI\\playtest-sessions\\session-1' };
      },
    });

    const adapter = new DesktopPlaytestSessionAdapter();
    const state = makeState();
    const result = await adapter.createSession('C:\\source-project', state, {
      mode: 'selectedEvent',
      currentMapId: 'house',
      selectedEventMapId: 'house',
      selectedEventId: 'npc_1',
    });

    expect(result.success).toBe(true);
    expect(result.sessionRoot).toContain('playtest-sessions');
    expect(calls).toEqual([
      {
        sourceRoot: 'C:\\source-project',
        state,
        request: {
          mode: 'selectedEvent',
          currentMapId: 'house',
          selectedEventMapId: 'house',
          selectedEventId: 'npc_1',
        },
      },
    ]);
  });

  it('routes project-start session creation without changing source state metadata', async () => {
    const calls: unknown[] = [];
    window.rpgBridge = bridge({
      createPlaytestSession: async (sourceRoot, state, request) => {
        calls.push({ sourceRoot, state, request });
        return { success: true, sessionRoot: 'C:\\appdata\\RPGCreatorAI\\playtest-sessions\\session-project-start' };
      },
    });

    const adapter = new DesktopPlaytestSessionAdapter();
    const state = makeState();
    const originalStart = {
      startMapId: state.project.startMapId,
      startPosition: { ...state.project.startPosition },
    };
    const result = await adapter.createSession('C:\\source-project', state, {
      mode: 'projectStart',
    });

    expect(result.success).toBe(true);
    expect(state.project.startMapId).toBe(originalStart.startMapId);
    expect(state.project.startPosition).toEqual(originalStart.startPosition);
    expect(calls).toEqual([
      {
        sourceRoot: 'C:\\source-project',
        state,
        request: {
          mode: 'projectStart',
        },
      },
    ]);
  });

  it('reports unavailable in browser mode without fabricating a temp path', async () => {
    const adapter = new BrowserPlaytestSessionAdapter();
    const result = await adapter.createSession('C:\\source-project', makeState(), {
      mode: 'projectStart',
    });

    expect(result.success).toBe(false);
    expect(result.sessionRoot).toBeUndefined();
  });
});
