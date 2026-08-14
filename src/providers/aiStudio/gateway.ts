import type {
  ProviderAdapter,
  ProviderAdapterFailure,
  ProviderAdapterRequest,
  ProviderAdapterResponse,
} from '../providerAdapter';
import type { ProviderOperation } from '../providerRegistry';
import type {
  AiStudioGenerationFailure,
  AiStudioGenerationGateway,
  AiStudioGenerationKind,
  AiStudioGenerationOptions,
  AiStudioGenerationProvenance,
  AiStudioImageGenerationRequest,
  AiStudioImageGenerationResult,
  AiStudioProviderAdapterResolver,
  AiStudioProviderTarget,
  AiStudioRequestBase,
  AiStudioTextGenerationRequest,
  AiStudioTextGenerationResult,
} from './contracts';
import { createSafeAiStudioMockAdapter } from './safeMockProviderAdapter';
import {
  sanitizeAiStudioOutputRecord,
  sanitizeAiStudioPrompt,
  sanitizeAiStudioRecord,
} from './safety';

export const AI_STUDIO_OFFLINE_TARGETS: Readonly<Record<AiStudioGenerationKind, AiStudioProviderTarget>> = {
  text: { providerId: 'local', modelId: 'offline-mock' },
  image: { providerId: 'local', modelId: 'offline-image-mock' },
};

export interface CreateAiStudioGenerationGatewayOptions {
  resolveAdapter?: AiStudioProviderAdapterResolver;
  offlineAdapter?: ProviderAdapter;
  defaultTargets?: Partial<Record<AiStudioGenerationKind, AiStudioProviderTarget>>;
  now?: () => string;
}

function operationFor(kind: AiStudioGenerationKind): ProviderOperation {
  return kind === 'text' ? 'text.generate' : 'image.generate';
}

function providerMode(adapter: ProviderAdapter): AiStudioGenerationProvenance['mode'] {
  return adapter.metadata.adapterKind === 'mock-local' ? 'offline' : 'connected';
}

function provenance(
  adapter: ProviderAdapter | undefined,
  target: AiStudioProviderTarget,
  operation: ProviderOperation,
  createdAt: string,
): AiStudioGenerationProvenance {
  return {
    providerId: target.providerId,
    modelId: target.modelId,
    operation,
    mode: adapter ? providerMode(adapter) : target.providerId === 'local' ? 'offline' : 'connected',
    createdAt,
  };
}

function failureResult(
  kind: AiStudioGenerationKind,
  requestId: string,
  source: AiStudioGenerationProvenance,
  failure: ProviderAdapterFailure,
): AiStudioGenerationFailure {
  return {
    status: failure.kind === 'cancelled' ? 'cancelled' : 'failed',
    generationKind: kind,
    requestId,
    provenance: source,
    failure,
  };
}

function responseFailure(response: ProviderAdapterResponse): ProviderAdapterFailure {
  return response.failure ?? {
    kind: response.status === 'cancelled' ? 'cancelled' : 'provider-error',
    message: response.error ?? 'The generation provider returned an unknown error.',
    retryGuidance: 'Review the selected provider and retry only if the request is still needed.',
  };
}

function selectModel(adapter: ProviderAdapter, operation: ProviderOperation, requested?: string): string | undefined {
  if (requested) return requested;
  return adapter.metadata.models.find(model => model.operations.includes(operation))?.id;
}

function modelFailure(
  adapter: ProviderAdapter,
  operation: ProviderOperation,
  modelId: string | undefined,
): ProviderAdapterFailure | undefined {
  if (!adapter.metadata.operations.includes(operation)) {
    return {
      kind: 'unsupported-operation',
      message: `${adapter.metadata.name} does not support ${operation}.`,
      retryGuidance: 'Select a provider that declares the requested generation capability.',
    };
  }
  if (!modelId || adapter.metadata.models.length === 0) return undefined;
  const model = adapter.metadata.models.find(candidate => candidate.id === modelId);
  if (model?.operations.includes(operation)) return undefined;
  return {
    kind: 'unsupported-operation',
    message: `Model ${modelId} does not support ${operation}.`,
    retryGuidance: 'Select a model that declares the requested generation capability.',
  };
}

function providerInput(
  request: AiStudioRequestBase & { parameters?: Readonly<Record<string, unknown>> },
): Record<string, unknown> {
  const input = sanitizeAiStudioRecord(request.parameters);
  if (request.context) input.context = sanitizeAiStudioRecord(request.context);
  return input;
}

