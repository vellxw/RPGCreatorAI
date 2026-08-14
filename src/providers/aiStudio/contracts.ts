import type {
  ProviderAdapter,
  ProviderAdapterFailure,
  ProviderUsageEstimate,
} from '../providerAdapter';
import type { ProviderOperation } from '../providerRegistry';

export type AiStudioGenerationKind = 'text' | 'image';
export type AiStudioProviderMode = 'offline' | 'connected';

export interface AiStudioProviderTarget {
  providerId: string;
  modelId?: string;
}

export interface AiStudioRequestBase {
  id: string;
  prompt: string;
  createdAt?: string;
  target?: AiStudioProviderTarget;
  context?: Readonly<Record<string, unknown>>;
}

export interface AiStudioTextGenerationParameters extends Readonly<Record<string, unknown>> {
  instructions?: string;
  maxOutputTokens?: number;
}

export interface AiStudioImageGenerationParameters extends Readonly<Record<string, unknown>> {
  quality?: string;
  size?: string;
  outputFormat?: string;
  outputCompression?: number;
  background?: string;
  moderation?: string;
}

export interface AiStudioTextGenerationRequest extends AiStudioRequestBase {
  parameters?: AiStudioTextGenerationParameters;
}

export interface AiStudioImageGenerationRequest extends AiStudioRequestBase {
  parameters?: AiStudioImageGenerationParameters;
}

export interface AiStudioGenerationOptions {
  signal?: AbortSignal;
}

export interface AiStudioGenerationProvenance {
  providerId: string;
  modelId?: string;
  operation: ProviderOperation;
  mode: AiStudioProviderMode;
  createdAt: string;
}

interface AiStudioSuccessBase {
  status: 'succeeded';
  requestId: string;
  provenance: AiStudioGenerationProvenance;
  usage?: ProviderUsageEstimate;
}

export interface AiStudioTextGenerationSuccess extends AiStudioSuccessBase {
  generationKind: 'text';
  output: {
    text: string;
    data?: Record<string, unknown>;
  };
}

export interface AiStudioImageGenerationSuccess extends AiStudioSuccessBase {
  generationKind: 'image';
  output: {
    assetRefs: string[];
    data?: Record<string, unknown>;
  };
}

export interface AiStudioGenerationFailure {
  status: 'failed' | 'cancelled';
  generationKind: AiStudioGenerationKind;
  requestId: string;
  provenance: AiStudioGenerationProvenance;
  failure: ProviderAdapterFailure;
}

export type AiStudioTextGenerationResult =
  | AiStudioTextGenerationSuccess
  | AiStudioGenerationFailure;

export type AiStudioImageGenerationResult =
  | AiStudioImageGenerationSuccess
  | AiStudioGenerationFailure;

export interface AiStudioGenerationGateway {
  generateText(
    request: AiStudioTextGenerationRequest,
    options?: AiStudioGenerationOptions,
  ): Promise<AiStudioTextGenerationResult>;
  generateImage(
    request: AiStudioImageGenerationRequest,
    options?: AiStudioGenerationOptions,
  ): Promise<AiStudioImageGenerationResult>;
}

export type AiStudioProviderAdapterResolver = (
  providerId: string,
) => ProviderAdapter | undefined;
