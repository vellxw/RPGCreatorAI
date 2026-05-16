import { describe, it, expect } from 'vitest';
import { BrowserRuntimeAdapter, DesktopRuntimeAdapter } from '../RuntimeLaunchAdapter';

describe('BrowserRuntimeAdapter', () => {
  it('reports unavailable in browser mode', () => {
    const a = new BrowserRuntimeAdapter();
    expect(a.canLaunch()).toBe(false);
    expect(a.getStatus()).toBe('unavailable');
    expect(a.getExecutablePath()).toBeNull();
    expect(a.getUnavailableReason()).toMatch(/Browser mode/);
  });

  it('refuses to launch and returns a real error', async () => {
    const a = new BrowserRuntimeAdapter();
    const result = await a.launch('any/path');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.pid).toBeUndefined();
  });
});

describe('DesktopRuntimeAdapter', () => {
  it('detects no shell when window.runtimeBridge is missing', () => {
    const a = new DesktopRuntimeAdapter();
    expect(a.canLaunch()).toBe(false);
    expect(a.getStatus()).toBe('unavailable');
  });

  it('does not fabricate a successful launch', async () => {
    const a = new DesktopRuntimeAdapter();
    const result = await a.launch('any/path');
    expect(result.success).toBe(false);
    expect(result.pid).toBeUndefined();
  });
});
