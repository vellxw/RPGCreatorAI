import { useEffect, useReducer } from 'react';
import {
  DEFAULT_DEVELOPER_MODE_PREFERENCES,
  DEVELOPER_MODE_DEFAULT_STATE,
  DEVELOPER_MODE_OFF_CAPABILITIES,
  DEVELOPER_MODE_ON_CAPABILITIES,
  getDeveloperModeCapabilities,
  type DeveloperModeCapabilities,
  type DeveloperModeChangeResult,
  type DeveloperModePreferences,
  type DeveloperModeState,
} from './devModeTypes';

const STORAGE_KEY = 'rpgcreatorai:phase12:developer-mode:v1';
const STORAGE_VERSION = 1;
const DISCLAIMER_VERSION = 'phase12-m06-disclaimer-v1';

export type DeveloperModeAction =
  | { type: 'enable'; acknowledgedDisclaimer: string; now?: string }
  | { type: 'disable'; now?: string }
  | { type: 'restore'; preferences: DeveloperModePreferences };

export interface DeveloperModeApi {
  state: DeveloperModeState;
  preferences: DeveloperModePreferences;
  capabilities: DeveloperModeCapabilities;
  enable: (acknowledgedDisclaimer: string) => DeveloperModeChangeResult;
  disable: () => DeveloperModeChangeResult;
  reset: () => DeveloperModeChangeResult;
}

function isDeveloperModeState(value: unknown): value is DeveloperModeState {
  return value === 'off' || value === 'on';
}

function normalizePreferences(raw: unknown): DeveloperModePreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_DEVELOPER_MODE_PREFERENCES;
  const candidate = raw as Partial<DeveloperModePreferences>;
  if (candidate.version !== STORAGE_VERSION) return DEFAULT_DEVELOPER_MODE_PREFERENCES;
  if (!isDeveloperModeState(candidate.state)) return DEFAULT_DEVELOPER_MODE_PREFERENCES;
  return {
    version: STORAGE_VERSION,
    state: candidate.state,
    enabledAt: typeof candidate.enabledAt === 'string' ? candidate.enabledAt : undefined,
    acknowledgedDisclaimerAt:
      typeof candidate.acknowledgedDisclaimerAt === 'string'
        ? candidate.acknowledgedDisclaimerAt
        : undefined,
  };
}

export function reducer(
  state: DeveloperModePreferences,
  action: DeveloperModeAction,
): DeveloperModePreferences {
  switch (action.type) {
    case 'enable':
      if (state.state === 'on') return state;
      return {
        version: STORAGE_VERSION,
        state: 'on',
        enabledAt: action.now ?? new Date().toISOString(),
        acknowledgedDisclaimerAt: action.acknowledgedDisclaimer || state.acknowledgedDisclaimerAt,
      };
    case 'disable':
      if (state.state === 'off') return state;
      return { version: STORAGE_VERSION, state: 'off' };
    case 'restore':
      return normalizePreferences(action.preferences);
  }
}

function buildResult(
  state: DeveloperModeState,
  preferences: DeveloperModePreferences,
  error?: DeveloperModeChangeResult['error'],
): DeveloperModeChangeResult {
  return {
    ok: !error,
    state,
    capabilities: getDeveloperModeCapabilities(state),
    preferences,
    error,
  };
}

function safeRead(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  key: string,
): DeveloperModePreferences | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return null;
  }
}

function safeWrite(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  key: string,
  value: DeveloperModePreferences,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export interface UseDeveloperModeOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  initial?: DeveloperModePreferences;
  requiredDisclaimer?: string;
}

export function useDeveloperMode(options: UseDeveloperModeOptions = {}): DeveloperModeApi {
  const storage = options.storage ?? defaultStorage();
  const requiredDisclaimer = options.requiredDisclaimer ?? DISCLAIMER_VERSION;
  const [preferences, dispatch] = useReducer(
    reducer,
    options.initial ?? DEFAULT_DEVELOPER_MODE_PREFERENCES,
  );

  useEffect(() => {
    if (!storage) return;
    const restored = safeRead(storage, STORAGE_KEY);
    if (restored) {
      dispatch({ type: 'restore', preferences: restored });
    }
    // intentional one-shot hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    safeWrite(storage, STORAGE_KEY, preferences);
  }, [preferences, storage]);

  const state: DeveloperModeState = preferences.state;
  const capabilities = getDeveloperModeCapabilities(state);

  const enable = (acknowledgedDisclaimer: string): DeveloperModeChangeResult => {
    if (state === 'on') {
      return buildResult(state, preferences, {
        reason: 'state-already',
        message: 'Developer Mode is already enabled.',
      });
    }
    if (acknowledgedDisclaimer !== requiredDisclaimer) {
      return buildResult(state, preferences, {
        reason: 'missing-disclaimer-acknowledgement',
        message: 'You must read and acknowledge the Developer Mode disclaimer before enabling it.',
      });
    }
    const next: DeveloperModePreferences = {
      ...preferences,
      state: 'on',
      enabledAt: new Date().toISOString(),
      acknowledgedDisclaimerAt: requiredDisclaimer,
    };
    dispatch({ type: 'enable', acknowledgedDisclaimer: requiredDisclaimer, now: next.enabledAt });
    return buildResult('on', next);
  };

  const disable = (): DeveloperModeChangeResult => {
    if (state === 'off') {
      return buildResult(state, preferences, {
        reason: 'state-already',
        message: 'Developer Mode is already off.',
      });
    }
    const next: DeveloperModePreferences = { ...preferences, state: 'off' };
    dispatch({ type: 'disable' });
    return buildResult('off', next);
  };

  const reset = (): DeveloperModeChangeResult => {
    const next: DeveloperModePreferences = { ...DEFAULT_DEVELOPER_MODE_PREFERENCES };
    dispatch({ type: 'restore', preferences: next });
    return buildResult(next.state, next);
  };

  return { state, preferences, capabilities, enable, disable, reset };
}

export const DEVELOPER_MODE_STORAGE_KEY = STORAGE_KEY;
export const DEVELOPER_MODE_REQUIRED_DISCLAIMER = DISCLAIMER_VERSION;
export { DEVELOPER_MODE_OFF_CAPABILITIES, DEVELOPER_MODE_ON_CAPABILITIES };
export type { DeveloperModeState };
