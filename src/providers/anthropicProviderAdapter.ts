import { redactSecrets } from '../security/redaction';
import type {
  ProviderAdapter,
  ProviderAdapterExecuteOptions,
  ProviderAdapterFailure,
  ProviderAdapterRequest,
  ProviderAdapterResponse,
  ProviderFailureKind,
  ProviderUsageEstimate,
} from './providerAdapter';
import {
  getProviderMetadata,
  type ProviderMetadata,
  type ProviderModelDescriptor,
  type ProviderOperation,
} from './providerRegistry';

export interface AnthropicCredentialLookup {
  providerId: 'anthropic';
  envVar?: string;
}

export type AnthropicCredentialResolver = (
  lookup: AnthropicCredentialLookup,
) => string | null | undefined | Promise<string | null | undefined>;

export interface AnthropicFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers?: {
    get(name: string): string | null;
  } | Record<string, string | undefined>;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}

export interface AnthropicFetchInit {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export type AnthropicFetchLike = (
  url: string,
  init: AnthropicFetchInit,
) => Promise<AnthropicFetchResponse>;

export interface AnthropicProviderAdapterOptions {
  fetch?: AnthropicFetchLike;
  credentialResolver?: AnthropicCredentialResolver;
  baseUrl?: string;
}

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableModels(models: ProviderModelDescriptor[]): ProviderModelDescriptor[] {
  return models.map(model => ({ ...model, operations: [...model.operations] }));
}

function responseBase(request: ProviderAdapterRequest): Pick<
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
    ...responseBase(request),
    status: failure.kind === 'cancelled' ? 'cancelled' : 'failed',
    error: failure.message,
    failure,
  };
}

function missingCredentialResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'missing-credentials',
    message: 'Anthropic credential is not configured.',
    retryGuidance: 'Configure Anthropic credentials through an approved credential path before retrying.',
  });
}

function retryGuidance(kind: ProviderFailureKind, retryAfterSeconds?: number): string {
  if (kind === 'rate-limit') {
    return retryAfterSeconds !== undefined
      ? `Wait ${retryAfterSeconds} seconds before retrying this Anthropic request.`
      : 'Retry after Anthropic rate-limit guidance is available.';
  }
  if (kind === 'quota-exceeded') {
    return 'Review Anthropic billing, spend limits, and local budget settings before retrying.';
  }
  if (kind === 'timeout') {
    return retryAfterSeconds !== undefined
      ? `Retry after ${retryAfterSeconds} seconds if the request is still needed.`
      : 'Retry later if the request is still needed.';
  }
  return 'Review the Anthropic API error before retrying this request.';
}

function providerErrorResponse(
  request: ProviderAdapterRequest,
  message: string,
  knownSecret?: string,
  kind: ProviderFailureKind = 'provider-error',
  retryAfterSeconds?: number,
): ProviderAdapterResponse {
  const safeMessage = redactSecrets(message, knownSecret ? [knownSecret] : []);
  return failedResponse(request, {
    kind,
    message: safeMessage,
    retryAfterSeconds,
    retryGuidance: retryGuidance(kind, retryAfterSeconds),
  });
}

function unsupportedResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'unsupported-operation',
    message: `Anthropic adapter does not support ${request.operation}.`,
    retryGuidance: 'Select a provider/model that declares this capability before retrying.',
  });
}

function getHeader(response: AnthropicFetchResponse, header: string): string | null {
  const headers = response.headers;
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(header);
  const lower = header.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value ?? null;
  }
  return null;
}

function retryAfterSeconds(response: AnthropicFetchResponse): number | undefined {
  const retryAfter = getHeader(response, 'retry-after');
  if (!retryAfter) return undefined;
  const numeric = Number(retryAfter.trim());
  if (Number.isFinite(numeric)) return Math.max(0, Math.round(numeric));
  const date = Date.parse(retryAfter);
  return Number.isFinite(date) ? Math.max(0, Math.round((date - Date.now()) / 1000)) : undefined;
}

async function safeJson(response: AnthropicFetchResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    if (!response.text) return undefined;
    try {
      return await response.text();
    } catch {
      return undefined;
    }
  }
}

function errorMessageFromBody(body: unknown, response: AnthropicFetchResponse): string {
  if (isRecord(body)) {
    const error = body.error;
    if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
  }
  if (typeof body === 'string' && body.trim()) return body.trim();
  return `Anthropic API request failed with HTTP ${response.status} ${response.statusText}.`;
}

function failureKindFromError(body: unknown, response: AnthropicFetchResponse): ProviderFailureKind {
  if (response.status === 429) return 'rate-limit';
  if (response.status === 504 || response.status === 529 || response.status === 408) return 'timeout';
  if (response.status === 402) return 'quota-exceeded';
  if (isRecord(body) && isRecord(body.error)) {
    if (body.error.type === 'rate_limit_error') return 'rate-limit';
    if (body.error.type === 'billing_error') return 'quota-exceeded';
    if (body.error.type === 'timeout_error' || body.error.type === 'overloaded_error') return 'timeout';
  }
  return 'provider-error';
}

