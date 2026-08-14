import type { ProviderAdapter } from '../providerAdapter';
import type {
  AiStudioImageGenerationParameters,
  AiStudioProviderAdapterResolver,
  AiStudioProviderTarget,
} from './contracts';

export const GPT_IMAGE_PROVIDER_ID = 'openai';
export const GPT_IMAGE_DEFAULT_MODEL_ID = 'gpt-image-2';

export function createGptImageTarget(
  modelId = GPT_IMAGE_DEFAULT_MODEL_ID,
): AiStudioProviderTarget {
  return { providerId: GPT_IMAGE_PROVIDER_ID, modelId };
}

export function createGptImageParameters(
  overrides: AiStudioImageGenerationParameters = {},
): AiStudioImageGenerationParameters {
  return {
    quality: 'auto',
    size: 'auto',
    outputFormat: 'png',
    background: 'auto',
    moderation: 'auto',
    ...overrides,
  };
}

/**
 * Opt-in bridge for a caller-owned OpenAI adapter. This module never creates
 * credentials or performs a request; the gateway remains offline until the
 * caller injects this resolver and explicitly selects the GPT Image target.
 */
export function createGptImageAdapterResolver(
  adapter: ProviderAdapter,
): AiStudioProviderAdapterResolver {
  if (adapter.metadata.id !== GPT_IMAGE_PROVIDER_ID) {
    throw new Error('GPT Image requires an OpenAI provider adapter.');
  }
  const compatible = adapter.metadata.models.some(model =>
    model.id === GPT_IMAGE_DEFAULT_MODEL_ID && model.operations.includes('image.generate'));
  if (!compatible) {
    throw new Error('The injected OpenAI adapter does not declare GPT Image generation support.');
  }
  return providerId => providerId === GPT_IMAGE_PROVIDER_ID ? adapter : undefined;
}
