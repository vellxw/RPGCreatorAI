import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIRST_RUN_PREFERENCES,
  FIRST_RUN_STORAGE_KEY,
  reducer,
  type FirstRunAction,
} from '../firstRunStore';
import {
  FIRST_RUN_PATHS,
  getFirstRunPath,
  type FirstRunPreferences,
} from '../firstRunTypes';

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

function normalize(raw: unknown): FirstRunPreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_FIRST_RUN_PREFERENCES;
  const candidate = raw as Partial<FirstRunPreferences>;
  if (candidate.version !== 1) return DEFAULT_FIRST_RUN_PREFERENCES;
  const selectedPath =
    typeof candidate.selectedPath === 'string' &&
    (candidate.selectedPath === 'blank' ||
      candidate.selectedPath === 'town-template' ||
      candidate.selectedPath === 'bundled-sample')
      ? candidate.selectedPath
      : null;
  return {
    version: 1,
    hasCompletedFirstRun: Boolean(candidate.hasCompletedFirstRun),
    selectedPath,
    completedAt: typeof candidate.completedAt === 'string' ? candidate.completedAt : undefined,
  };
}

describe('first run types', () => {
  it('exposes three deterministic starter paths', () => {
    expect(FIRST_RUN_PATHS).toHaveLength(3);
    const ids = FIRST_RUN_PATHS.map(path => path.id);
    expect(ids).toEqual(['blank', 'town-template', 'bundled-sample']);
  });

  it('returns the requested path from getFirstRunPath', () => {
    const blank = getFirstRunPath('blank');
    expect(blank.id).toBe('blank');
    const sample = getFirstRunPath('bundled-sample');
    expect(sample.title).toContain('bundled sample');
  });

  it('falls back to the blank path when given an unknown id', () => {
    const fallback = getFirstRunPath('not-a-real-path' as never);
    expect(fallback.id).toBe('blank');
  });
});

describe('reducer', () => {
  it('selects a path', () => {
    const next = reducer(DEFAULT_FIRST_RUN_PREFERENCES, {
      type: 'select-path',
      pathId: 'town-template',
    });
    expect(next.selectedPath).toBe('town-template');
    expect(next.hasCompletedFirstRun).toBe(false);
  });

  it('refuses to complete without a selected path', () => {
    const next = reducer(DEFAULT_FIRST_RUN_PREFERENCES, { type: 'complete' });
    expect(next.hasCompletedFirstRun).toBe(false);
  });

  it('marks first run complete when a path was selected', () => {
    const withPath: FirstRunPreferences = { ...DEFAULT_FIRST_RUN_PREFERENCES, selectedPath: 'blank' };
    const next = reducer(withPath, { type: 'complete', now: '2026-06-17T00:00:00.000Z' });
    expect(next.hasCompletedFirstRun).toBe(true);
    expect(next.completedAt).toBe('2026-06-17T00:00:00.000Z');
  });

  it('reset returns to defaults', () => {
    const dirty: FirstRunPreferences = {
      version: 1,
      hasCompletedFirstRun: true,
      selectedPath: 'bundled-sample',
      completedAt: '2026-06-17T00:00:00.000Z',
    };
    const next = reducer(dirty, { type: 'reset' });
    expect(next).toEqual(DEFAULT_FIRST_RUN_PREFERENCES);
  });
});

describe('persistence', () => {
  it('round-trips preferences through storage', () => {
    const storage = new MemoryStorage();
    const prefs: FirstRunPreferences = {
      version: 1,
      hasCompletedFirstRun: true,
      selectedPath: 'town-template',
      completedAt: '2026-06-17T00:00:00.000Z',
    };
    storage.setItem(FIRST_RUN_STORAGE_KEY, JSON.stringify(prefs));
    const raw = storage.getItem(FIRST_RUN_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const restored = normalize(JSON.parse(raw as string));
    expect(restored).toEqual(prefs);
  });

  it('falls back to defaults when JSON is corrupted', () => {
    const storage = new MemoryStorage();
    storage.setItem(FIRST_RUN_STORAGE_KEY, 'not json');
    const raw = storage.getItem(FIRST_RUN_STORAGE_KEY);
    let restored: FirstRunPreferences;
    try {
      restored = normalize(JSON.parse(raw as string));
    } catch {
      restored = DEFAULT_FIRST_RUN_PREFERENCES;
    }
    expect(restored).toEqual(DEFAULT_FIRST_RUN_PREFERENCES);
  });

  it('ignores unknown path values when restoring', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      FIRST_RUN_STORAGE_KEY,
      JSON.stringify({ version: 1, hasCompletedFirstRun: false, selectedPath: 'whatever' }),
    );
    const raw = storage.getItem(FIRST_RUN_STORAGE_KEY) as string;
    const restored = normalize(JSON.parse(raw));
    expect(restored.selectedPath).toBeNull();
  });
});
