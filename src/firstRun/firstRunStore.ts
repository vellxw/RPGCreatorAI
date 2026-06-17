import { useEffect, useReducer } from 'react';
import {
  DEFAULT_FIRST_RUN_PREFERENCES,
  getFirstRunPath,
  type FirstRunPath,
  type FirstRunPreferences,
  type FirstRunStarterPath,
} from './firstRunTypes';

const STORAGE_KEY = 'rpgcreatorai:phase12:first-run:v1';
const STORAGE_VERSION = 1;

export type FirstRunAction =
  | { type: 'select-path'; pathId: FirstRunStarterPath }
  | { type: 'complete'; now?: string }
  | { type: 'reset' }
  | { type: 'restore'; preferences: FirstRunPreferences };

export function reducer(state: FirstRunPreferences, action: FirstRunAction): FirstRunPreferences {
  switch (action.type) {
    case 'select-path':
      if (!isFirstRunStarterPath(action.pathId)) return state;
      return { ...state, selectedPath: action.pathId };
    case 'complete':
      if (state.selectedPath === null) return state;
      return {
        ...state,
        hasCompletedFirstRun: true,
        completedAt: action.now ?? new Date().toISOString(),
      };
    case 'reset':
      return { ...DEFAULT_FIRST_RUN_PREFERENCES };
    case 'restore':
      return normalizePreferences(action.preferences);
  }
}

function isFirstRunStarterPath(value: string): value is FirstRunStarterPath {
  return value === 'blank' || value === 'town-template' || value === 'bundled-sample';
}

function normalizePreferences(raw: unknown): FirstRunPreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_FIRST_RUN_PREFERENCES;
  const candidate = raw as Partial<FirstRunPreferences>;
  if (candidate.version !== STORAGE_VERSION) return DEFAULT_FIRST_RUN_PREFERENCES;
  const selectedPath =
    typeof candidate.selectedPath === 'string' && isFirstRunStarterPath(candidate.selectedPath)
      ? candidate.selectedPath
      : null;
  return {
    version: STORAGE_VERSION,
    hasCompletedFirstRun: Boolean(candidate.hasCompletedFirstRun),
    selectedPath,
    completedAt:
      typeof candidate.completedAt === 'string' ? candidate.completedAt : undefined,
  };
}

function safeRead(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  key: string,
): FirstRunPreferences | null {
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
  value: FirstRunPreferences,
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

export interface UseFirstRunOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  initial?: FirstRunPreferences;
}

export interface FirstRunApi {
  preferences: FirstRunPreferences;
  hasCompletedFirstRun: boolean;
  selectedPath: FirstRunPath | null;
  selectPath: (pathId: FirstRunStarterPath) => void;
  complete: () => void;
  reset: () => void;
  isFirstRun: boolean;
}

export function useFirstRun(options: UseFirstRunOptions = {}): FirstRunApi {
  const storage = options.storage ?? defaultStorage();
  const [preferences, dispatch] = useReducer(
    reducer,
    options.initial ?? DEFAULT_FIRST_RUN_PREFERENCES,
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

  const selectedPath = preferences.selectedPath ? getFirstRunPath(preferences.selectedPath) : null;
  return {
    preferences,
    hasCompletedFirstRun: preferences.hasCompletedFirstRun,
    selectedPath,
    selectPath: (pathId: FirstRunStarterPath) => dispatch({ type: 'select-path', pathId }),
    complete: () => dispatch({ type: 'complete' }),
    reset: () => dispatch({ type: 'reset' }),
    isFirstRun: !preferences.hasCompletedFirstRun,
  };
}

export const FIRST_RUN_STORAGE_KEY = STORAGE_KEY;
export { DEFAULT_FIRST_RUN_PREFERENCES };
