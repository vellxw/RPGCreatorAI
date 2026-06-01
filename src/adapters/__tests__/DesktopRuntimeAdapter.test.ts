import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DesktopRuntimeAdapter } from '../RuntimeLaunchAdapter';
import type { RpgBridge } from '../types';

function bridge(overrides: Partial<RpgBridge['runtime']>): RpgBridge {
  return {
    shell: { info: async () => ({ name: 'tauri' as const, version: 'test' }) },
    fs: {
      openProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      readProject: async () => { throw new Error('not stubbed'); },
      writeProject: async () => ({ success: true }),
      listBackups: async () => [],
      closeProject: async () => undefined,
      createPlaytestSession: async () => ({ success: false, error: 'not stubbed' }),
    },
    runtime: {
      launch: async () => ({ success: true, pid: 1234 }),
      kill: async () => undefined,
      status: async () => 'ready' as const,
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
});
