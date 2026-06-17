/**
 * Phase 12 M04 — Creator-First Provider Mode Presets (PX-086..PX-092, FRA-525..FRA-531).
 *
 * Translates a creator-facing preset ("Recommended", "Fast/cheap", "Best
 * quality", "Local/mock", "Custom advanced") into a per-workflow provider and
 * model selection. The host (Settings store) owns the active mode and the
 * override map; this module is a pure presentational helper.
 *
 * The five modes align with `docs/PHASE_12_CREATOR_FIRST_AI_UX_PRINCIPLES.md`
 * (PX-007) and `docs/PHASE_12_PROVIDER_MODEL_SETTINGS_UX_AUDIT.md` (PX-002).
 */

import type { ProviderConfig } from '../types/project';
import type { ModelCapability, ModelCapabilityDescriptor } from './modelCapabilityRegistry';
import { providerWorkflowDefinitions } from './modelCapabilityRegistry';
import type { ProviderMetadata } from './providerRegistry';

export type CreatorProviderMode =
  | 'recommended'
  | 'fast-cheap'
  | 'best-quality'
  | 'local-mock'
  | 'custom-advanced';

export const CREATOR_PROVIDER_MODES: readonly CreatorProviderMode[] = [
  'recommended',
  'fast-cheap',
  'best-quality',
  'local-mock',
  'custom-advanced',
];

export interface CreatorModeDescriptor {
  id: CreatorProviderMode;
  label: string;
  detail: string;
  beginnerSummary: string;
  advancedSummary: string;
}

export const CREATOR_MODE_DESCRIPTORS: readonly CreatorModeDescriptor[] = [
  {
    id: 'recommended',
    label: 'Recommended',
    detail: 'Safe defaults for normal creator work. Local mock when available, Claude for text, OpenAI for images.',
    beginnerSummary: 'Works for most projects without changing anything.',
    advancedSummary: 'Picks the first credentialed provider per workflow; falls back to the offline mock provider when nothing is configured.',
  },
  {
    id: 'fast-cheap',
    label: 'Fast / cheap',
    detail: 'Lower-cost and faster models for iteration. Prefers local mock, then Haiku, then GPT-5.5.',
    beginnerSummary: 'Quicker drafts and lower cost while you iterate.',
    advancedSummary: 'Picks the cheapest configured provider per workflow; never escalates to a paid image model without explicit confirmation.',
  },
  {
    id: 'best-quality',
    label: 'Best quality',
    detail: 'Top-of-line models. Prefers Claude Opus, then MiniMax M3, then GPT-5.5 for text; GPT Image 2 for images.',
    beginnerSummary: 'Use this when quality matters more than speed or cost.',
    advancedSummary: 'Picks the highest-capability configured provider per workflow; surfaces cost confirmation before any paid work.',
  },
  {
    id: 'local-mock',
    label: 'Local / mock',
    detail: 'Stay offline. Uses the bundled local mock provider for every workflow. No credentials required.',
    beginnerSummary: 'Stay offline. No AI credentials, no network calls, no cost.',
    advancedSummary: 'Routes every workflow to the bundled local gateway mock; the renderer never sends prompts to a remote provider.',
  },
  {
    id: 'custom-advanced',
    label: 'Custom advanced',
    detail: 'You pick the provider and model per workflow. Use this when the default mapping is wrong for your project.',
    beginnerSummary: 'Pick a different provider or model for one workflow at a time.',
    advancedSummary: 'Resolves each workflow from the explicit per-workflow override map; advanced panel exposes raw provider controls.',
  },
];

export interface PerWorkflowOverride {
  workflowId: string;
  providerId: string;
  modelId: string;
}

export interface ResolvedWorkflowRoute {
  workflowId: string;
  label: string;
  providerId: string;
  providerName: string;
  modelId: string;
  modelLabel: string;
  source: 'recommended' | 'fast-cheap' | 'best-quality' | 'local-mock' | 'custom-advanced' | 'override' | 'fallback-local';
  free: boolean;
}

