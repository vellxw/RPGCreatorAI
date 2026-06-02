import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemAdapter } from '../FileSystemAdapter';
import { _resetAdaptersForTest, getProjectDataAdapter } from '../adapterFactory';
import { importTilesetAsset } from '../tilesetImport';
import type { RpgBridge } from '../types';

function bridge(overrides: Partial<RpgBridge['fs']> = {}): RpgBridge {
  return {
    shell: { info: async () => ({ name: 'tauri', version: 'test' }) },
    fs: {
      openProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      createProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      readProject: async () => {
        throw new Error('not stubbed');
      },
      writeProject: async () => ({ success: true }),
      importImageAsset: async () => ({ success: false, cancelled: false, error: 'not stubbed' }),
      importSpritesheetAsset: async () => ({ success: false, cancelled: false, error: 'not stubbed' }),
      importAudioAsset: async () => ({ success: false, cancelled: false, error: 'not stubbed' }),
      importTilesetAsset: async () => ({ success: false, cancelled: false, error: 'not stubbed' }),
      listBackups: async () => [],
      closeProject: async () => undefined,
      createPlaytestSession: async () => ({ success: false, error: 'not stubbed' }),
      ...overrides,
    },
    runtime: {
      launch: async () => ({ success: false, error: 'not stubbed' }),
      kill: async () => undefined,
      status: async () => 'unavailable',
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

describe('importTilesetAsset', () => {
  beforeEach(() => {
    _resetAdaptersForTest();
    delete window.rpgBridge;
  });

  afterEach(() => {
    _resetAdaptersForTest();
    delete window.rpgBridge;
  });

  it('reports an honest browser fallback', async () => {
    await expect(importTilesetAsset([], {
      idBase: 'forest_pack',
      name: 'Forest Pack',
      tileSize: 32,
      columns: 8,
      tileCount: 64,
    })).resolves.toMatchObject({
      success: false,
      cancelled: false,
      error: 'Tileset import is available after opening a desktop project folder.',
    });
  });

  it('routes desktop tileset import through the bridge with metadata and project root', async () => {
    const calls: unknown[] = [];
    window.rpgBridge = bridge({
      importTilesetAsset: async (root, existingAssetIds, metadata) => {
        calls.push({ root, existingAssetIds, metadata });
        return {
          success: true,
          cancelled: false,
          asset: {
            id: 'forest_pack',
            name: 'Forest Pack',
            kind: 'tileset',
            path: 'assets/imported/tilesets/forest-pack.png',
            source: 'imported',
            tags: ['imported', 'tileset'],
            width: 256,
            height: 256,
          },
        };
      },
    });
    const adapter = getProjectDataAdapter();
    expect(adapter).toBeInstanceOf(FileSystemAdapter);
    (adapter as FileSystemAdapter).setProjectRoot('C:\\project');

    const result = await importTilesetAsset(['sample-town'], {
      idBase: 'forest_pack',
      name: 'Forest Pack',
      tileSize: 32,
      columns: 8,
      tileCount: 64,
    });

    expect(result.success).toBe(true);
    expect(calls).toEqual([
      {
        root: 'C:\\project',
        existingAssetIds: ['sample-town'],
        metadata: {
          idBase: 'forest_pack',
          name: 'Forest Pack',
          tileSize: 32,
          columns: 8,
          tileCount: 64,
        },
      },
    ]);
  });
});