function stringInput(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function promptFor(request: ProviderAdapterRequest): string {
  return request.prompt ?? stringInput(request.input?.prompt) ?? stringInput(request.input?.text) ?? '';
}

function modelFor(request: ProviderAdapterRequest): string {
  return request.modelId ?? stringInput(request.input?.model) ?? DEFAULT_MODEL;
}

function maxTokens(input: Record<string, unknown>): number {
  const value = input.maxTokens ?? input.max_tokens;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : DEFAULT_MAX_TOKENS;
}

function messagesFor(request: ProviderAdapterRequest): unknown[] {
  const input = request.input ?? {};
  if (Array.isArray(input.messages)) return input.messages;
  return [{ role: 'user', content: promptFor(request) }];
}

function buildMessagesBody(request: ProviderAdapterRequest): Record<string, unknown> {
  const input = request.input ?? {};
  const body: Record<string, unknown> = {
    model: modelFor(request),
    max_tokens: maxTokens(input),
    messages: messagesFor(request),
  };

  const system = stringInput(input.instructions) ?? stringInput(input.system) ?? stringInput(input.developer);
  if (system) body.system = system;

  const schema = isRecord(input.jsonSchema) ? input.jsonSchema : isRecord(input.schema) ? input.schema : undefined;
  if (schema) {
    body.output_config = {
      format: {
        type: 'json_schema',
        schema,
      },
    };
  }

  return body;
}

function usageFromAnthropic(value: unknown): ProviderUsageEstimate | undefined {
  if (!isRecord(value)) return undefined;
  const inputTokens = (finiteNumber(value.input_tokens) ?? 0) +
    (finiteNumber(value.cache_creation_input_tokens) ?? 0) +
    (finiteNumber(value.cache_read_input_tokens) ?? 0);
  const usage: ProviderUsageEstimate = {
    inputTokens: inputTokens || undefined,
    outputTokens: finiteNumber(value.output_tokens),
  };
  return Object.values(usage).some(item => item !== undefined) ? usage : undefined;
}

function extractText(raw: unknown): string | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.content)) return undefined;
  const parts: string[] = [];
  for (const block of raw.content) {
    if (!isRecord(block) || block.type !== 'text') continue;
    const text = stringInput(block.text);
    if (text) parts.push(text);
  }
  return parts.length ? parts.join('\n') : undefined;
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function normalizeSuccess(request: ProviderAdapterRequest, raw: unknown): ProviderAdapterResponse {
  const text = extractText(raw);
  if (!text) return providerErrorResponse(request, 'Malformed Anthropic message response.');
  const json = parseJsonText(text);
  return {
    ...responseBase(request),
    modelId: isRecord(raw) ? stringInput(raw.model) ?? request.modelId : request.modelId,
    status: 'succeeded',
    output: {
      text,
      ...(json !== undefined ? { data: { json } } : {}),
    },
    usage: isRecord(raw) ? usageFromAnthropic(raw.usage) : undefined,
  };
}

function defaultFetch(): AnthropicFetchLike | undefined {
  if (typeof globalThis.fetch !== 'function') return undefined;
  return (url, init) => globalThis.fetch(url, init) as Promise<AnthropicFetchResponse>;
}

export function createAnthropicProviderAdapter(options: AnthropicProviderAdapterOptions = {}): ProviderAdapter {
  const metadata = getProviderMetadata('anthropic');
  if (!metadata) throw new Error('Anthropic provider metadata is missing.');
  return new AnthropicProviderAdapter(metadata, options);
}

class AnthropicProviderAdapter implements ProviderAdapter {
  private readonly fetcher?: AnthropicFetchLike;
  private readonly credentialResolver?: AnthropicCredentialResolver;
  private readonly baseUrl: string;

  constructor(
    public readonly metadata: ProviderMetadata,
    options: AnthropicProviderAdapterOptions,
  ) {
    this.fetcher = options.fetch ?? defaultFetch();
    this.credentialResolver = options.credentialResolver;
    this.baseUrl = (options.baseUrl ?? ANTHROPIC_BASE_URL).replace(/\/+$/, '');
  }

  async discoverCapabilities(): Promise<ProviderOperation[]> {
    return [...this.metadata.operations];
  }

  async listModels(): Promise<ProviderModelDescriptor[]> {
    return stableModels(this.metadata.models);
  }

  async execute(
    request: ProviderAdapterRequest,
    options: ProviderAdapterExecuteOptions = {},
  ): Promise<ProviderAdapterResponse> {
    if (options.signal?.aborted) {
      return failedResponse(request, {
        kind: 'cancelled',
        message: 'Request cancelled before execution.',
        retryGuidance: 'Queue a new request after confirming the editor work is still needed.',
      });
    }
    if (!this.metadata.operations.includes(request.operation)) return unsupportedResponse(request);
    if (!this.fetcher) {
      return providerErrorResponse(request, 'Fetch API is unavailable for Anthropic provider execution.');
    }

    const credential = await this.credentialResolver?.({
      providerId: 'anthropic',
      envVar: this.metadata.credential.envVar,
    });
    const apiKey = typeof credential === 'string' && credential.trim() ? credential.trim() : null;
    if (!apiKey) return missingCredentialResponse(request);

    try {
      const response = await this.fetcher(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildMessagesBody(request)),
        signal: options.signal,
      });
      const raw = await safeJson(response);
      if (!response.ok) {
        const kind = failureKindFromError(raw, response);
        return providerErrorResponse(
          request,
          errorMessageFromBody(raw, response),
          apiKey,
          kind,
          kind === 'rate-limit' || kind === 'timeout' ? retryAfterSeconds(response) : undefined,
        );
      }
      return normalizeSuccess(request, raw);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return failedResponse(request, {
          kind: 'cancelled',
          message: 'Request cancelled before execution.',
          retryGuidance: 'Queue a new request after confirming the editor work is still needed.',
        });
      }
      return providerErrorResponse(
        request,
        (error as Error).message || 'Anthropic provider request failed.',
        apiKey,
      );
    }
  }
}