const FAST_CHEAP_TEXT_PREFERENCE: ReadonlyArray<{ providerId: string; modelId: string }> = [
  { providerId: 'local', modelId: 'offline-mock' },
  { providerId: 'anthropic', modelId: 'claude-haiku-4-5-20251001' },
  { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
  { providerId: 'moonshot', modelId: 'moonshot-v1-8k' },
  { providerId: 'minimax', modelId: 'MiniMax-M2.7-highspeed' },
  { providerId: 'openai', modelId: 'gpt-5.5' },
];

const BEST_QUALITY_TEXT_PREFERENCE: ReadonlyArray<{ providerId: string; modelId: string }> = [
  { providerId: 'anthropic', modelId: 'claude-opus-4-8' },
  { providerId: 'minimax', modelId: 'MiniMax-M3' },
  { providerId: 'openai', modelId: 'gpt-5.5' },
  { providerId: 'moonshot', modelId: 'kimi-k2.6' },
  { providerId: 'deepseek', modelId: 'deepseek-v4-pro' },
];

const RECOMMENDED_TEXT_PREFERENCE: ReadonlyArray<{ providerId: string; modelId: string }> = [
  { providerId: 'local', modelId: 'offline-mock' },
  { providerId: 'anthropic', modelId: 'claude-sonnet-4-6' },
  { providerId: 'openai', modelId: 'gpt-5.5' },
];

const IMAGE_PREFERENCE: ReadonlyArray<{ providerId: string; modelId: string }> = [
  { providerId: 'local', modelId: 'offline-image-mock' },
  { providerId: 'openai', modelId: 'gpt-image-2' },
  { providerId: 'minimax', modelId: 'image-01' },
];

const IMAGE_EDIT_PREFERENCE: ReadonlyArray<{ providerId: string; modelId: string }> = [
  { providerId: 'local', modelId: 'offline-image-edit-mock' },
  { providerId: 'openai', modelId: 'gpt-image-2' },
];

const STRUCTURED_JSON_PREFERENCE: ReadonlyArray<{ providerId: string; modelId: string }> = [
  { providerId: 'local', modelId: 'offline-mock' },
  { providerId: 'anthropic', modelId: 'claude-haiku-4-5-20251001' },
  { providerId: 'openai', modelId: 'gpt-5.5' },
];

const CODE_TOOLING_PREFERENCE: ReadonlyArray<{ providerId: string; modelId: string }> = [
  { providerId: 'opencode', modelId: 'opencode-workflow' },
  { providerId: 'local', modelId: 'offline-mock' },
  { providerId: 'anthropic', modelId: 'claude-sonnet-4-6' },
  { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
];

const ANIMATION_PREFERENCE: ReadonlyArray<{ providerId: string; modelId: string }> = [
  { providerId: 'local', modelId: 'offline-mock' },
];

function isProviderRoutable(provider: ProviderConfig): boolean {
  if (!provider.enabled) return false;
  if (provider.credentialState === 'missing') return false;
  if (provider.id === 'opencode') return true;
  return provider.model.trim().length > 0;
}

function findDescriptor(
  registry: readonly ModelCapabilityDescriptor[],
  providerId: string,
  modelId: string,
): ModelCapabilityDescriptor | undefined {
  return registry.find(d => d.providerId === providerId && d.modelId === modelId);
}

function descriptorSupportsCapability(
  descriptor: ModelCapabilityDescriptor | undefined,
  capability: ModelCapability,
): boolean {
  if (!descriptor) return false;
  return descriptor.capabilities.includes(capability);
}

function lookupPreferenceForCapability(
  capability: ModelCapability,
  mode: CreatorProviderMode,
): ReadonlyArray<{ providerId: string; modelId: string }> {
  if (capability === 'image') return IMAGE_PREFERENCE;
  if (capability === 'image-edit') return IMAGE_EDIT_PREFERENCE;
  if (capability === 'video') return ANIMATION_PREFERENCE;

  if (mode === 'fast-cheap') {
    if (capability === 'structured-json') return STRUCTURED_JSON_PREFERENCE;
    if (capability === 'code') return CODE_TOOLING_PREFERENCE;
    return FAST_CHEAP_TEXT_PREFERENCE;
  }
  if (mode === 'best-quality') {
    if (capability === 'structured-json') return STRUCTURED_JSON_PREFERENCE;
    if (capability === 'code') return CODE_TOOLING_PREFERENCE;
    return BEST_QUALITY_TEXT_PREFERENCE;
  }
  if (mode === 'local-mock') {
    return [{ providerId: 'local', modelId: 'offline-mock' }];
  }
  if (mode === 'custom-advanced') {
    return [];
  }
  if (capability === 'structured-json') return STRUCTURED_JSON_PREFERENCE;
  if (capability === 'code') return CODE_TOOLING_PREFERENCE;
  return RECOMMENDED_TEXT_PREFERENCE;
}

function isProviderFree(metadata: ProviderMetadata | undefined): boolean {
  if (!metadata) return false;
  return metadata.cost.estimateAvailability === 'free' && !metadata.cost.paidOperations;
}

function findMetadata(registry: readonly ProviderMetadata[], providerId: string): ProviderMetadata | undefined {
  return registry.find(m => m.id === providerId);
}

function resolveRoute(
  workflow: { id: string; label: string; requiredCapability: ModelCapability },
  providers: readonly ProviderConfig[],
  registry: readonly ModelCapabilityDescriptor[],
  providerRegistry: readonly ProviderMetadata[],
  mode: CreatorProviderMode,
  override: PerWorkflowOverride | undefined,
): ResolvedWorkflowRoute {
  const routableProviders = providers.filter(isProviderRoutable);

  if (mode === 'custom-advanced' && override) {
    const provider = routableProviders.find(p => p.id === override.providerId);
    if (provider) {
      const descriptor = findDescriptor(registry, override.providerId, override.modelId);
      if (descriptor && descriptorSupportsCapability(descriptor, workflow.requiredCapability)) {
        return {
          workflowId: workflow.id,
          label: workflow.label,
          providerId: provider.id,
          providerName: provider.name,
          modelId: descriptor.modelId,
          modelLabel: descriptor.label,
          source: 'override',
          free: isProviderFree(findMetadata(providerRegistry, provider.id)),
        };
      }
    }
  }

  if (mode === 'local-mock') {
    const localProvider = routableProviders.find(p => p.id === 'local');
    if (localProvider) {
      return {
        workflowId: workflow.id,
        label: workflow.label,
        providerId: localProvider.id,
        providerName: localProvider.name,
        modelId: 'offline-mock',
        modelLabel: 'Offline mock',
        source: 'local-mock',
        free: true,
      };
    }
  }

  const preference = lookupPreferenceForCapability(workflow.requiredCapability, mode);
  for (const candidate of preference) {
    const provider = routableProviders.find(p => p.id === candidate.providerId);
    if (!provider) continue;
    const descriptor = findDescriptor(registry, candidate.providerId, candidate.modelId);
    if (!descriptor) continue;
    if (!descriptorSupportsCapability(descriptor, workflow.requiredCapability)) continue;
    return {
      workflowId: workflow.id,
      label: workflow.label,
      providerId: provider.id,
      providerName: provider.name,
      modelId: descriptor.modelId,
      modelLabel: descriptor.label,
      source: mode,
      free: isProviderFree(findMetadata(providerRegistry, provider.id)),
    };
  }

  const fallbackProvider = routableProviders.find(p => p.id === 'local');
  if (fallbackProvider) {
    const fallbackModel = workflow.requiredCapability === 'image'
      ? 'offline-image-mock'
      : workflow.requiredCapability === 'image-edit'
        ? 'offline-image-edit-mock'
        : 'offline-mock';
    return {
      workflowId: workflow.id,
      label: workflow.label,
      providerId: fallbackProvider.id,
      providerName: fallbackProvider.name,
      modelId: fallbackModel,
      modelLabel: 'Offline mock',
      source: 'fallback-local',
      free: true,
    };
  }

  return {
    workflowId: workflow.id,
    label: workflow.label,
    providerId: 'local',
    providerName: 'Local gateway',
    modelId: 'offline-mock',
    modelLabel: 'Offline mock',
    source: 'fallback-local',
    free: true,
  };
}

export interface ResolveCreatorModeInput {
  mode: CreatorProviderMode;
  providers: readonly ProviderConfig[];
  registry?: readonly ModelCapabilityDescriptor[];
  providerRegistry?: readonly ProviderMetadata[];
  overrides?: readonly PerWorkflowOverride[];
}

export function resolveCreatorModeRoutes(input: ResolveCreatorModeInput): ResolvedWorkflowRoute[] {
  const overrides = input.overrides ?? [];
  return providerWorkflowDefinitions.map(workflow => {
    const override = overrides.find(o => o.workflowId === workflow.id);
    return resolveRoute(
      workflow,
      input.providers,
      input.registry ?? [],
      input.providerRegistry ?? [],
      input.mode,
      override,
    );
  });
}

export function describeMode(id: CreatorProviderMode): CreatorModeDescriptor {
  const found = CREATOR_MODE_DESCRIPTORS.find(d => d.id === id);
  if (!found) {
    throw new Error(`Unknown creator provider mode: ${id}`);
  }
  return found;
}

export function isPaidRoute(route: ResolvedWorkflowRoute): boolean {
  return !route.free;
}

export function summarizeMode(input: ResolveCreatorModeInput): {
  mode: CreatorProviderMode;
  totalRoutes: number;
  freeRoutes: number;
  paidRoutes: number;
  fallbackRoutes: number;
  overrideRoutes: number;
} {
  const routes = resolveCreatorModeRoutes(input);
  return {
    mode: input.mode,
    totalRoutes: routes.length,
    freeRoutes: routes.filter(r => r.free).length,
    paidRoutes: routes.filter(r => !r.free).length,
    fallbackRoutes: routes.filter(r => r.source === 'fallback-local').length,
    overrideRoutes: routes.filter(r => r.source === 'override').length,
  };
}
