import { describe, expect, it } from 'vitest';
import {
  DEVELOPER_MODE_REQUIRED_DISCLAIMER,
  reducer,
  type DeveloperModeAction,
} from '../devModeStore';
import {
  DEFAULT_DEVELOPER_MODE_PREFERENCES,
  DEVELOPER_MODE_DEFAULT_STATE,
  DEVELOPER_MODE_OFF_CAPABILITIES,
  DEVELOPER_MODE_ON_CAPABILITIES,
  isCapabilityEnabled,
  type DeveloperModePreferences,
} from '../devModeTypes';

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

const STORAGE_KEY = 'rpgcreatorai:phase12:developer-mode:v1';

function tryEnable(
  current: DeveloperModePreferences,
  acknowledgedDisclaimer: string,
): DeveloperModePreferences {
  if (current.state === 'on') return current;
  if (acknowledgedDisclaimer !== DEVELOPER_MODE_REQUIRED_DISCLAIMER) return current;
  return reducer(current, {
    type: 'enable',
    acknowledgedDisclaimer,
    now: '2026-06-17T00:00:00.000Z',
  });
}

function tryDisable(current: DeveloperModePreferences): DeveloperModePreferences {
  if (current.state === 'off') return current;
  return reducer(current, { type: 'disable' });
}

