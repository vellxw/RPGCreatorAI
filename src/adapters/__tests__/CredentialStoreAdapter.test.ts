import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserCredentialStoreAdapter,
  DesktopCredentialStoreAdapter,
} from '../CredentialStoreAdapter';
import type { RpgBridge } from '../types';

declare global {
  interface Window {
    rpgBridge?: RpgBridge;
  }
}

const secret = 'fixture-provider-token-value';

describe('CredentialStoreAdapter', () => {
  afterEach(() => {
    delete window.rpgBridge;
    vi.restoreAllMocks();
  });

  it('keeps browser mode unavailable without echoing the supplied secret', async () => {
    const adapter = new BrowserCredentialStoreAdapter();

    const result = await adapter.setCredential('openai', secret);

    expect(result.success).toBe(false);
    expect(result.error).toContain('desktop');
    expect(result.error).not.toContain(secret);
    expect(await adapter.getStatus('openai')).toEqual({
      providerId: 'openai',
      configured: false,
      storage: 'unavailable',
      error: 'Credential storage is only available in the desktop shell.',
    });
  });

  it('redacts desktop bridge errors and never returns the raw secret', async () => {
    const set = vi.fn(async (_providerId: string, _value: string) => ({
      success: false,
      error: `failed to store ${secret}`,
    }));
    window.rpgBridge = {
      shell: { info: async () => ({ name: 'tauri' as const, version: 'test' }) },
      fs: {} as RpgBridge['fs'],
      runtime: {} as RpgBridge['runtime'],
      config: {} as RpgBridge['config'],
      credentials: {
        getStatus: async providerId => ({ providerId, configured: false, storage: 'windows-dpapi' }),
        list: async () => [],
        set,
        delete: async providerId => ({ providerId, configured: false, storage: 'windows-dpapi' }),
      },
    };
    const adapter = new DesktopCredentialStoreAdapter();

    const result = await adapter.setCredential('openai', secret);

    expect(set).toHaveBeenCalledWith('openai', secret);
    expect(result.success).toBe(false);
    expect(result.error).toContain('[REDACTED]');
    expect(result.error).not.toContain(secret);
  });
});
