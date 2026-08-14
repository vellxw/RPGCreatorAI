import { useCallback, useEffect, useState } from 'react';
import {
  createRuntimeAccessibilityPreferences,
  validateRuntimeAccessibilityPreferences,
  type RuntimeAccessibilityOverrides,
  type RuntimeAccessibilityPreferencesV1,
} from '../runtime-ui/accessibilityContracts';
import {
  AUDIO_FOCUS_POLICY_SCHEMA_VERSION,
  DEFAULT_AUDIO_FOCUS_POLICY,
  validateAudioFocusPolicy,
  type AudioFocusPolicyV1,
} from '../media/audioFocus';

export const RUNTIME_MEDIA_PREFERENCES_SCHEMA_VERSION = 1 as const;
export const RUNTIME_MEDIA_PREFERENCES_STORAGE_KEY = 'rpgcreatorai:runtime-media-preferences:v1';
export const RUNTIME_MEDIA_PREFERENCES_CHANGED_EVENT = 'rpgcreatorai:runtime-media-preferences-changed';

export interface RuntimeMediaPreferencesV1 {
  schemaVersion: typeof RUNTIME_MEDIA_PREFERENCES_SCHEMA_VERSION;
  accessibility: RuntimeAccessibilityPreferencesV1;
  audioFocus: AudioFocusPolicyV1;
}

export interface RuntimeMediaPreferencesOverrides {
  accessibility?: RuntimeAccessibilityOverrides;
  audioFocus?: Partial<Omit<AudioFocusPolicyV1, 'schemaVersion'>>;
}

export type RuntimeMediaPreferencesStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type RuntimeMediaPersistenceState = 'saved' | 'session-only';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultStorage(): RuntimeMediaPreferencesStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultAudioFocusPolicy(
  overrides: Partial<Omit<AudioFocusPolicyV1, 'schemaVersion'>> = {},
): AudioFocusPolicyV1 {
  const candidate: AudioFocusPolicyV1 = {
    ...DEFAULT_AUDIO_FOCUS_POLICY,
    ...overrides,
    schemaVersion: AUDIO_FOCUS_POLICY_SCHEMA_VERSION,
  };
  return validateAudioFocusPolicy(candidate).valid
    ? candidate
    : { ...DEFAULT_AUDIO_FOCUS_POLICY };
}

export function createRuntimeMediaPreferences(
  overrides: RuntimeMediaPreferencesOverrides = {},
): RuntimeMediaPreferencesV1 {
  return {
    schemaVersion: RUNTIME_MEDIA_PREFERENCES_SCHEMA_VERSION,
    accessibility: createRuntimeAccessibilityPreferences(overrides.accessibility),
    audioFocus: defaultAudioFocusPolicy(overrides.audioFocus),
  };
}

export function normalizeRuntimeMediaPreferences(input: unknown): RuntimeMediaPreferencesV1 {
  const defaults = createRuntimeMediaPreferences();
  if (!isRecord(input) || input.schemaVersion !== RUNTIME_MEDIA_PREFERENCES_SCHEMA_VERSION) {
    return defaults;
  }

  const accessibility = validateRuntimeAccessibilityPreferences(input.accessibility).valid
    ? input.accessibility as RuntimeAccessibilityPreferencesV1
    : defaults.accessibility;
  const audioFocus = validateAudioFocusPolicy(input.audioFocus).valid
    ? input.audioFocus as AudioFocusPolicyV1
    : defaults.audioFocus;

  return {
    schemaVersion: RUNTIME_MEDIA_PREFERENCES_SCHEMA_VERSION,
    accessibility,
    audioFocus,
  };
}

export function loadRuntimeMediaPreferences(
  storage: Pick<RuntimeMediaPreferencesStorage, 'getItem'> | null = defaultStorage(),
): RuntimeMediaPreferencesV1 {
  if (!storage) return createRuntimeMediaPreferences();
  try {
    const raw = storage.getItem(RUNTIME_MEDIA_PREFERENCES_STORAGE_KEY);
    return raw ? normalizeRuntimeMediaPreferences(JSON.parse(raw)) : createRuntimeMediaPreferences();
  } catch {
    return createRuntimeMediaPreferences();
  }
}

export function saveRuntimeMediaPreferences(
  preferences: RuntimeMediaPreferencesV1,
  storage: Pick<RuntimeMediaPreferencesStorage, 'setItem'> | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  const accessibilityReport = validateRuntimeAccessibilityPreferences(preferences.accessibility);
  const audioFocusReport = validateAudioFocusPolicy(preferences.audioFocus);
  if (!accessibilityReport.valid || !audioFocusReport.valid) return false;

  try {
    storage.setItem(RUNTIME_MEDIA_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

function publishPreferences(preferences: RuntimeMediaPreferencesV1): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<RuntimeMediaPreferencesV1>(
    RUNTIME_MEDIA_PREFERENCES_CHANGED_EVENT,
    { detail: preferences },
  ));
}

export interface UseRuntimeMediaPreferencesOptions {
  storage?: RuntimeMediaPreferencesStorage | null;
  initial?: RuntimeMediaPreferencesV1;
}

export interface RuntimeMediaPreferencesApi {
  preferences: RuntimeMediaPreferencesV1;
  persistence: RuntimeMediaPersistenceState;
  setAccessibility: (overrides: RuntimeAccessibilityOverrides) => void;
  setAudioFocus: (overrides: Partial<Omit<AudioFocusPolicyV1, 'schemaVersion'>>) => void;
  reset: () => void;
}

export function useRuntimeMediaPreferences(
  options: UseRuntimeMediaPreferencesOptions = {},
): RuntimeMediaPreferencesApi {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const [preferences, setPreferences] = useState<RuntimeMediaPreferencesV1>(() =>
    options.initial
      ? normalizeRuntimeMediaPreferences(options.initial)
      : loadRuntimeMediaPreferences(storage),
  );
  const [persistence, setPersistence] = useState<RuntimeMediaPersistenceState>(
    storage ? 'saved' : 'session-only',
  );

  useEffect(() => {
    setPersistence(saveRuntimeMediaPreferences(preferences, storage) ? 'saved' : 'session-only');
    publishPreferences(preferences);
  }, [preferences, storage]);

  const setAccessibility = useCallback((overrides: RuntimeAccessibilityOverrides) => {
    setPreferences(current => ({
      ...current,
      accessibility: createRuntimeAccessibilityPreferences({
        subtitles: { ...current.accessibility.subtitles, ...overrides.subtitles },
        motion: { ...current.accessibility.motion, ...overrides.motion },
        gore: { ...current.accessibility.gore, ...overrides.gore },
      }),
    }));
  }, []);

  const setAudioFocus = useCallback((overrides: Partial<Omit<AudioFocusPolicyV1, 'schemaVersion'>>) => {
    setPreferences(current => ({
      ...current,
      audioFocus: defaultAudioFocusPolicy({ ...current.audioFocus, ...overrides }),
    }));
  }, []);

  const reset = useCallback(() => {
    setPreferences(createRuntimeMediaPreferences());
  }, []);

  return { preferences, persistence, setAccessibility, setAudioFocus, reset };
}

