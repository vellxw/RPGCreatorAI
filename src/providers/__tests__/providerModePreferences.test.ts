import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROVIDER_MODE_PREFERENCES,
  clearProviderModePreferences,
  loadProviderModePreferences,
  saveProviderModePreferences,
} from '../providerModePreferences';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  get size() {
    return this.map.size;
  }
}

describe('providerModePreferences', () => {
  it('returns the default preferences when storage is empty', () => {
    const storage = new MemoryStorage();
    const prefs = loadProviderModePreferences('test', storage);
    expect(prefs).toEqual(DEFAULT_PROVIDER_MODE_PREFERENCES);
  });

  it('returns the default preferences when storage is unavailable', () => {
    const prefs = loadProviderModePreferences('test', null);
    expect(prefs).toEqual(DEFAULT_PROVIDER_MODE_PREFERENCES);
  });

  it('persists and reloads mode + overrides', () => {
    const storage = new MemoryStorage();
    saveProviderModePreferences(
      'test',
      {
        version: 1,
        mode: 'custom-advanced',
        overrides: [
          { workflowId: 'text-draft', providerId: 'anthropic', modelId: 'claude-opus-4-8' },
        ],
      },
      storage,
    );
    const prefs = loadProviderModePreferences('test', storage);
    expect(prefs.mode).toBe('custom-advanced');
    expect(prefs.overrides).toEqual([
      { workflowId: 'text-draft', providerId: 'anthropic', modelId: 'claude-opus-4-8' },
    ]);
  });

  it('rejects malformed values and falls back to defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem('rpgcreatorai:phase12:provider-mode:test', JSON.stringify({ version: 99, mode: 'no-such-mode' }));
    expect(loadProviderModePreferences('test', storage)).toEqual(DEFAULT_PROVIDER_MODE_PREFERENCES);
  });

  it('survives a JSON parse failure by returning defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem('rpgcreatorai:phase12:provider-mode:test', 'not json');
    expect(loadProviderModePreferences('test', storage)).toEqual(DEFAULT_PROVIDER_MODE_PREFERENCES);
  });

  it('clears the persisted bag', () => {
    const storage = new MemoryStorage();
    saveProviderModePreferences('test', { ...DEFAULT_PROVIDER_MODE_PREFERENCES, mode: 'fast-cheap' }, storage);
    expect(storage.size).toBe(1);
    clearProviderModePreferences('test', storage);
    expect(storage.size).toBe(0);
    expect(loadProviderModePreferences('test', storage)).toEqual(DEFAULT_PROVIDER_MODE_PREFERENCES);
  });

  it('does not throw when the storage write fails', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(() => saveProviderModePreferences('test', DEFAULT_PROVIDER_MODE_PREFERENCES, storage)).not.toThrow();
  });

  it('uses the namespace key', () => {
    const storage = new MemoryStorage();
    saveProviderModePreferences('project-a', { ...DEFAULT_PROVIDER_MODE_PREFERENCES, mode: 'best-quality' }, storage);
    saveProviderModePreferences('project-b', { ...DEFAULT_PROVIDER_MODE_PREFERENCES, mode: 'local-mock' }, storage);
    expect(storage.size).toBe(2);
    expect(loadProviderModePreferences('project-a', storage).mode).toBe('best-quality');
    expect(loadProviderModePreferences('project-b', storage).mode).toBe('local-mock');
  });
});
