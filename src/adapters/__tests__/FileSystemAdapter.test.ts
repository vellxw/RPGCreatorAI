import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemAdapter } from '../FileSystemAdapter';
import type { FullProjectState, RpgBridge } from '../types';
import { mergeDatabases } from '../defaultDatabases';

declare global {
  interface Window {
    rpgBridge?: RpgBridge;
  }
}

function fakeBridge(overrides: Partial<RpgBridge['fs']> = {}): RpgBridge {
  return {
    shell: { info: async () => ({ name: 'tauri' as const, version: 'test' }) },
    fs: {
      openProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      readProject: async () => {
        throw new Error('not stubbed');
      },
      writeProject: async () => ({ success: true }),
      listBackups: async () => [],
      closeProject: async () => undefined,
      createPlaytestSession: async () => ({ success: false, error: 'not stubbed' }),
      ...overrides,
    },
    runtime: {
      launch: async () => ({ success: false, error: 'not stubbed' }),
      kill: async () => undefined,
      status: async () => 'unavailable' as const,
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

const sampleState: FullProjectState = {
  project: {
    schemaVersion: 1,
    title: 'T',
    startMapId: 'town',
    startPosition: { x: 0, y: 0, direction: 'down' },
    maps: [{ id: 'town', path: 'data/maps/town.json' }],
    database: { items: 'data/database/items.json' },
  },
  maps: {
    town: {
      schemaVersion: 1,
      id: 'town',
      name: 'Town',
      width: 1,
      height: 1,
      tileSize: 32,
      layers: [
        { name: 'g', type: 'visual', tiles: [1] },
        { name: 'c', type: 'collision', tiles: [0] },
      ],
      events: [],
    },
  },
  items: { items: [] },
  databases: mergeDatabases(undefined),
};

describe('FileSystemAdapter (Phase 5 IPC wiring)', () => {
  beforeEach(() => {
    delete (window as { rpgBridge?: RpgBridge }).rpgBridge;
  });
  afterEach(() => {
    delete (window as { rpgBridge?: RpgBridge }).rpgBridge;
  });

  it('reports seam capabilities when no bridge is present', () => {
    const a = new FileSystemAdapter();
    const caps = a.getCapabilities();
    expect(caps.canReadFiles).toBe(false);
    expect(caps.canWriteFiles).toBe(false);
    expect(caps.adapterName).toContain('seam');
  });

  it('reports Tauri capabilities when the bridge is present', () => {
    window.rpgBridge = fakeBridge();
    const a = new FileSystemAdapter();
    const caps = a.getCapabilities();
    expect(caps.canReadFiles).toBe(true);
    expect(caps.canWriteFiles).toBe(true);
    expect(caps.canCreateBackups).toBe(true);
    expect(caps.adapterName).toBe('FileSystemAdapter (Tauri)');
  });

  it('saveAll fails clearly when no project root is set', async () => {
    window.rpgBridge = fakeBridge();
    const a = new FileSystemAdapter();
    const result = await a.saveAll(sampleState);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No project is open');
  });

  it('saveAll routes through window.rpgBridge.fs.writeProject when a root is set', async () => {
    let calledWith: { root?: string; state?: FullProjectState } = {};
    window.rpgBridge = fakeBridge({
      writeProject: async (root, state) => {
        calledWith = { root, state };
        return { success: true };
      },
    });
    const a = new FileSystemAdapter();
    a.setProjectRoot('C:\\Users\\me\\projects\\demo');

    const result = await a.saveAll(sampleState);
    expect(result.success).toBe(true);
    expect(calledWith.root).toBe('C:\\Users\\me\\projects\\demo');
    expect(calledWith.state?.project.title).toBe('T');
  });

  it('saveAll surfaces shell errors as SaveResult instead of throwing', async () => {
    window.rpgBridge = fakeBridge({
      writeProject: async () => {
        throw new Error('disk full');
      },
    });
    const a = new FileSystemAdapter();
    a.setProjectRoot('C:\\anywhere');
    const result = await a.saveAll(sampleState);
    expect(result.success).toBe(false);
    expect(result.error).toContain('disk full');
  });

  it('per-file save methods are intentionally disabled in desktop mode', async () => {
    window.rpgBridge = fakeBridge();
    const a = new FileSystemAdapter();
    a.setProjectRoot('C:\\anywhere');
    const result = await a.saveProject(sampleState.project);
    expect(result.success).toBe(false);
    expect(result.error).toContain('saveAll');
  });
});
