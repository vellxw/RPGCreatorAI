import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemAdapter } from '../FileSystemAdapter';
import { _resetAdaptersForTest, getProjectDataAdapter } from '../adapterFactory';
import { importAudioAsset } from '../audioImport';
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

describe('importAudioAsset', () => {
  beforeEach(() => {
    _resetAdaptersForTest();
    delete window.rpgBridge;
  });

  afterEach(() => {
    _resetAdaptersForTest();
    delete window.rpgBridge;
  });

  it('reports an honest browser fallback', async () => {
    await expect(importAudioAsset([], { usage: 'sfx' })).resolves.toMatchObject({
      success: false,
      cancelled: false,
      error: 'Audio import is available after opening a desktop project folder.',
    });
  });

  it('routes desktop audio import through the bridge with the open project root', async () => {
    const calls: unknown[] = [];
    window.rpgBridge = bridge({
      importAudioAsset: async (root, existingAssetIds, metadata) => {
        calls.push({ root, existingAssetIds, metadata });
        return {
          success: true,
          cancelled: false,
          asset: {
            id: 'door_chime',
            name: 'Door Chime',
            kind: 'audio',
            path: 'assets/imported/audio/door-chime.wav',
            source: 'imported',
            tags: ['imported', 'audio', 'sfx'],
          },
        };
      },
    });
    const adapter = getProjectDataAdapter();
    expect(adapter).toBeInstanceOf(FileSystemAdapter);
    (adapter as FileSystemAdapter).setProjectRoot('C:\\project');

    const result = await importAudioAsset(['confirm'], { usage: 'sfx' });

    expect(result.success).toBe(true);
    expect(calls).toEqual([
      {
        root: 'C:\\project',
        existingAssetIds: ['confirm'],
        metadata: { usage: 'sfx' },
      },
    ]);
  });
});
