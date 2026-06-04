import {
  customEndpointCapabilitiesFromConfig,
  operationsFromCustomEndpointCapabilities,
  validateCustomEndpointBaseUrl,
} from './customOpenAiEndpointConfig';
import {
  createOpenAiCompatibleProviderAdapter,
  type OpenAiCompatibleCredentialResolver,
  type OpenAiCompatibleFetchLike,
} from './openAiCompatibleProviderAdapter';
import type {
  ProviderAdapter,
  ProviderAdapterExecuteOptions,
  ProviderAdapterFailure,
  ProviderAdapterRequest,
  ProviderAdapterResponse,
} from './providerAdapter';
import {
  getProviderMetadata,
  type ProviderMetadata,
  type ProviderModelDescriptor,
  type ProviderOperation,
} from './providerRegistry';
import type { ProviderCustomCapability } from '../types/project';

export type CustomOpenAiCompatibleCredentialResolver = OpenAiCompatibleCredentialResolver;
export type CustomOpenAiCompatibleFetchLike = OpenAiCompatibleFetchLike;

export interface CustomOpenAiCompatibleProviderAdapterOptions {
  fetch?: CustomOpenAiCompatibleFetchLike;
  credentialResolver?: CustomOpenAiCompatibleCredentialResolver;
  baseUrl?: string;
  defaultModelId?: string;
  capabilities?: ProviderCustomCapability[];
  models?: ProviderModelDescriptor[];
}

function failedResponse(
  request: ProviderAdapterRequest,
  failure: ProviderAdapterFailure,
): ProviderAdapterResponse {
  return {
    id: request.id,
    operation: request.operation,
    providerId: request.providerId,
    modelId: request.modelId,
    status: failure.kind === 'cancelled' ? 'cancelled' : 'failed',
    error: failure.message,
    failure,
  };
}

function providerError(request: ProviderAdapterRequest, message: string): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'provider-error',
    message,
    retryGuidance: 'Configure base URL, model id, and capability metadata before retrying.',
  });
}

function unsupportedResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'unsupported-operation',
    message: `Custom OpenAI-compatible endpoint adapter does not support ${request.operation}.`,
    retryGuidance: 'Enable a matching custom endpoint capability before retrying.',
  });
}

function stringInput(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function modelIdFor(request: ProviderAdapterRequest, defaultModelId?: string): string {
  return request.modelId ?? stringInput(request.input?.model) ?? defaultModelId?.trim() ?? '';
}

function modelDescriptors(
  modelId: string,
  operations: ProviderOperation[],
  configuredModels: ProviderModelDescriptor[] | undefined,
): ProviderModelDescriptor[] {
  if (configuredModels?.length) {
    return configuredModels.map(model => ({
      ...model,
      operations: [...model.operations],
    }));
  }
  if (!modelId) return [];
  return [
    {
      id: modelId,
      label: modelId,
      operations,
    },
  ];
}

export function createCustomOpenAiCompatibleProviderAdapter(
  options: CustomOpenAiCompatibleProviderAdapterOptions = {},
): ProviderAdapter {
  const metadata = getProviderMetadata('custom');
  if (!metadata) {
    throw new Error('Custom OpenAI-compatible provider metadata is missing.');
  }
  return new CustomOpenAiCompatibleProviderAdapter(metadata, options);
}

class CustomOpenAiCompatibleProviderAdapter implements ProviderAdapter {
  private readonly baseUrlValidation;
  private readonly modelId: string;
  private readonly capabilities: ProviderCustomCapability[];
  private readonly operations: ProviderOperation[];
  private readonly delegate?: ProviderAdapter;

  constructor(
    public readonly metadata: ProviderMetadata,
    private readonly options: CustomOpenAiCompatibleProviderAdapterOptions,
  ) {
    this.baseUrlValidation = validateCustomEndpointBaseUrl(options.baseUrl);
    this.modelId = options.defaultModelId?.trim() ?? '';
    this.capabilities = customEndpointCapabilitiesFromConfig(options.capabilities);
    this.operations = operationsFromCustomEndpointCapabilities(this.capabilities);

    if (this.baseUrlValidation.valid && this.baseUrlValidation.normalized && this.modelId) {
      this.delegate = createOpenAiCompatibleProviderAdapter({
        providerId: 'custom',
        providerLabel: 'Custom OpenAI-compatible endpoint',
        defaultBaseUrl: this.baseUrlValidation.normalized,
        defaultModelId: this.modelId,
        maxTokensField: 'max_completion_tokens',
        fetch: options.fetch,
        credentialResolver: options.credentialResolver,
        baseUrl: this.baseUrlValidation.normalized,
      });
    }
  }

  async discoverCapabilities(): Promise<ProviderOperation[]> {
    return [...this.operations];
  }

  async listModels(): Promise<ProviderModelDescriptor[]> {
    return modelDescriptors(this.modelId, this.operations, this.options.models);
  }

  async execute(
    request: ProviderAdapterRequest,
    options: ProviderAdapterExecuteOptions = {},
  ): Promise<ProviderAdapterResponse> {
    if (options.signal?.aborted) {
      return failedResponse(request, {
        kind: 'cancelled',
        message: 'Request cancelled before execution.',
      });
    }
    if (!this.baseUrlValidation.valid) {
      return providerError(request, this.baseUrlValidation.message);
    }
    const modelId = modelIdFor(request, this.modelId);
    if (!modelId) {
      return providerError(request, 'Custom endpoint requires a user-entered model id.');
    }
    if (!this.capabilities.length || !this.operations.length) {
      return providerError(request, 'Custom endpoint requires user-entered capability config.');
    }
    if (!this.operations.includes(request.operation)) {
      return unsupportedResponse(request);
    }
    if (!this.delegate) {
      return providerError(request, 'Custom endpoint adapter is not fully configured.');
    }

    return this.delegate.execute({
      ...request,
      modelId,
    }, options);
  }
}
