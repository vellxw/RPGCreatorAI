import type {
  ProviderConfig,
  ProviderImageBackground,
  ProviderImageGenerationSettings,
  ProviderImageModeration,
  ProviderImageOutputFormat,
  ProviderImageQuality,
  ProviderImageSize,
  ProviderImageStyle,
} from '../types/project';
import {
  defaultModelCapabilityRegistry,
  getModelCapabilityDescriptor,
  modelSupportsCapability,
  type ModelCapabilityDescriptor,
} from './modelCapabilityRegistry';

export interface ImageGenerationReadiness {
  state: 'disabled' | 'missing-credentials' | 'missing-model' | 'unsupported-model' | 'ready';
  canGenerate: boolean;
  modelId?: string;
  reason: string;
}

export const openAiImageGenerationOptions = {
  qualities: ['auto', 'low', 'medium', 'high'] as ProviderImageQuality[],
  sizes: [
    'auto',
    '1024x1024',
    '1024x1536',
    '1536x1024',
    '2048x2048',
    '2048x1152',
    '3840x2160',
    '2160x3840',
  ] as ProviderImageSize[],
  outputFormats: ['png', 'webp', 'jpeg'] as ProviderImageOutputFormat[],
  backgrounds: ['auto', 'opaque'] as ProviderImageBackground[],
  moderations: ['auto', 'low'] as ProviderImageModeration[],
  styles: ['project-default', 'pixel-art', 'painted', 'clean-ui'] as ProviderImageStyle[],
};

export const defaultOpenAiImageGenerationSettings: ProviderImageGenerationSettings = {
  modelId: 'gpt-image-2',
  quality: 'auto',
  size: 'auto',
  style: 'project-default',
  outputFormat: 'png',
  background: 'auto',
  moderation: 'auto',
  styleIsApiParameter: false,
  docsCheckedAt: '2026-06-02',
};

function optionOrDefault<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function normalizeCompression(value: unknown, outputFormat: ProviderImageOutputFormat): number | undefined {
  if (outputFormat === 'png') return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeImageGenerationSettings(
  raw?: Partial<ProviderImageGenerationSettings> | Record<string, unknown>,
): ProviderImageGenerationSettings {
  const outputFormat = optionOrDefault(
    raw?.outputFormat,
    openAiImageGenerationOptions.outputFormats,
    defaultOpenAiImageGenerationSettings.outputFormat,
  );
  return {
    modelId: typeof raw?.modelId === 'string' && raw.modelId.trim()
      ? raw.modelId.trim()
      : defaultOpenAiImageGenerationSettings.modelId,
    quality: optionOrDefault(
      raw?.quality,
      openAiImageGenerationOptions.qualities,
      defaultOpenAiImageGenerationSettings.quality,
    ),
    size: optionOrDefault(
      raw?.size,
      openAiImageGenerationOptions.sizes,
      defaultOpenAiImageGenerationSettings.size,
    ),
    style: optionOrDefault(
      raw?.style,
      openAiImageGenerationOptions.styles,
      defaultOpenAiImageGenerationSettings.style,
    ),
    outputFormat,
    outputCompression: normalizeCompression(raw?.outputCompression, outputFormat),
    background: optionOrDefault(
      raw?.background,
      openAiImageGenerationOptions.backgrounds,
      defaultOpenAiImageGenerationSettings.background,
    ),
    moderation: optionOrDefault(
      raw?.moderation,
      openAiImageGenerationOptions.moderations,
      defaultOpenAiImageGenerationSettings.moderation,
    ),
    styleIsApiParameter: false,
    docsCheckedAt: defaultOpenAiImageGenerationSettings.docsCheckedAt,
  };
}

export function buildOpenAiImageGenerationInput(
  rawSettings: ProviderImageGenerationSettings,
): Record<string, unknown> {
  const settings = normalizeImageGenerationSettings(rawSettings);
  const input: Record<string, unknown> = {
    model: settings.modelId,
    quality: settings.quality,
    size: settings.size,
    output_format: settings.outputFormat,
    background: settings.background,
    moderation: settings.moderation,
  };
  if (settings.outputCompression !== undefined) {
    input.output_compression = settings.outputCompression;
  }
  return input;
}

export function imageGenerationReadiness(
  provider: ProviderConfig,
  registry: ModelCapabilityDescriptor[] = defaultModelCapabilityRegistry,
): ImageGenerationReadiness {
  if (!provider.enabled) {
    return {
      state: 'disabled',
      canGenerate: false,
      reason: 'Provider is disabled.',
    };
  }
  if (provider.credentialState === 'missing') {
    return {
      state: 'missing-credentials',
      canGenerate: false,
      reason: 'Provider credentials are missing.',
    };
  }
  const modelId = provider.model.trim();
  if (!modelId) {
    return {
      state: 'missing-model',
      canGenerate: false,
      reason: 'No image model is configured.',
    };
  }
  const descriptor = getModelCapabilityDescriptor(provider.id, modelId, registry);
  if (!descriptor || !modelSupportsCapability(descriptor, 'image')) {
    return {
      state: 'unsupported-model',
      canGenerate: false,
      modelId,
      reason: 'Configured model does not declare image generation capability.',
    };
  }
  return {
    state: 'ready',
    canGenerate: true,
    modelId,
    reason: 'Ready for image generation.',
  };
}
