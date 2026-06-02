import { useState, type Dispatch, type SetStateAction } from 'react';
import type { ProviderConfig } from '../types/project';
import { providerConfigsFromRegistry } from '../providers/providerRegistry';

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

export function useProviderStore(initialProviders: ProviderConfig[] = defaultProviderConfigs): ProviderStoreValue {
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

  const testConnection = (id: string) => {
    setProviders(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, status: providerStatusFor(p), lastChecked: 'requires explicit credential opt-in' }
          : p
      )
    );
  };

  return { providers, setProviders, routing, setRouting, safety, setSafety, testConnection };
}
