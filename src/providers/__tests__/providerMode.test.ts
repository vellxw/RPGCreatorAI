import { describe, expect, it } from 'vitest';
import {
  CREATOR_MODE_DESCRIPTORS,
  CREATOR_PROVIDER_MODES,
  describeMode,
  isPaidRoute,
  resolveCreatorModeRoutes,
  summarizeMode,
  type CreatorProviderMode,
} from '../providerMode';
import { defaultModelCapabilityRegistry } from '../modelCapabilityRegistry';
import { defaultProviderRegistry } from '../providerRegistry';
import type { ProviderConfig } from '../../types/project';

function makeProvider(overrides: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: 'openai',
    name: 'OpenAI',
    enabled: false,
    status: 'disabled',
    credentialState: 'missing',
    model: '',
    capabilities: ['text', 'image'],
    imageSettings: undefined,
    customCapabilities: undefined,
    baseUrl: undefined,
    lastChecked: undefined,
    ...overrides,
  };
}

function makeLocalProvider(): ProviderConfig {
  return makeProvider({
    id: 'local',
    name: 'Local gateway',
    enabled: true,
    status: 'configured',
    credentialState: 'not-required',
    model: 'offline-mock',
    capabilities: ['text', 'image', 'image-edit'],
  });
}

function makeAnthropicProvider(): ProviderConfig {
  return makeProvider({
    id: 'anthropic',
    name: 'Anthropic Claude',
    enabled: true,
    status: 'configured',
    credentialState: 'configured',
    model: 'claude-opus-4-8',
    capabilities: ['text', 'code'],
  });
}

