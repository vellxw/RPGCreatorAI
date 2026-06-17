/**
 * Phase 12 M04 — Creator Mode Preferences (PX-100, FRA-540).
 *
 * Persists the active creator mode and per-workflow override list to a
 * localStorage-backed preference bag. The store reads these values during
 * initial state setup and writes them on every update. Storage is keyed by
 * a stable namespace so multiple projects do not collide.
 *
 * The persistence layer is intentionally small, dependency-free, and only
 * touches the localStorage namespace. It is a presentational helper for the
 * creator mode settings surface, not a project-data mutation.
 */

import type { CreatorProviderMode, PerWorkflowOverride } from './providerMode';

const STORAGE_NAMESPACE = 'rpgcreatorai:phase12:provider-mode';
const STORAGE_VERSION = 1;

export interface ProviderModePreferences {
  version: number;
  mode: CreatorProviderMode;
  overrides: PerWorkflowOverride[];
}

export const DEFAULT_PROVIDER_MODE_PREFERENCES: ProviderModePreferences = {
  version: STORAGE_VERSION,
  mode: 'recommended',
  overrides: [],
};

function storageKey(scope: string): string {
  return `${STORAGE_NAMESPACE}:${scope}`;
}

function isCreatorProviderMode(value: unknown): value is CreatorProviderMode {
  return (
    value === 'recommended' ||
    value === 'fast-cheap' ||
    value === 'best-quality' ||
    value === 'local-mock' ||
    value === 'custom-advanced'
  );
}

function sanitizeOverrides(value: unknown): PerWorkflowOverride[] {
  if (!Array.isArray(value)) return [];
  const out: PerWorkflowOverride[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.workflowId === 'string' &&
      typeof candidate.providerId === 'string' &&
      typeof candidate.modelId === 'string'
    ) {
      out.push({
        workflowId: candidate.workflowId,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
      });
    }
  }
  return out;
}

export function loadProviderModePreferences(
  scope: string,
  storage: Pick<Storage, 'getItem'> | null,
): ProviderModePreferences {
  if (!storage) return DEFAULT_PROVIDER_MODE_PREFERENCES;
  try {
    const raw = storage.getItem(storageKey(scope));
    if (!raw) return DEFAULT_PROVIDER_MODE_PREFERENCES;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || parsed.version !== STORAGE_VERSION) {
      return DEFAULT_PROVIDER_MODE_PREFERENCES;
    }
    if (!isCreatorProviderMode(parsed.mode)) {
      return DEFAULT_PROVIDER_MODE_PREFERENCES;
    }
    return {
      version: STORAGE_VERSION,
      mode: parsed.mode,
      overrides: sanitizeOverrides(parsed.overrides),
    };
  } catch {
    return DEFAULT_PROVIDER_MODE_PREFERENCES;
  }
}

export function saveProviderModePreferences(
  scope: string,
  preferences: ProviderModePreferences,
  storage: Pick<Storage, 'setItem'> | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(storageKey(scope), JSON.stringify(preferences));
  } catch {
    /* ignore storage write failures */
  }
}

export function clearProviderModePreferences(
  scope: string,
  storage: Pick<Storage, 'removeItem'> | null,
): void {
  if (!storage) return;
  try {
    storage.removeItem(storageKey(scope));
  } catch {
    /* ignore */
  }
}
