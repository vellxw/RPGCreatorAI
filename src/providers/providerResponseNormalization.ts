import type {
  ProviderAdapterFailure,
  ProviderAdapterRequest,
  ProviderAdapterResponse,
  ProviderUsageEstimate,
} from './providerAdapter';

const SECRET_KEY_PATTERN = /(api[-_]?key|token|secret|credential|password)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableSanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSanitize);
  if (!isRecord(value)) return value;

  return Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : stableSanitize(value[key]);
    return result;
  }, {});
}

export function serializeProviderRequest(request: ProviderAdapterRequest): string {
  return JSON.stringify(stableSanitize({
    id: request.id,
    operation: request.operation,
    providerId: request.providerId,
    createdAt: request.createdAt,
    modelId: request.modelId ?? null,
    prompt: request.prompt ?? '',
    input: request.input ?? {},
  }));
}

function baseResponse(request: ProviderAdapterRequest): Pick<
  ProviderAdapterResponse,
  'id' | 'operation' | 'providerId' | 'modelId'
> {
  return {
    id: request.id,
    operation: request.operation,
    providerId: request.providerId,
    modelId: request.modelId,
  };
}

function failedResponse(
  request: ProviderAdapterRequest,
  failure: ProviderAdapterFailure,
): ProviderAdapterResponse {
  return {
    ...baseResponse(request),
    status: failure.kind === 'cancelled' ? 'cancelled' : 'failed',
    error: failure.message,
    failure,
  };
}

function malformedResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'provider-error',
    message: 'Malformed provider response.',
    retryGuidance: 'Inspect the mocked contract fixture before retrying.',
  });
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeUsage(value: unknown): ProviderUsageEstimate | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return undefined;
  return {
    inputTokens: finiteNumber(value.inputTokens),
    outputTokens: finiteNumber(value.outputTokens),
    imageCount: finiteNumber(value.imageCount),
    audioSeconds: finiteNumber(value.audioSeconds),
    videoSeconds: finiteNumber(value.videoSeconds),
  };
}

function normalizeOutput(value: unknown): ProviderAdapterResponse['output'] | undefined {
  if (!isRecord(value)) return undefined;
  const output: ProviderAdapterResponse['output'] = {};
  if (typeof value.text === 'string') output.text = value.text;
  if (Array.isArray(value.assetRefs) && value.assetRefs.every(asset => typeof asset === 'string')) {
    output.assetRefs = [...value.assetRefs];
  }
  if (isRecord(value.data)) output.data = { ...value.data };
  return Object.keys(output).length > 0 ? output : undefined;
}

function retryAfter(raw: Record<string, unknown>): number | undefined {
  const value = finiteNumber(raw.retryAfterSeconds);
  return value === undefined ? undefined : Math.max(0, Math.round(value));
}

export function normalizeProviderResponse(
  request: ProviderAdapterRequest,
  rawResponse: unknown,
): ProviderAdapterResponse {
  if (!isRecord(rawResponse) || typeof rawResponse.status !== 'string') {
    return malformedResponse(request);
  }

  switch (rawResponse.status) {
    case 'ok': {
      const output = normalizeOutput(rawResponse.output);
      if (!output) return malformedResponse(request);
      return {
        ...baseResponse(request),
        status: 'succeeded',
        output,
        usage: normalizeUsage(rawResponse.usage),
      };
    }
    case 'error': {
      const message = typeof rawResponse.message === 'string' && rawResponse.message.trim()
        ? rawResponse.message
        : 'Provider returned an error.';
      return failedResponse(request, {
        kind: 'provider-error',
        message,
        retryGuidance: 'Review the provider error before retrying this request.',
      });
    }
    case 'rate-limit':
    case 'rate_limit': {
      const seconds = retryAfter(rawResponse);
      return failedResponse(request, {
        kind: 'rate-limit',
        message: 'Mock provider rate limit reached.',
        retryAfterSeconds: seconds,
        retryGuidance: seconds !== undefined
          ? `Wait ${seconds} seconds before retrying this provider request.`
          : 'Wait for provider retry guidance before retrying this provider request.',
      });
    }
    case 'quota-exceeded':
    case 'quota_exceeded':
      return failedResponse(request, {
        kind: 'quota-exceeded',
        message: 'Mock provider quota exceeded.',
        retryGuidance: 'Review provider quota or budget settings before retrying.',
      });
    case 'timeout': {
      const seconds = retryAfter(rawResponse);
      return failedResponse(request, {
        kind: 'timeout',
        message: 'Mock provider request timed out.',
        retryAfterSeconds: seconds,
        retryGuidance: seconds !== undefined
          ? `Retry after ${seconds} seconds if the request is still needed.`
          : 'Retry after provider recovery if the request is still needed.',
      });
    }
    case 'cancelled':
      return failedResponse(request, {
        kind: 'cancelled',
        message: 'Request cancelled before execution.',
        retryGuidance: 'Queue a new request after confirming the editor work is still needed.',
      });
    default:
      return malformedResponse(request);
  }
}
