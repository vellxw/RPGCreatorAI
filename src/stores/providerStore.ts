import { useState } from 'react';
import type { ProviderConfig } from '../types/project';

const defaultProviders: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    status: 'connected',
    model: 'gpt-4o (recommended)',
    apiKey: '',
    capabilities: ['Text', 'Code', 'Vision', 'Image'],
    lastTested: '2 minutes ago',
  },
  {
    id: 'claude',
    name: 'Claude',
    status: 'connected',
    model: 'Claude 3.5 Sonnet',
    apiKey: '',
    capabilities: ['Text', 'Code', 'Planning'],
    lastTested: '1 minute ago',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    status: 'not-connected',
    model: '',
    apiKey: '',
    capabilities: ['Text', 'Vision', 'Image'],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    status: 'connected',
    model: 'NVIDIA Nemotron 4 340B Instruct',
    apiKey: '',
    capabilities: ['Text', 'Vision', 'Embeddings', 'Image', 'Video'],
    lastTested: '3 minutes ago',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible endpoint',
    status: 'not-tested',
    model: 'custom-model',
    apiKey: '',
    capabilities: [],
  },
  {
    id: 'local',
    name: 'Local Models',
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
    codeGeneration: 'Claude / GPT',
    dialogueGeneration: 'Gemini / Claude',
    imageGeneration: 'OpenAI Image / Gemini / NVIDIA',
    embeddings: 'NVIDIA',
    fallbackModel: 'Custom endpoint',
  });
  const [safety, setSafety] = useState<UsageSafety>({
    monthlyBudget: 100,
    neverSendSecrets: true,
    requireConfirmBeforePush: true,
  });

  const testConnection = (id: string) => {
    setProviders(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, status: 'connected' as const, lastTested: 'just now' }
          : p
      )
    );
  };

  return { providers, setProviders, routing, setRouting, safety, setSafety, testConnection };
}
