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
import { normalizeProviderResponse } from './providerResponseNormalization';

function countPromptTokens(prompt: string): number {
  const trimmed = prompt.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length + 1;
}

function cancelledResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  return normalizeProviderResponse(request, { status: 'cancelled' });
}

function fixtureFailureResponse(request: ProviderAdapterRequest): ProviderAdapterResponse | null {
  const fixtureFailure = request.input?.fixtureFailure;
  if (fixtureFailure === 'malformed-response') {
    return normalizeProviderResponse(request, {
      status: 'ok',
      output: 'not-a-valid-output-shape',
    });
  }

  if (fixtureFailure === 'provider-error') {
    return normalizeProviderResponse(request, {
      status: 'error',
      message: 'Fixture provider error.',
    });
  }

  if (fixtureFailure === 'rate-limit') {
    const rawRetryAfter = request.input?.retryAfterSeconds;
    return normalizeProviderResponse(request, {
      status: 'rate-limit',
      retryAfterSeconds: rawRetryAfter,
    });
  }

  if (fixtureFailure === 'quota-exceeded') {
    return normalizeProviderResponse(request, { status: 'quota-exceeded' });
  }

  if (fixtureFailure === 'timeout') {
    return normalizeProviderResponse(request, {
      status: 'timeout',
      retryAfterSeconds: request.input?.retryAfterSeconds,
    });
  }

  return null;
}

function imageFixtureResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  const input = request.input ?? {};
  const outputFormat = typeof input.outputFormat === 'string' ? input.outputFormat : 'png';
  const size = typeof input.size === 'string' ? input.size : '1024x1024';
  const quality = typeof input.quality === 'string' ? input.quality : 'low';
  const prompt = request.prompt ?? '';
  return {
    id: request.id,
    operation: request.operation,
    providerId: request.providerId,
    modelId: request.modelId ?? 'offline-image-mock',
    status: 'succeeded',
    output: {
      assetRefs: [`mock://generated/${request.id}.${outputFormat}`],
      data: {
        mimeType: `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}`,
        revisedPrompt: prompt,
        fixture: 'offline-image',
        size,
        quality,
      },
    },
    usage: {
      inputTokens: countPromptTokens(prompt),
      imageCount: 1,
      outputTokens: 196,
    },
  };
}

function imageEditFixtureResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  const input = request.input ?? {};
  const outputFormat = typeof input.outputFormat === 'string' ? input.outputFormat : 'png';
  const size = typeof input.size === 'string' ? input.size : '1024x1024';
  const quality = typeof input.quality === 'string' ? input.quality : 'low';
  const prompt = request.prompt ?? '';
  const sourceAssetId = typeof input.sourceAssetId === 'string' ? input.sourceAssetId : undefined;
  const mode = input.mode === 'edit' || input.mode === 'variation' ? input.mode : 'variation';
  return {
    id: request.id,
    operation: request.operation,
    providerId: request.providerId,
    modelId: request.modelId ?? 'offline-image-edit-mock',
    status: 'succeeded',
    output: {
      assetRefs: [`mock://generated/${request.id}.${outputFormat}`],
      data: {
        mimeType: `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}`,
        revisedPrompt: prompt,
        fixture: 'offline-image-edit',
        sourceAssetId,
        mode,
        size,
        quality,
      },
    },
    usage: {
      inputTokens: countPromptTokens(prompt),
      imageCount: 1,
      outputTokens: 196,
    },
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
    if (request.operation === 'image.generate') {
      if (request.modelId && request.modelId !== 'offline-image-mock') {
        const failure: ProviderAdapterFailure = {
          kind: 'unsupported-operation',
          message: `Mock model ${request.modelId} does not support image.generate.`,
          retryGuidance: 'Select offline-image-mock for offline image fixture validation.',
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
      return imageFixtureResponse(request);
    }

    if (request.operation === 'image.edit') {
      if (request.modelId && request.modelId !== 'offline-image-edit-mock') {
        const failure: ProviderAdapterFailure = {
          kind: 'unsupported-operation',
          message: `Mock model ${request.modelId} does not support image.edit.`,
          retryGuidance: 'Select offline-image-edit-mock for offline image edit fixture validation.',
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
      return imageEditFixtureResponse(request);
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
