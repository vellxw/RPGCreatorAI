import type {
  ProviderAdapter,
  ProviderAdapterFailure,
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
  const failure: ProviderAdapterFailure = {
    kind: 'cancelled',
    message: 'Request cancelled before execution.',
    retryGuidance: 'Queue a new request after confirming the editor work is still needed.',
  };
  return {
    id: request.id,
    operation: request.operation,
    providerId: request.providerId,
    modelId: request.modelId,
    status: 'cancelled',
    error: failure.message,
    failure,
  };
}

function fixtureFailureResponse(request: ProviderAdapterRequest): ProviderAdapterResponse | null {
  const fixtureFailure = request.input?.fixtureFailure;
  if (fixtureFailure === 'rate-limit') {
    const rawRetryAfter = request.input?.retryAfterSeconds;
    const retryAfterSeconds = typeof rawRetryAfter === 'number' && Number.isFinite(rawRetryAfter)
      ? Math.max(0, Math.round(rawRetryAfter))
      : undefined;
    const retryGuidance = retryAfterSeconds !== undefined
      ? `Wait ${retryAfterSeconds} seconds before retrying this provider request.`
      : 'Wait for provider retry guidance before retrying this provider request.';
    const failure: ProviderAdapterFailure = {
      kind: 'rate-limit',
      message: 'Mock provider rate limit reached.',
      retryAfterSeconds,
      retryGuidance,
    };
    return {
      id: request.id,
      operation: request.operation,
      providerId: request.providerId,
      modelId: request.modelId,
      status: 'failed',
      error: failure.message,
      failure,
    };
  }

  if (fixtureFailure === 'quota-exceeded') {
    const failure: ProviderAdapterFailure = {
      kind: 'quota-exceeded',
      message: 'Mock provider quota exceeded.',
      retryGuidance: 'Review provider quota or budget settings before retrying.',
    };
    return {
      id: request.id,
      operation: request.operation,
      providerId: request.providerId,
      modelId: request.modelId,
      status: 'failed',
      error: failure.message,
      failure,
    };
  }

  return null;
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
    const fixtureFailure = fixtureFailureResponse(request);
    if (fixtureFailure) {
      return fixtureFailure;
    }
    if (!this.metadata.operations.includes(request.operation)) {
      const failure: ProviderAdapterFailure = {
        kind: 'unsupported-operation',
        message: `Mock provider does not support ${request.operation}.`,
        retryGuidance: 'Select a provider/model that declares this capability before retrying.',
      };
      return {
        id: request.id,
        operation: request.operation,
        providerId: request.providerId,
        modelId: request.modelId,
        status: 'failed',
        error: failure.message,
        failure,
      };
    }
    if (request.operation !== 'text.generate') {
      const failure: ProviderAdapterFailure = {
        kind: 'unsupported-operation',
        message: `Mock provider does not support ${request.operation}.`,
        retryGuidance: 'Select a provider/model that declares this capability before retrying.',
      };
      return {
        id: request.id,
        operation: request.operation,
        providerId: request.providerId,
        modelId: request.modelId,
        status: 'failed',
        error: failure.message,
        failure,
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
