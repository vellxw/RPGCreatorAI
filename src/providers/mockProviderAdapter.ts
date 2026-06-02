import type {
  ProviderAdapter,
  ProviderAdapterExecuteOptions,
  ProviderAdapterRequest,
  ProviderAdapterResponse,
} from './providerAdapter';
import {
  getProviderMetadata,
  type ProviderMetadata,
  type ProviderModelDescriptor,
  type ProviderOperation,
} from './providerRegistry';

function countPromptTokens(prompt: string): number {
  const trimmed = prompt.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length + 1;
}

function cancelledResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  return {
    id: request.id,
    operation: request.operation,
    providerId: request.providerId,
    modelId: request.modelId,
    status: 'cancelled',
    error: 'Request cancelled before execution.',
  };
}

export function createMockProviderAdapter(): ProviderAdapter {
  const metadata = getProviderMetadata('local');
  if (!metadata) {
    throw new Error('Local mock provider metadata is missing.');
  }
  return new MockProviderAdapter(metadata);
}

class MockProviderAdapter implements ProviderAdapter {
  constructor(public readonly metadata: ProviderMetadata) {}

  async discoverCapabilities(): Promise<ProviderOperation[]> {
    return [...this.metadata.operations];
  }

  async listModels(): Promise<ProviderModelDescriptor[]> {
    return this.metadata.models.map(model => ({
      ...model,
      operations: [...model.operations],
    }));
  }

  async execute(
    request: ProviderAdapterRequest,
    options: ProviderAdapterExecuteOptions = {},
  ): Promise<ProviderAdapterResponse> {
    if (options.signal?.aborted) {
      return cancelledResponse(request);
    }
    if (!this.metadata.operations.includes(request.operation)) {
      return {
        id: request.id,
        operation: request.operation,
        providerId: request.providerId,
        modelId: request.modelId,
        status: 'failed',
        error: `Mock provider does not support ${request.operation}.`,
      };
    }
    if (request.operation !== 'text.generate') {
      return {
        id: request.id,
        operation: request.operation,
        providerId: request.providerId,
        modelId: request.modelId,
        status: 'failed',
        error: `Mock provider does not support ${request.operation}.`,
      };
    }

    const prompt = request.prompt ?? '';
    return {
      id: request.id,
      operation: request.operation,
      providerId: request.providerId,
      modelId: request.modelId ?? 'offline-mock',
      status: 'succeeded',
      output: {
        text: `Offline mock response for: ${prompt}`,
      },
      usage: {
        inputTokens: countPromptTokens(prompt),
        outputTokens: 12,
      },
    };
  }
}
