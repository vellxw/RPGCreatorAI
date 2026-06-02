import { useState, type Dispatch, type SetStateAction } from 'react';
import type { ProviderConfig } from '../types/project';

export const defaultProviderConfigs: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    enabled: false,
    status: 'disabled',
    model: '',
    credentialEnvVar: 'OPENAI_API_KEY',
    credentialState: 'missing',
    capabilities: ['Text generation', 'Image generation', 'Image editing', 'Vision analysis'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    enabled: false,
    status: 'disabled',
    model: '',
    credentialEnvVar: 'ANTHROPIC_API_KEY',
    credentialState: 'missing',
    capabilities: ['Text generation', 'Code assistance', 'Planning'],
  },
  {
    id: 'moonshot',
    name: 'Kimi / Moonshot',
    enabled: false,
    status: 'disabled',
    model: '',
    credentialEnvVar: 'MOONSHOT_API_KEY',
    credentialState: 'missing',
    capabilities: ['Text generation', 'Code assistance', 'OpenAI-compatible endpoint'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    enabled: false,
    status: 'disabled',
    model: '',
    credentialEnvVar: 'DEEPSEEK_API_KEY',
    credentialState: 'missing',
    capabilities: ['Text generation', 'Code assistance', 'OpenAI-compatible endpoint'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    enabled: false,
    status: 'disabled',
    model: '',
    credentialEnvVar: 'MINIMAX_API_KEY',
    credentialState: 'missing',
    capabilities: ['Text generation', 'Image generation', 'Video generation', 'Audio generation'],
  },
  {
    id: 'opencode',
    name: 'OpenCode adapter',
    enabled: false,
    status: 'disabled',
    model: '',
    credentialState: 'not-required',
    capabilities: ['Code assistance', 'External tool adapter'],
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible endpoint',
    enabled: false,
    status: 'disabled',
    model: '',
    credentialEnvVar: 'CUSTOM_OPENAI_API_KEY',
    credentialState: 'missing',
    capabilities: ['Text generation', 'OpenAI-compatible endpoint'],
  },
  {
    id: 'local',
    name: 'Local gateway',
    enabled: false,
    status: 'disabled',
    model: '',
    credentialState: 'not-required',
    capabilities: ['Offline mock contracts'],
  },
];

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
