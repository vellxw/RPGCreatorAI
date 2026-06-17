import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useProviderStore } from '../providerStore';
import type { ProviderModePreferences } from '../../providers/providerModePreferences';

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
}

function renderStoreHook(options: Parameters<typeof useProviderStore>[1]) {
  let api: ReturnType<typeof useProviderStore> | null = null;
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot> | null = null;
  function Harness() {
    const value = useProviderStore(undefined, options);
    api = value;
    return null;
  }
  act(() => {
    root = createRoot(container);
    root.render(<Harness />);
  });
  return {
    get api() {
      if (!api) throw new Error('expected api');
      return api;
    },
    unmount: () => {
      act(() => root?.unmount());
      container.remove();
    },
  };
}

const containers: HTMLElement[] = [];

afterEach(() => {
  for (const c of containers.splice(0)) {
    c.remove();
  }
});

describe('useProviderStore creator mode', () => {
  it('starts with the recommended mode and no overrides', () => {
    const storage = new MemoryStorage();
    const harness = renderStoreHook({ preferencesStorage: storage, preferencesScope: 'a' });
    expect(harness.api.creatorMode).toBe('recommended');
    expect(harness.api.workflowOverrides).toEqual([]);
    expect(harness.api.isAdvancedPanelOpen).toBe(false);
    harness.unmount();
  });

  it('switches mode and opens the advanced panel when custom-advanced is selected', () => {
    const storage = new MemoryStorage();
    const harness = renderStoreHook({ preferencesStorage: storage, preferencesScope: 'a' });
    act(() => harness.api.setCreatorMode('custom-advanced'));
    expect(harness.api.creatorMode).toBe('custom-advanced');
    expect(harness.api.isAdvancedPanelOpen).toBe(true);
    harness.unmount();
  });

  it('persists the active mode and overrides back to storage', () => {
    const storage = new MemoryStorage();
    const harness = renderStoreHook({ preferencesStorage: storage, preferencesScope: 'a' });
    act(() => harness.api.setCreatorMode('fast-cheap'));
    act(() => harness.api.setWorkflowOverride({ workflowId: 'text-draft', providerId: 'anthropic', modelId: 'claude-opus-4-8' }));
    const stored = storage.getItem('rpgcreatorai:phase12:provider-mode:a');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string) as ProviderModePreferences;
    expect(parsed.mode).toBe('fast-cheap');
    expect(parsed.overrides[0]).toEqual({ workflowId: 'text-draft', providerId: 'anthropic', modelId: 'claude-opus-4-8' });
    harness.unmount();
  });

  it('hydrates the initial state from the provided initial preferences', () => {
    const storage = new MemoryStorage();
    const harness = renderStoreHook({
      preferencesStorage: storage,
      preferencesScope: 'b',
      initialPreferences: {
        version: 1,
        mode: 'best-quality',
        overrides: [
          { workflowId: 'image-generation', providerId: 'openai', modelId: 'gpt-image-2' },
        ],
      },
    });
    expect(harness.api.creatorMode).toBe('best-quality');
    expect(harness.api.workflowOverrides).toEqual([
      { workflowId: 'image-generation', providerId: 'openai', modelId: 'gpt-image-2' },
    ]);
    harness.unmount();
  });

  it('clears a single override and then all overrides', () => {
    const storage = new MemoryStorage();
    const harness = renderStoreHook({
      preferencesStorage: storage,
      preferencesScope: 'c',
      initialPreferences: {
        version: 1,
        mode: 'custom-advanced',
        overrides: [
          { workflowId: 'text-draft', providerId: 'anthropic', modelId: 'claude-opus-4-8' },
          { workflowId: 'image-generation', providerId: 'openai', modelId: 'gpt-image-2' },
        ],
      },
    });
    act(() => harness.api.clearWorkflowOverride('text-draft'));
    expect(harness.api.workflowOverrides).toEqual([
      { workflowId: 'image-generation', providerId: 'openai', modelId: 'gpt-image-2' },
    ]);
    act(() => harness.api.clearAllWorkflowOverrides());
    expect(harness.api.workflowOverrides).toEqual([]);
    harness.unmount();
  });

  it('resets the persisted preferences to defaults', () => {
    const storage = new MemoryStorage();
    const harness = renderStoreHook({
      preferencesStorage: storage,
      preferencesScope: 'd',
      initialPreferences: { version: 1, mode: 'best-quality', overrides: [] },
    });
    act(() => harness.api.resetProviderModePreferences());
    expect(harness.api.creatorMode).toBe('recommended');
    expect(harness.api.isAdvancedPanelOpen).toBe(false);
    harness.unmount();
  });
});
