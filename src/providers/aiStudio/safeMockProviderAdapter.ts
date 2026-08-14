import { createMockProviderAdapter } from '../mockProviderAdapter';
import type {
  ProviderAdapter,
  ProviderAdapterFailure,
  ProviderAdapterRequest,
  ProviderAdapterResponse,
} from '../providerAdapter';
import type {
  ProviderMetadata,
  ProviderModelDescriptor,
  ProviderOperation,
} from '../providerRegistry';
import { sanitizeAiStudioPrompt, sanitizeAiStudioRecord } from './safety';

const SAFE_OPERATIONS: ProviderOperation[] = ['text.generate', 'image.generate'];
const DEFAULT_MODEL: Record<'text.generate' | 'image.generate', string> = {
  'text.generate': 'offline-mock',
  'image.generate': 'offline-image-mock',
};

function failedResponse(
  request: ProviderAdapterRequest,
  failure: ProviderAdapterFailure,
): ProviderAdapterResponse {
  return {
    id: request.id,
    operation: request.operation,
    providerId: 'local',
    modelId: request.modelId,
    status: failure.kind === 'cancelled' ? 'cancelled' : 'failed',
    error: failure.message,
    failure,
  };
}

/**
 * In-process AI Studio fixture adapter. It has no fetch, credential, filesystem,
 * or shell dependency and only exposes the two generation operations used here.
 */
export function createSafeAiStudioMockAdapter(): ProviderAdapter {
  const delegate = createMockProviderAdapter();
  const models: ProviderModelDescriptor[] = delegate.metadata.models
    .filter(model => model.operations.some(operation => SAFE_OPERATIONS.includes(operation)))
    .map(model => ({
      ...model,
      operations: model.operations.filter(operation => SAFE_OPERATIONS.includes(operation)),
    }));
  const metadata: ProviderMetadata = {
    ...delegate.metadata,
    name: 'AI Studio offline mock',
    operations: [...SAFE_OPERATIONS],
    models,
  };

  return {
    metadata,
    discoverCapabilities: async () => [...SAFE_OPERATIONS],
    listModels: async () => models.map(model => ({
      ...model,
      operations: [...model.operations],
    })),
    execute: async (request, options = {}) => {
      if (request.providerId !== 'local') {
        return failedResponse(request, {
          kind: 'provider-error',
          message: 'The offline AI Studio adapter only accepts the local provider.',
          retryGuidance: 'Resolve a connected adapter explicitly for non-local providers.',
        });
      }
      if (!SAFE_OPERATIONS.includes(request.operation)) {
        return failedResponse(request, {
          kind: 'unsupported-operation',
          message: `The offline AI Studio adapter does not support ${request.operation}.`,
          retryGuidance: 'Use text.generate or image.generate.',
        });
      }

      const operation = request.operation as 'text.generate' | 'image.generate';
      return delegate.execute({
        ...request,
        providerId: 'local',
        modelId: request.modelId ?? DEFAULT_MODEL[operation],
        prompt: sanitizeAiStudioPrompt(request.prompt ?? ''),
        input: sanitizeAiStudioRecord(request.input),
      }, options);
    },
  };
}