export function createAiStudioGenerationGateway(
  options: CreateAiStudioGenerationGatewayOptions = {},
): AiStudioGenerationGateway {
  const offlineAdapter = options.offlineAdapter ?? createSafeAiStudioMockAdapter();
  const now = options.now ?? (() => new Date().toISOString());
  const targets = {
    text: options.defaultTargets?.text ?? AI_STUDIO_OFFLINE_TARGETS.text,
    image: options.defaultTargets?.image ?? AI_STUDIO_OFFLINE_TARGETS.image,
  };

  const resolve = (target: AiStudioProviderTarget): ProviderAdapter | undefined => {
    if (target.providerId === offlineAdapter.metadata.id) return offlineAdapter;
    return options.resolveAdapter?.(target.providerId);
  };

  const execute = async (
    kind: AiStudioGenerationKind,
    request: AiStudioRequestBase & { parameters?: Readonly<Record<string, unknown>> },
    executionOptions: AiStudioGenerationOptions = {},
  ): Promise<ProviderAdapterResponse | AiStudioGenerationFailure> => {
    const operation = operationFor(kind);
    const createdAt = request.createdAt ?? now();
    const target = request.target ?? targets[kind];
    const adapter = resolve(target);
    const source = provenance(adapter, target, operation, createdAt);
    const requestId = request.id.trim();
    const prompt = sanitizeAiStudioPrompt(request.prompt);

    if (!requestId) {
      return failureResult(kind, request.id, source, {
        kind: 'provider-error',
        message: 'AI Studio generation requests require a non-empty id.',
      });
    }
    if (!prompt) {
      return failureResult(kind, requestId, source, {
        kind: 'provider-error',
        message: 'AI Studio generation requests require a non-empty prompt.',
      });
    }
    if (!adapter || adapter.metadata.id !== target.providerId) {
      return failureResult(kind, requestId, source, {
        kind: 'provider-error',
        message: `Provider adapter ${target.providerId} is not available.`,
        retryGuidance: 'Connect and inject the provider adapter, or use the offline target.',
      });
    }

    const modelId = selectModel(adapter, operation, target.modelId);
    const supported = modelFailure(adapter, operation, modelId);
    const resolvedSource = { ...source, modelId };
    if (supported) return failureResult(kind, requestId, resolvedSource, supported);

    const providerRequest: ProviderAdapterRequest = {
      id: requestId,
      operation,
      providerId: target.providerId,
      modelId,
      createdAt,
      prompt,
      input: providerInput(request),
    };

    if (executionOptions.signal?.aborted) {
      return failureResult(kind, requestId, resolvedSource, {
        kind: 'cancelled',
        message: 'Request cancelled before execution.',
        retryGuidance: 'Queue a new request if the draft is still needed.',
      });
    }

    try {
      const response = await adapter.execute(providerRequest, executionOptions);
      if (executionOptions.signal?.aborted) {
        return failureResult(kind, requestId, resolvedSource, {
          kind: 'cancelled',
          message: 'Request cancelled before execution completed.',
          retryGuidance: 'Queue a new request if the draft is still needed.',
        });
      }
      if (response.status !== 'succeeded') {
        return failureResult(kind, requestId, resolvedSource, responseFailure(response));
      }
      return response;
    } catch (error) {
      const cancelled = executionOptions.signal?.aborted || (error as Error).name === 'AbortError';
      return failureResult(kind, requestId, resolvedSource, {
        kind: cancelled ? 'cancelled' : 'provider-error',
        message: cancelled
          ? 'Request cancelled before execution completed.'
          : 'The generation provider failed before returning a response.',
        retryGuidance: cancelled
          ? 'Queue a new request if the draft is still needed.'
          : 'Review the provider configuration before retrying.',
      });
    }
  };

  return {
    generateText: async (
      request: AiStudioTextGenerationRequest,
      executionOptions?: AiStudioGenerationOptions,
    ): Promise<AiStudioTextGenerationResult> => {
      const createdAt = request.createdAt ?? now();
      const preparedRequest = { ...request, createdAt };
      const result = await execute('text', preparedRequest, executionOptions);
      if ('generationKind' in result) return result;
      const text = result.output?.text;
      const target = request.target ?? targets.text;
      const adapter = resolve(target);
      const source = provenance(adapter, {
        ...target,
        modelId: result.modelId ?? target.modelId,
      }, 'text.generate', createdAt);
      if (typeof text !== 'string') {
        return failureResult('text', request.id, source, {
          kind: 'provider-error',
          message: 'The text provider succeeded without returning text.',
        });
      }
      return {
        status: 'succeeded',
        generationKind: 'text',
        requestId: result.id,
        provenance: source,
        output: {
          text: sanitizeAiStudioPrompt(text),
          data: result.output?.data ? sanitizeAiStudioOutputRecord(result.output.data) : undefined,
        },
        usage: result.usage,
      };
    },
    generateImage: async (
      request: AiStudioImageGenerationRequest,
      executionOptions?: AiStudioGenerationOptions,
    ): Promise<AiStudioImageGenerationResult> => {
      const createdAt = request.createdAt ?? now();
      const preparedRequest = { ...request, createdAt };
      const result = await execute('image', preparedRequest, executionOptions);
      if ('generationKind' in result) return result;
      const assetRefs = result.output?.assetRefs;
      const target = request.target ?? targets.image;
      const adapter = resolve(target);
      const source = provenance(adapter, {
        ...target,
        modelId: result.modelId ?? target.modelId,
      }, 'image.generate', createdAt);
      if (!assetRefs?.length) {
        return failureResult('image', request.id, source, {
          kind: 'provider-error',
          message: 'The image provider succeeded without returning an asset reference.',
        });
      }
      return {
        status: 'succeeded',
        generationKind: 'image',
        requestId: result.id,
        provenance: source,
        output: {
          assetRefs: [...assetRefs],
          data: result.output?.data ? sanitizeAiStudioOutputRecord(result.output.data) : undefined,
        },
        usage: result.usage,
      };
    },
  };
}
