import type { ProviderMetadata, ProviderModelDescriptor, ProviderOperation } from './providerRegistry';

export type ProviderRequestStatus = 'succeeded' | 'failed' | 'cancelled';
export type ProviderFailureKind =
  | 'rate-limit'
  | 'quota-exceeded'
  | 'budget-exceeded'
  | 'unsupported-operation'
  | 'provider-error'
  | 'cancelled';

export interface ProviderAdapterFailure {
  kind: ProviderFailureKind;
  message: string;
  retryAfterSeconds?: number;
  retryGuidance?: string;
}

export interface ProviderUsageEstimate {
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  audioSeconds?: number;
  videoSeconds?: number;
}

export interface ProviderAdapterRequest {
  id: string;
  operation: ProviderOperation;
  providerId: string;
  createdAt: string;
  modelId?: string;
  prompt?: string;
  input?: Record<string, unknown>;
}

export interface ProviderAdapterResponse {
  id: string;
  operation: ProviderOperation;
  providerId: string;
  status: ProviderRequestStatus;
  modelId?: string;
  output?: {
    text?: string;
    assetRefs?: string[];
    data?: Record<string, unknown>;
  };
  usage?: ProviderUsageEstimate;
  error?: string;
  failure?: ProviderAdapterFailure;
}

export interface ProviderAdapterExecuteOptions {
  signal?: AbortSignal;
}

export interface ProviderAdapter {
  metadata: ProviderMetadata;
  discoverCapabilities(): Promise<ProviderOperation[]>;
  listModels(): Promise<ProviderModelDescriptor[]>;
  execute(
    request: ProviderAdapterRequest,
    options?: ProviderAdapterExecuteOptions,
  ): Promise<ProviderAdapterResponse>;
}
