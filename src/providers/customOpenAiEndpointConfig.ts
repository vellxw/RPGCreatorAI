import type { ProviderConfig, ProviderCustomCapability } from '../types/project';
import type { ModelCapability } from './modelCapabilityRegistry';
import type { ProviderOperation } from './providerRegistry';

export interface CustomEndpointBaseUrlValidation {
  valid: boolean;
  normalized?: string;
  message: string;
}

export interface CustomEndpointCapabilityOption {
  id: ProviderCustomCapability;
  label: string;
  description: string;
}

export const customEndpointCapabilityOptions: CustomEndpointCapabilityOption[] = [
  {
    id: 'text',
    label: 'Text generation',
    description: 'Route text draft workflows through chat completions.',
  },
  {
    id: 'structured-json',
    label: 'Structured JSON',
    description: 'Allow schema-guided editor authoring responses.',
  },
  {
    id: 'code',
    label: 'Code assistance',
    description: 'Route developer tooling prompts through chat completions.',
  },
  {
    id: 'tool',
    label: 'Tool use',
    description: 'Declare tool-call compatibility for future editor workflows.',
  },
];

const allowedCapabilities = new Set<ProviderCustomCapability>(
  customEndpointCapabilityOptions.map(option => option.id),
);

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

export function validateCustomEndpointBaseUrl(value: string | undefined): CustomEndpointBaseUrlValidation {
  const raw = value?.trim() ?? '';
  if (!raw) {
    return { valid: false, message: 'Custom endpoint base URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, message: 'Custom endpoint base URL must be an absolute URL.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, message: 'Custom endpoint base URL must not include username or password.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, message: 'Custom endpoint base URL must use HTTP or HTTPS.' };
  }

  if (parsed.protocol === 'http:' && !isLocalHost(parsed.hostname)) {
    return { valid: false, message: 'Custom endpoint remote base URLs must use HTTPS.' };
  }

  const normalized = parsed.toString().replace(/\/+$/, '');
  return { valid: true, normalized, message: 'Endpoint URL shape is valid.' };
}

export function customEndpointCapabilitiesFromConfig(
  capabilities: ProviderConfig['customCapabilities'] | undefined,
): ProviderCustomCapability[] {
  if (!capabilities?.length) return [];
  const unique: ProviderCustomCapability[] = [];
  for (const capability of capabilities) {
    if (!allowedCapabilities.has(capability) || unique.includes(capability)) continue;
    unique.push(capability);
  }
  return unique;
}

export function customEndpointCapabilityLabels(capabilities: ProviderCustomCapability[]): string[] {
  return capabilities.map(capability =>
    customEndpointCapabilityOptions.find(option => option.id === capability)?.label ?? capability,
  );
}

export function operationsFromCustomEndpointCapabilities(
  capabilities: ProviderCustomCapability[],
): ProviderOperation[] {
  const operations: ProviderOperation[] = [];
  if (capabilities.some(capability => capability === 'text' || capability === 'structured-json' || capability === 'tool')) {
    operations.push('text.generate');
  }
  if (capabilities.includes('code')) {
    operations.push('code.assist');
  }
  return operations.length ? operations : [];
}

export function modelCapabilitiesFromCustomEndpointCapabilities(
  capabilities: ProviderCustomCapability[],
): ModelCapability[] {
  return capabilities.map(capability => capability);
}
