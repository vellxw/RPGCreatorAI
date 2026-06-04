import type { ProviderConfig } from '../types/project';
import {
  defaultProviderRegistry,
  getProviderMetadata,
  type ProviderCostEstimateAvailability,
  type ProviderMetadata,
  type ProviderRateLimitStatus,
} from './providerRegistry';

export interface ProviderCostState {
  availability: ProviderCostEstimateAvailability;
  label: string;
  detail: string;
  currency?: 'USD';
  estimatedUsd?: number;
}

export interface ProviderRateLimitState {
  status: ProviderRateLimitStatus;
  label: string;
  retryGuidance: string;
  quotaGuidance?: string;
}

export interface ProviderBudgetState {
  requiresConfirmation: boolean;
  label: string;
  detail: string;
}

export interface ProviderCostBudgetState {
  providerId: string;
  providerName: string;
  enabled: boolean;
  configured: boolean;
  cost: ProviderCostState;
  rateLimit: ProviderRateLimitState;
  budget: ProviderBudgetState;
}

function isConfigured(provider: ProviderConfig): boolean {
  return provider.enabled &&
    (provider.credentialState === 'configured' || provider.credentialState === 'not-required');
}

function costLabel(availability: ProviderCostEstimateAvailability): string {
  if (availability === 'free') return 'Free/offline';
  if (availability === 'estimated') return 'Estimated cost';
  return 'Cost unknown';
}

function rateLimitLabel(status: ProviderRateLimitStatus): string {
  if (status === 'not-applicable') return 'No remote rate limit';
  if (status === 'provider-managed') return 'Provider-managed limits';
  return 'Rate limits unknown';
}

function buildCost(provider: ProviderConfig, metadata?: ProviderMetadata): ProviderCostState {
  const availability = metadata?.cost.estimateAvailability ??
    provider.costEstimateAvailability ??
    'unknown';
  const estimatedUsd = typeof metadata?.cost.estimatedUsd === 'number' && Number.isFinite(metadata.cost.estimatedUsd)
    ? Math.max(0, metadata.cost.estimatedUsd)
    : undefined;
  const detail = metadata?.cost.detail ??
    (availability === 'unknown'
      ? 'Exact pricing is not stored in this local registry.'
      : availability === 'free'
        ? 'This provider has no remote paid operation in the local registry.'
        : 'The local registry can estimate this provider cost before execution.');
  const cost: ProviderCostState = {
    availability,
    label: costLabel(availability),
    detail,
    currency: metadata?.cost.currency,
  };
  if (estimatedUsd !== undefined) cost.estimatedUsd = estimatedUsd;
  return cost;
}

function buildRateLimit(provider: ProviderConfig, metadata?: ProviderMetadata): ProviderRateLimitState {
  const status = metadata?.rateLimit.status ?? provider.rateLimitStatus ?? 'unknown';
  return {
    status,
    label: rateLimitLabel(status),
    retryGuidance: metadata?.rateLimit.retryGuidance ??
      'Retry only after provider guidance or a returned retry-after interval.',
    quotaGuidance: metadata?.rateLimit.quotaGuidance,
  };
}

function buildBudget(provider: ProviderConfig, metadata?: ProviderMetadata): ProviderBudgetState {
  const policy = metadata?.cost.confirmationPolicy ??
    (provider.requiresPaidJobConfirmation ? 'confirm-paid-session' : 'none');
  const paidOperations = metadata?.cost.paidOperations ?? provider.requiresPaidJobConfirmation ?? false;
  const threshold = metadata?.cost.expensiveJobThresholdUsd ?? provider.expensiveJobThresholdUsd;

  if (!paidOperations || policy === 'none') {
    return {
      requiresConfirmation: false,
      label: 'No paid-work confirmation needed',
      detail: 'This provider does not require paid-operation confirmation in the local registry.',
    };
  }

  if (policy === 'confirm-expensive-session') {
    return {
      requiresConfirmation: true,
      label: threshold ? `Confirm jobs above $${threshold.toFixed(2)}` : 'Confirm expensive jobs per session',
      detail: 'Estimated expensive jobs require an explicit session confirmation before queueing.',
    };
  }

  return {
    requiresConfirmation: true,
    label: 'Confirm paid work per session',
    detail: 'Paid or unknown-cost provider work requires explicit confirmation for the current session.',
  };
}

export function buildProviderCostBudgetStates(
  providers: ProviderConfig[],
  registry: ProviderMetadata[] = defaultProviderRegistry,
): ProviderCostBudgetState[] {
  return providers.map(provider => {
    const metadata = getProviderMetadata(provider.id, registry);
    return {
      providerId: provider.id,
      providerName: provider.name,
      enabled: provider.enabled,
      configured: isConfigured(provider),
      cost: buildCost(provider, metadata),
      rateLimit: buildRateLimit(provider, metadata),
      budget: buildBudget(provider, metadata),
    };
  });
}