describe('creator provider modes', () => {
  it('exposes the five canonical creator modes', () => {
    expect(CREATOR_PROVIDER_MODES).toEqual([
      'recommended',
      'fast-cheap',
      'best-quality',
      'local-mock',
      'custom-advanced',
    ]);
    expect(CREATOR_MODE_DESCRIPTORS.length).toBe(CREATOR_PROVIDER_MODES.length);
  });

  it('describeMode returns the matching descriptor for every canonical id', () => {
    for (const id of CREATOR_PROVIDER_MODES) {
      const descriptor = describeMode(id);
      expect(descriptor.id).toBe(id);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.beginnerSummary.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveCreatorModeRoutes', () => {
  it('local-mock routes every workflow to the offline mock', () => {
    const providers = [makeLocalProvider()];
    const routes = resolveCreatorModeRoutes({
      mode: 'local-mock',
      providers,
      registry: defaultModelCapabilityRegistry,
      providerRegistry: defaultProviderRegistry,
    });
    expect(routes.every(r => r.providerId === 'local')).toBe(true);
    expect(routes.every(r => r.free)).toBe(true);
  });

  it('recommended prefers the offline mock when configured for text, image, and image-edit workflows', () => {
    const routes = resolveCreatorModeRoutes({
      mode: 'recommended',
      providers: [makeLocalProvider()],
      registry: defaultModelCapabilityRegistry,
      providerRegistry: defaultProviderRegistry,
    });
    const routableFromMock = routes.filter(r =>
      ['text-draft', 'image-generation', 'image-edit'].includes(r.workflowId),
    );
    expect(routableFromMock.length).toBeGreaterThan(0);
    for (const r of routableFromMock) {
      expect(r.providerId).toBe('local');
      expect(r.source).toBe('recommended');
    }
  });

  it('recommended picks anthropic when only anthropic is configured', () => {
    const routes = resolveCreatorModeRoutes({
      mode: 'recommended',
      providers: [makeAnthropicProvider()],
      registry: defaultModelCapabilityRegistry,
      providerRegistry: defaultProviderRegistry,
    });
    const textRoute = routes.find(r => r.workflowId === 'text-draft');
    expect(textRoute?.providerId).toBe('anthropic');
  });

  it('best-quality picks the highest capability model for text', () => {
    const routes = resolveCreatorModeRoutes({
      mode: 'best-quality',
      providers: [makeAnthropicProvider()],
      registry: defaultModelCapabilityRegistry,
      providerRegistry: defaultProviderRegistry,
    });
    const textRoute = routes.find(r => r.workflowId === 'text-draft');
    expect(textRoute?.providerId).toBe('anthropic');
    expect(textRoute?.modelId).toBe('claude-opus-4-8');
    expect(textRoute?.free).toBe(false);
  });

  it('custom-advanced falls back to the local mock when no override is provided', () => {
    const routes = resolveCreatorModeRoutes({
      mode: 'custom-advanced',
      providers: [makeLocalProvider()],
      registry: defaultModelCapabilityRegistry,
      providerRegistry: defaultProviderRegistry,
    });
    expect(routes.every(r => r.providerId === 'local')).toBe(true);
  });

  it('custom-advanced honors an explicit per-workflow override', () => {
    const routes = resolveCreatorModeRoutes({
      mode: 'custom-advanced',
      providers: [makeLocalProvider(), makeAnthropicProvider()],
      registry: defaultModelCapabilityRegistry,
      providerRegistry: defaultProviderRegistry,
      overrides: [
        { workflowId: 'text-draft', providerId: 'anthropic', modelId: 'claude-opus-4-8' },
      ],
    });
    const textRoute = routes.find(r => r.workflowId === 'text-draft');
    expect(textRoute?.source).toBe('override');
    expect(textRoute?.providerId).toBe('anthropic');
    expect(textRoute?.modelId).toBe('claude-opus-4-8');
  });

  it('falls back to the local mock when no provider can route a workflow', () => {
    const providers = [makeAnthropicProvider()];
    const routes = resolveCreatorModeRoutes({
      mode: 'recommended',
      providers,
      registry: defaultModelCapabilityRegistry,
      providerRegistry: defaultProviderRegistry,
    });
    const imageRoute = routes.find(r => r.workflowId === 'image-generation');
    expect(imageRoute?.source).toBe('fallback-local');
    expect(imageRoute?.providerId).toBe('local');
  });

  it('isPaidRoute reports the cost flag correctly', () => {
    const freeRoute = {
      workflowId: 'text-draft',
      label: 'Text draft',
      providerId: 'local',
      providerName: 'Local gateway',
      modelId: 'offline-mock',
      modelLabel: 'Offline mock',
      source: 'local-mock' as const,
      free: true,
    };
    const paidRoute = { ...freeRoute, providerId: 'anthropic', free: false };
    expect(isPaidRoute(freeRoute)).toBe(false);
    expect(isPaidRoute(paidRoute)).toBe(true);
  });
});

describe('summarizeMode', () => {
  it('counts free, paid, fallback, and override routes', () => {
    const summary = summarizeMode({
      mode: 'custom-advanced',
      providers: [makeLocalProvider(), makeAnthropicProvider()],
      registry: defaultModelCapabilityRegistry,
      providerRegistry: defaultProviderRegistry,
      overrides: [
        { workflowId: 'text-draft', providerId: 'anthropic', modelId: 'claude-opus-4-8' },
      ],
    });
    expect(summary.mode).toBe('custom-advanced');
    expect(summary.totalRoutes).toBeGreaterThan(0);
    expect(summary.overrideRoutes).toBe(1);
    expect(summary.freeRoutes + summary.paidRoutes).toBe(summary.totalRoutes);
  });

  it('reports the active mode and never mutates input', () => {
    const providers: ProviderConfig[] = [makeLocalProvider()];
    const summary = summarizeMode({
      mode: 'local-mock' as CreatorProviderMode,
      providers,
      registry: defaultModelCapabilityRegistry,
      providerRegistry: defaultProviderRegistry,
    });
    expect(summary.mode).toBe('local-mock');
    expect(providers[0]?.id).toBe('local');
  });
});
