import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DesktopRuntimeAdapter } from '../RuntimeLaunchAdapter';
import type { RpgBridge } from '../types';

function bridge(overrides: Partial<RpgBridge['runtime']>): RpgBridge {
  return {
    shell: { info: async () => ({ name: 'tauri' as const, version: 'test' }) },
    fs: {
      openProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      createProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      readProject: async () => { throw new Error('not stubbed'); },
      writeProject: async () => ({ success: true }),
      importImageAsset: async () => ({ success: false, cancelled: false, error: 'not stubbed' }),
      importSpritesheetAsset: async () => ({ success: false, cancelled: false, error: 'not stubbed' }),
      importAudioAsset: async () => ({ success: false, cancelled: false, error: 'not stubbed' }),
      listBackups: async () => [],
      closeProject: async () => undefined,
      createPlaytestSession: async () => ({ success: false, error: 'not stubbed' }),
    },
    runtime: {
      launch: async () => ({ success: true, pid: 1234 }),
      kill: async () => undefined,
      status: async () => 'ready' as const,
      getLatestLog: async () => ({ success: false, error: 'not stubbed' }),
      readLogTail: async () => ({ success: false, error: 'not stubbed' }),
      readLatestSnapshot: async () => ({ success: false, error: 'not stubbed' }),
      getDiagnostics: async () => ({ success: false, error: 'not stubbed', logTailMaxBytes: 0, snapshotMaxBytes: 0 }),
      openLogFolder: async () => ({ success: false, error: 'not stubbed' }),
      ...overrides,
    },
    config: {
      getRecents: async () => [],
      addRecent: async () => [],
    },
  };
}

describe('DesktopRuntimeAdapter (Phase 5)', () => {
  beforeEach(() => {
    delete (window as { rpgBridge?: RpgBridge }).rpgBridge;
  });
  afterEach(() => {
    delete (window as { rpgBridge?: RpgBridge }).rpgBridge;
  });

  it('reports unavailable without a bridge', () => {
    const a = new DesktopRuntimeAdapter();
    expect(a.canLaunch()).toBe(false);
    expect(a.getStatus()).toBe('unavailable');
  });

  it('routes launch through the bridge and reports the pid honestly', async () => {
    const calls: unknown[] = [];
    window.rpgBridge = bridge({
      launch: async (projectRoot, executableSearchRoot) => {
        calls.push({ projectRoot, executableSearchRoot });
        return { success: true, pid: 4242, executablePath: 'C:\\runtime.exe' };
      },
    });
    const a = new DesktopRuntimeAdapter();
    const result = await a.launch('C:\\temp-session', { executableSearchRoot: 'C:\\source-project' });
    expect(result.success).toBe(true);
    expect(result.pid).toBe(4242);
    expect(calls).toEqual([{ projectRoot: 'C:\\temp-session', executableSearchRoot: 'C:\\source-project' }]);
    expect(a.getExecutablePath()).toBe('C:\\runtime.exe');
    expect(a.getStatus()).toBe('running');
  });

  it('does not fabricate a pid when launch fails', async () => {
    window.rpgBridge = bridge({
      launch: async () => ({ success: false, error: 'not found' }),
    });
    const a = new DesktopRuntimeAdapter();
    const result = await a.launch('C:\\project');
    expect(result.success).toBe(false);
    expect(result.pid).toBeUndefined();
  });

  it('kill flips status back to ready', async () => {
    window.rpgBridge = bridge({
      launch: async () => ({ success: true, pid: 1 }),
      kill: async () => undefined,
    });
    const a = new DesktopRuntimeAdapter();
    await a.launch('C:\\project');
    expect(a.getStatus()).toBe('running');
    await a.kill();
    expect(a.getStatus()).toBe('ready');
  });

  it('getStatusAsync reflects shell status', async () => {
    window.rpgBridge = bridge({
      status: async () => 'running' as const,
    });
    const a = new DesktopRuntimeAdapter();
    const s = await a.getStatusAsync();
    expect(s).toBe('running');
  });

  it('routes bounded log access through the bridge', async () => {
    const calls: unknown[] = [];
    window.rpgBridge = bridge({
      getLatestLog: async () => ({ success: true, path: 'C:\\runtime.log' }),
      readLogTail: async (maxBytes) => {
        calls.push(maxBytes);
        return { success: true, path: 'C:\\runtime.log', content: '[INFO] boot', truncated: false, maxBytes };
      },
      openLogFolder: async () => ({ success: true }),
    });
    const a = new DesktopRuntimeAdapter();

    await expect(a.getLatestLog()).resolves.toMatchObject({ path: 'C:\\runtime.log' });
    await expect(a.readLatestLogTail(1024)).resolves.toMatchObject({ content: '[INFO] boot' });
    await expect(a.openLogFolder()).resolves.toMatchObject({ success: true });
    expect(calls).toEqual([1024]);
  });

  it('routes bounded runtime snapshot access through the bridge', async () => {
    const calls: unknown[] = [];
    window.rpgBridge = bridge({
      readLatestSnapshot: async (maxBytes) => {
        calls.push(maxBytes);
        return {
          success: true,
          path: 'C:\\runtime-logs\\runtime-state-snapshot.json',
          content: '{"frameNumber":1}',
          truncated: false,
          maxBytes,
        };
      },
    });
    const a = new DesktopRuntimeAdapter();

    await expect(a.readLatestSnapshot(4096)).resolves.toMatchObject({
      success: true,
      content: '{"frameNumber":1}',
    });
    expect(calls).toEqual([4096]);
  });

  it('routes diagnostics location access through the bridge', async () => {
    window.rpgBridge = bridge({
      getDiagnostics: async () => ({
        success: true,
        diagnosticsDir: 'C:\\Users\\me\\AppData\\Roaming\\RPGCreatorAI\\runtime-logs',
        latestLogPath: 'C:\\Users\\me\\AppData\\Roaming\\RPGCreatorAI\\runtime-logs\\runtime.log',
        logTailMaxBytes: 256 * 1024,
        snapshotMaxBytes: 128 * 1024,
      }),
    });
    const a = new DesktopRuntimeAdapter();

    await expect(a.getDiagnostics()).resolves.toMatchObject({
      success: true,
      diagnosticsDir: expect.stringContaining('runtime-logs'),
      logTailMaxBytes: 256 * 1024,
      snapshotMaxBytes: 128 * 1024,
    });
  });
});
