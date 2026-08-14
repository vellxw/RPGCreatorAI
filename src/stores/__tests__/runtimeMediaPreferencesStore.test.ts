import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_FOCUS_POLICY } from '../../media/audioFocus';
import {
  RUNTIME_MEDIA_PREFERENCES_STORAGE_KEY,
  createRuntimeMediaPreferences,
  loadRuntimeMediaPreferences,
  normalizeRuntimeMediaPreferences,
  saveRuntimeMediaPreferences,
  type RuntimeMediaPreferencesStorage,
} from '../runtimeMediaPreferencesStore';

function memoryStorage(): RuntimeMediaPreferencesStorage {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

describe('runtime media preferences', () => {
  it('uses safe defaults without a storage host', () => {
    const preferences = loadRuntimeMediaPreferences(null);

    expect(preferences).toEqual(createRuntimeMediaPreferences());
    expect(preferences.accessibility).toMatchObject({
      subtitles: { enabled: true, speakerLabels: true, soundCues: true },
      motion: { preference: 'system' },
      gore: { mode: 'reduced' },
    });
    expect(preferences.audioFocus).toEqual(DEFAULT_AUDIO_FOCUS_POLICY);
    expect(saveRuntimeMediaPreferences(preferences, null)).toBe(false);
  });

  it('round-trips valid local preferences without network or platform APIs', () => {
    const storage = memoryStorage();
    const preferences = createRuntimeMediaPreferences({
      accessibility: {
        subtitles: { textScale: 1.4, maxLines: 4 },
        motion: { preference: 'reduce' },
        gore: { mode: 'off' },
      },
      audioFocus: {
        transientLoss: 'suspend',
        resumeMode: 'user-gesture',
      },
    });

    expect(saveRuntimeMediaPreferences(preferences, storage)).toBe(true);
    expect(storage.getItem(RUNTIME_MEDIA_PREFERENCES_STORAGE_KEY)).toBeTruthy();
    expect(loadRuntimeMediaPreferences(storage)).toEqual(preferences);
  });

  it('falls back independently when one persisted contract is invalid', () => {
    const valid = createRuntimeMediaPreferences({
      accessibility: { motion: { preference: 'reduce' } },
    });
    const normalized = normalizeRuntimeMediaPreferences({
      ...valid,
      audioFocus: { ...valid.audioFocus, duckGain: 4 },
    });

    expect(normalized.accessibility.motion.preference).toBe('reduce');
    expect(normalized.audioFocus).toEqual(DEFAULT_AUDIO_FOCUS_POLICY);
  });

  it('recovers defaults when an offline host denies storage access', () => {
    const deniedStorage = {
      getItem: () => { throw new Error('storage unavailable'); },
      setItem: () => { throw new Error('storage unavailable'); },
    };

    const defaults = createRuntimeMediaPreferences();
    expect(loadRuntimeMediaPreferences(deniedStorage)).toEqual(defaults);
    expect(saveRuntimeMediaPreferences(defaults, deniedStorage)).toBe(false);
  });
});

