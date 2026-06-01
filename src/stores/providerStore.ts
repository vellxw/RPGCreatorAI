import { useState } from 'react';
import type { ProviderConfig } from '../types/project';

const defaultProviders: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    status: 'not-connected',
    model: '',
    apiKey: '',
    capabilities: ['Text', 'Code', 'Vision', 'Image'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    status: 'not-connected',
    model: '',
    apiKey: '',
    capabilities: ['Text', 'Code', 'Planning'],
  },
  {
    id: 'moonshot',
    name: 'Kimi / Moonshot',
    status: 'not-connected',
    model: '',
    apiKey: '',
    capabilities: ['Text', 'Code', 'OpenAI-compatible'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    status: 'not-connected',
    model: '',
    apiKey: '',
    capabilities: ['Text', 'Code', 'OpenAI-compatible'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    status: 'not-connected',
    model: '',
    apiKey: '',
    capabilities: ['Text', 'Image', 'Video', 'Audio'],
  },
  {
    id: 'opencode',
    name: 'OpenCode adapter',
    status: 'not-connected',
    model: '',
    apiKey: '',
    capabilities: ['Code', 'External tool adapter'],
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible endpoint',
    status: 'not-tested',
    model: '',
    apiKey: '',
    capabilities: [],
  },
  {
    id: 'local',
    name: 'Local gateway',
    status: 'coming-later',
    model: '',
    apiKey: '',
    capabilities: [],
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

export function useProviderStore() {
  const [providers, setProviders] = useState<ProviderConfig[]>(defaultProviders);
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
          ? { ...p, status: 'not-tested' as const, lastTested: 'requires explicit credential opt-in' }
          : p
      )
    );
  };

  return { providers, setProviders, routing, setRouting, safety, setSafety, testConnection };
}