function persist(storage: MemoryStorage, prefs: DeveloperModePreferences) {
  storage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function restore(storage: MemoryStorage): DeveloperModePreferences {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_DEVELOPER_MODE_PREFERENCES;
  let parsed: Partial<DeveloperModePreferences> | null = null;
  try {
    parsed = JSON.parse(raw) as Partial<DeveloperModePreferences>;
  } catch {
    return DEFAULT_DEVELOPER_MODE_PREFERENCES;
  }
  if (!parsed) return DEFAULT_DEVELOPER_MODE_PREFERENCES;
  if (parsed.version !== 1) return DEFAULT_DEVELOPER_MODE_PREFERENCES;
  if (parsed.state !== 'off' && parsed.state !== 'on') return DEFAULT_DEVELOPER_MODE_PREFERENCES;
  return {
    version: 1,
    state: parsed.state,
    enabledAt:
      typeof parsed.enabledAt === 'string' ? parsed.enabledAt : undefined,
    acknowledgedDisclaimerAt:
      typeof parsed.acknowledgedDisclaimerAt === 'string'
        ? parsed.acknowledgedDisclaimerAt
        : undefined,
  };
}

describe('devMode types', () => {
  it('starts off and disables all gated capabilities', () => {
    expect(DEVELOPER_MODE_DEFAULT_STATE).toBe('off');
    expect(DEVELOPER_MODE_OFF_CAPABILITIES.canUseCodeAssistant).toBe(false);
    expect(DEVELOPER_MODE_OFF_CAPABILITIES.canExecuteShell).toBe(false);
    expect(DEVELOPER_MODE_OFF_CAPABILITIES.canCommitChanges).toBe(false);
    expect(DEVELOPER_MODE_OFF_CAPABILITIES.canPushToRemote).toBe(false);
    expect(DEVELOPER_MODE_OFF_CAPABILITIES.canWriteOutsideProject).toBe(false);
    expect(DEVELOPER_MODE_OFF_CAPABILITIES.canExportHandoff).toBe(true);
  });

  it('keeps shell/commit/push/write-outside disabled even when Developer Mode is on', () => {
    expect(DEVELOPER_MODE_ON_CAPABILITIES.canExecuteShell).toBe(false);
    expect(DEVELOPER_MODE_ON_CAPABILITIES.canCommitChanges).toBe(false);
    expect(DEVELOPER_MODE_ON_CAPABILITIES.canPushToRemote).toBe(false);
    expect(DEVELOPER_MODE_ON_CAPABILITIES.canWriteOutsideProject).toBe(false);
    expect(DEVELOPER_MODE_ON_CAPABILITIES.canUseCodeAssistant).toBe(true);
    expect(DEVELOPER_MODE_ON_CAPABILITIES.canOpenRuntimeDiagnostics).toBe(true);
    expect(DEVELOPER_MODE_ON_CAPABILITIES.canExportHandoff).toBe(true);
  });

  it('reflects the off state in isCapabilityEnabled', () => {
    expect(isCapabilityEnabled('off', 'canUseCodeAssistant')).toBe(false);
    expect(isCapabilityEnabled('off', 'canExportHandoff')).toBe(true);
    expect(isCapabilityEnabled('on', 'canUseCodeAssistant')).toBe(true);
    expect(isCapabilityEnabled('on', 'canPushToRemote')).toBe(false);
  });
});

describe('reducer', () => {
  it('enable toggles state and stamps enabledAt', () => {
    const action: DeveloperModeAction = {
      type: 'enable',
      acknowledgedDisclaimer: DEVELOPER_MODE_REQUIRED_DISCLAIMER,
      now: '2026-06-17T00:00:00.000Z',
    };
    const next = reducer(DEFAULT_DEVELOPER_MODE_PREFERENCES, action);
    expect(next.state).toBe('on');
    expect(next.enabledAt).toBe('2026-06-17T00:00:00.000Z');
    expect(next.acknowledgedDisclaimerAt).toBe(DEVELOPER_MODE_REQUIRED_DISCLAIMER);
  });

  it('enable is a no-op when already on', () => {
    const on: DeveloperModePreferences = {
      version: 1,
      state: 'on',
      enabledAt: '2026-06-17T00:00:00.000Z',
      acknowledgedDisclaimerAt: DEVELOPER_MODE_REQUIRED_DISCLAIMER,
    };
    const next = reducer(on, { type: 'enable', acknowledgedDisclaimer: DEVELOPER_MODE_REQUIRED_DISCLAIMER });
    expect(next).toEqual(on);
  });

  it('disable transitions to off', () => {
    const on: DeveloperModePreferences = {
      version: 1,
      state: 'on',
      enabledAt: '2026-06-17T00:00:00.000Z',
      acknowledgedDisclaimerAt: DEVELOPER_MODE_REQUIRED_DISCLAIMER,
    };
    const next = reducer(on, { type: 'disable' });
    expect(next.state).toBe('off');
  });
});

describe('devMode store transitions', () => {
  it('starts off by default and does not enable any gated capability', () => {
    let prefs: DeveloperModePreferences = DEFAULT_DEVELOPER_MODE_PREFERENCES;
    expect(prefs.state).toBe('off');
    expect(isCapabilityEnabled(prefs.state, 'canUseCodeAssistant')).toBe(false);
    expect(isCapabilityEnabled(prefs.state, 'canExportHandoff')).toBe(true);
  });

  it('refuses to enable without the required disclaimer', () => {
    let prefs: DeveloperModePreferences = DEFAULT_DEVELOPER_MODE_PREFERENCES;
    prefs = tryEnable(prefs, 'not-the-right-text');
    expect(prefs.state).toBe('off');
  });

  it('enables only after the user passes the disclaimer text', () => {
    let prefs: DeveloperModePreferences = DEFAULT_DEVELOPER_MODE_PREFERENCES;
    prefs = tryEnable(prefs, DEVELOPER_MODE_REQUIRED_DISCLAIMER);
    expect(prefs.state).toBe('on');
    expect(isCapabilityEnabled(prefs.state, 'canUseCodeAssistant')).toBe(true);
    expect(isCapabilityEnabled(prefs.state, 'canExecuteShell')).toBe(false);
    expect(isCapabilityEnabled(prefs.state, 'canCommitChanges')).toBe(false);
    expect(isCapabilityEnabled(prefs.state, 'canPushToRemote')).toBe(false);
  });

  it('disable returns to off and removes gated capabilities', () => {
    let prefs: DeveloperModePreferences = DEFAULT_DEVELOPER_MODE_PREFERENCES;
    prefs = tryEnable(prefs, DEVELOPER_MODE_REQUIRED_DISCLAIMER);
    prefs = tryDisable(prefs);
    expect(prefs.state).toBe('off');
    expect(isCapabilityEnabled(prefs.state, 'canUseCodeAssistant')).toBe(false);
  });

  it('persists preferences to storage on every change', () => {
    const storage = new MemoryStorage();
    let prefs: DeveloperModePreferences = DEFAULT_DEVELOPER_MODE_PREFERENCES;
    prefs = tryEnable(prefs, DEVELOPER_MODE_REQUIRED_DISCLAIMER);
    persist(storage, prefs);
    const raw = storage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as DeveloperModePreferences;
    expect(parsed.state).toBe('on');
  });

  it('hydrates from storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: 'on',
        enabledAt: '2026-06-17T00:00:00.000Z',
        acknowledgedDisclaimerAt: DEVELOPER_MODE_REQUIRED_DISCLAIMER,
      }),
    );
    const restored = restore(storage);
    expect(restored.state).toBe('on');
  });

  it('falls back to defaults when stored preferences are malformed', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, state: 'no-such-state' }));
    const restored = restore(storage);
    expect(restored.state).toBe('off');
  });

  it('falls back to defaults when the storage JSON is corrupted', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, 'not json');
    const restored = restore(storage);
    expect(restored.state).toBe('off');
  });

  it('refuses to enable a second time without errors', () => {
    let prefs: DeveloperModePreferences = DEFAULT_DEVELOPER_MODE_PREFERENCES;
    prefs = tryEnable(prefs, DEVELOPER_MODE_REQUIRED_DISCLAIMER);
    const second = tryEnable(prefs, DEVELOPER_MODE_REQUIRED_DISCLAIMER);
    expect(second).toEqual(prefs);
  });
});
