import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { ProviderConfig } from '../types/project';
import { providerConfigsFromRegistry } from '../providers/providerRegistry';
import {
  type CreatorProviderMode,
  type PerWorkflowOverride,
} from '../providers/providerMode';
import {
  DEFAULT_PROVIDER_MODE_PREFERENCES,
  loadProviderModePreferences,
  saveProviderModePreferences,
  type ProviderModePreferences,
} from '../providers/providerModePreferences';

export const defaultProviderConfigs: ProviderConfig[] = providerConfigsFromRegistry();

export interface ProviderRouting {
  codeGeneration: string;
  dialogueGeneration: string;
  imageGeneration: string;
  embeddings: string;
  fallbackModel: string;
}

export interface UsageSafety {
  monthlyBudget: number;
  neverSendSecrets: boolean;
  requireConfirmBeforePush: boolean;
}

export interface ProviderStoreValue {
  providers: ProviderConfig[];
  setProviders: Dispatch<SetStateAction<ProviderConfig[]>>;
  routing: ProviderRouting;
  setRouting: Dispatch<SetStateAction<ProviderRouting>>;
  safety: UsageSafety;
  setSafety: Dispatch<SetStateAction<UsageSafety>>;
  testConnection: (id: string) => void;
  creatorMode: CreatorProviderMode;
  setCreatorMode: (mode: CreatorProviderMode) => void;
  workflowOverrides: PerWorkflowOverride[];
  setWorkflowOverride: (override: PerWorkflowOverride) => void;
  clearWorkflowOverride: (workflowId: string) => void;
  clearAllWorkflowOverrides: () => void;
  isAdvancedPanelOpen: boolean;
  setAdvancedPanelOpen: (open: boolean) => void;
  resetProviderModePreferences: () => void;
}

function cloneProviders(providers: ProviderConfig[]): ProviderConfig[] {
  return providers.map(provider => ({
    ...provider,
    capabilities: [...provider.capabilities],
  }));
}

export function providerStatusFor(provider: ProviderConfig): ProviderConfig['status'] {
  if (!provider.enabled) return 'disabled';
  if (provider.credentialState === 'configured' || provider.credentialState === 'not-required') {
    return 'configured';
  }
  return 'missing-credentials';
}

export function providerWithEnabled(provider: ProviderConfig, enabled: boolean): ProviderConfig {
  const next = { ...provider, enabled };
  return { ...next, status: providerStatusFor(next) };
}

export interface UseProviderStoreOptions {
  preferencesScope?: string;
  preferencesStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  initialPreferences?: ProviderModePreferences;
  enablePersistence?: boolean;
}

export function useProviderStore(
  initialProviders: ProviderConfig[] = defaultProviderConfigs,
  options: UseProviderStoreOptions = {},
): ProviderStoreValue {
  const enablePersistence = options.enablePersistence !== false;
  const storage = options.preferencesStorage ?? (typeof window === 'undefined' ? null : window.localStorage);
  const scope = options.preferencesScope ?? 'default';

  const initialPref = options.initialPreferences
    ?? (enablePersistence
      ? loadProviderModePreferences(scope, storage)
      : DEFAULT_PROVIDER_MODE_PREFERENCES);

  const [providers, setProviders] = useState<ProviderConfig[]>(() => cloneProviders(initialProviders));
  const [routing, setRouting] = useState<ProviderRouting>({
    codeGeneration: 'disabled',
    dialogueGeneration: 'disabled',
    imageGeneration: 'disabled',
    embeddings: 'disabled',
    fallbackModel: 'disabled',
  });
  const [safety, setSafety] = useState<UsageSafety>({
    monthlyBudget: 0,
    neverSendSecrets: true,
    requireConfirmBeforePush: true,
  });
  const [creatorMode, setCreatorModeState] = useState<CreatorProviderMode>(initialPref.mode);
  const [workflowOverrides, setWorkflowOverrides] = useState<PerWorkflowOverride[]>(initialPref.overrides);
  const [isAdvancedPanelOpen, setAdvancedPanelOpenState] = useState<boolean>(
    initialPref.mode === 'custom-advanced',
  );

  useEffect(() => {
    if (!enablePersistence) return;
    saveProviderModePreferences(
      scope,
      { version: 1, mode: creatorMode, overrides: workflowOverrides },
      storage,
    );
  }, [creatorMode, workflowOverrides, scope, storage, enablePersistence]);

  const setCreatorMode = useCallback((mode: CreatorProviderMode) => {
    setCreatorModeState(mode);
    setAdvancedPanelOpenState(mode === 'custom-advanced');
  }, []);

  const setWorkflowOverride = useCallback((override: PerWorkflowOverride) => {
    setWorkflowOverrides(current => {
      const without = current.filter(o => o.workflowId !== override.workflowId);
      return [...without, override];
    });
  }, []);

  const clearWorkflowOverride = useCallback((workflowId: string) => {
    setWorkflowOverrides(current => current.filter(o => o.workflowId !== workflowId));
  }, []);

  const clearAllWorkflowOverrides = useCallback(() => {
    setWorkflowOverrides([]);
  }, []);

  const resetProviderModePreferences = useCallback(() => {
    setCreatorModeState(DEFAULT_PROVIDER_MODE_PREFERENCES.mode);
    setWorkflowOverrides([]);
    setAdvancedPanelOpenState(DEFAULT_PROVIDER_MODE_PREFERENCES.mode === 'custom-advanced');
  }, []);

  const setAdvancedPanelOpen = useCallback((open: boolean) => {
    setAdvancedPanelOpenState(open);
  }, []);

  const testConnection = (id: string) => {
    setProviders(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, status: providerStatusFor(p), lastChecked: 'requires explicit credential opt-in' }
          : p
      )
    );
  };

  return {
    providers,
    setProviders,
    routing,
    setRouting,
    safety,
    setSafety,
    testConnection,
    creatorMode,
    setCreatorMode,
    workflowOverrides,
    setWorkflowOverride,
    clearWorkflowOverride,
    clearAllWorkflowOverrides,
    isAdvancedPanelOpen,
    setAdvancedPanelOpen,
    resetProviderModePreferences,
  };
}
