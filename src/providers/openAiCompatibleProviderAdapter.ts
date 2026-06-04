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

export interface OpenAiCompatibleCredentialLookup {
  providerId: string;
  envVar?: string;
}

export type OpenAiCompatibleCredentialResolver = (
  lookup: OpenAiCompatibleCredentialLookup,
) => string | null | undefined | Promise<string | null | undefined>;

export interface OpenAiCompatibleFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers?: {
    get(name: string): string | null;
  } | Record<string, string | undefined>;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}

export interface OpenAiCompatibleFetchInit {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export type OpenAiCompatibleFetchLike = (
  url: string,
  init: OpenAiCompatibleFetchInit,
) => Promise<OpenAiCompatibleFetchResponse>;

export interface CreateOpenAiCompatibleProviderAdapterOptions {
  providerId: string;
  providerLabel: string;
  defaultBaseUrl: string;
  defaultModelId: string;
  fetch?: OpenAiCompatibleFetchLike;
  credentialResolver?: OpenAiCompatibleCredentialResolver;
  baseUrl?: string;
}

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

function missingCredentialResponse(
  request: ProviderAdapterRequest,
  providerLabel: string,
): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'missing-credentials',
    message: `${providerLabel} credential is not configured.`,
    retryGuidance: `Configure ${providerLabel} credentials through an approved credential path before retrying.`,
  });
}

function unsupportedResponse(request: ProviderAdapterRequest, providerLabel: string): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'unsupported-operation',
    message: `${providerLabel} adapter does not support ${request.operation}.`,
    retryGuidance: 'Select a provider/model that declares this capability before retrying.',
  });
}

function retryGuidance(
  providerLabel: string,
  kind: ProviderFailureKind,
  retryAfterSeconds?: number,
): string {
  if (kind === 'rate-limit') {
    return retryAfterSeconds !== undefined
      ? `Wait ${retryAfterSeconds} seconds before retrying this ${providerLabel} request.`
      : `Retry after ${providerLabel} rate-limit guidance is available.`;
  }
  if (kind === 'quota-exceeded') {
    return `Review ${providerLabel} quota, billing, and local budget settings before retrying.`;
  }
  if (kind === 'timeout') {
    return retryAfterSeconds !== undefined
      ? `Retry after ${retryAfterSeconds} seconds if the request is still needed.`
      : 'Retry later if the request is still needed.';
  }
  return `Review the ${providerLabel} API error before retrying this request.`;
}

function providerErrorResponse(
  request: ProviderAdapterRequest,
  providerLabel: string,
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
    retryGuidance: retryGuidance(providerLabel, kind, retryAfterSeconds),
  });
}

function getHeader(response: OpenAiCompatibleFetchResponse, header: string): string | null {
  const headers = response.headers;
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(header);
  const lower = header.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value ?? null;
  }
  return null;
}

function parseRetryValue(value: string): number | undefined {
  const numeric = Number(value.trim());
  if (Number.isFinite(numeric)) return Math.max(0, Math.round(numeric));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.round((date - Date.now()) / 1000)) : undefined;
}

function retryAfterSeconds(response: OpenAiCompatibleFetchResponse): number | undefined {
  const retryAfter = getHeader(response, 'retry-after');
  if (retryAfter) return parseRetryValue(retryAfter);
  const reset = getHeader(response, 'x-ratelimit-reset') ?? getHeader(response, 'x-ratelimit-reset-requests');
  return reset ? parseRetryValue(reset) : undefined;
}

async function safeJson(response: OpenAiCompatibleFetchResponse): Promise<unknown> {
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

function errorMessageFromBody(body: unknown, response: OpenAiCompatibleFetchResponse): string {
  if (isRecord(body)) {
    const error = body.error;
    if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
  }
  if (typeof body === 'string' && body.trim()) return body.trim();
  return `OpenAI-compatible API request failed with HTTP ${response.status} ${response.statusText}.`;
}

function failureKindFromError(body: unknown, response: OpenAiCompatibleFetchResponse): ProviderFailureKind {
  if (response.status === 429) return 'rate-limit';
  if (response.status === 408 || response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504) {
    return 'timeout';
  }
  const raw = JSON.stringify(body ?? '').toLowerCase();
  if (
    response.status === 402 ||
    response.status === 403 ||
    raw.includes('insufficient balance') ||
    raw.includes('insufficient_quota') ||
    raw.includes('quota')
  ) {
    return 'quota-exceeded';
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

function modelFor(request: ProviderAdapterRequest, defaultModelId: string): string {
  return request.modelId ?? stringInput(request.input?.model) ?? defaultModelId;
}

function maxCompletionTokens(input: Record<string, unknown>): number | undefined {
  const value = input.maxCompletionTokens ?? input.max_completion_tokens ?? input.maxTokens ?? input.max_tokens;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

function messagesFor(request: ProviderAdapterRequest): unknown[] {
  const input = request.input ?? {};
  if (Array.isArray(input.messages)) return input.messages;
  const messages: Array<Record<string, unknown>> = [];
  const system = stringInput(input.instructions) ?? stringInput(input.system) ?? stringInput(input.developer);
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: promptFor(request) });
  return messages;
}

function buildChatCompletionsBody(
  request: ProviderAdapterRequest,
  defaultModelId: string,
): Record<string, unknown> {
  const input = request.input ?? {};
  const body: Record<string, unknown> = {
    model: modelFor(request, defaultModelId),
    messages: messagesFor(request),
  };

  const maxTokens = maxCompletionTokens(input);
  if (maxTokens !== undefined) body.max_completion_tokens = maxTokens;
  if (isRecord(input.thinking)) body.thinking = input.thinking;

  if (isRecord(input.responseFormat)) {
    body.response_format = input.responseFormat;
  } else if (isRecord(input.jsonSchema) || isRecord(input.schema)) {
    body.response_format = { type: 'json_object' };
  }

  return body;
}

function usageFromOpenAiCompatible(value: unknown): ProviderUsageEstimate | undefined {
  if (!isRecord(value)) return undefined;
  const usage: ProviderUsageEstimate = {
    inputTokens: finiteNumber(value.prompt_tokens) ?? finiteNumber(value.input_tokens),
    outputTokens: finiteNumber(value.completion_tokens) ?? finiteNumber(value.output_tokens),
  };
  return Object.values(usage).some(item => item !== undefined) ? usage : undefined;
}

function extractText(raw: unknown): string | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.choices)) return undefined;
  const first = raw.choices.find(isRecord);
  if (!first || !isRecord(first.message)) return undefined;
  const content = first.message.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return undefined;
  const parts: string[] = [];
  for (const part of content) {
    if (!isRecord(part)) continue;
    const text = stringInput(part.text);
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
  if (!text) {
    return providerErrorResponse(request, request.providerId, 'Malformed OpenAI-compatible chat response.');
  }
  const json = parseJsonText(text);
  return {
    ...responseBase(request),
    modelId: isRecord(raw) ? stringInput(raw.model) ?? request.modelId : request.modelId,
    status: 'succeeded',
    output: {
      text,
      ...(json !== undefined ? { data: { json } } : {}),
    },
    usage: isRecord(raw) ? usageFromOpenAiCompatible(raw.usage) : undefined,
  };
}

function defaultFetch(): OpenAiCompatibleFetchLike | undefined {
  if (typeof globalThis.fetch !== 'function') return undefined;
  return (url, init) => globalThis.fetch(url, init) as Promise<OpenAiCompatibleFetchResponse>;
}

export function createOpenAiCompatibleProviderAdapter(
  options: CreateOpenAiCompatibleProviderAdapterOptions,
): ProviderAdapter {
  const metadata = getProviderMetadata(options.providerId);
  if (!metadata) throw new Error(`${options.providerLabel} provider metadata is missing.`);
  return new OpenAiCompatibleProviderAdapter(metadata, options);
}

class OpenAiCompatibleProviderAdapter implements ProviderAdapter {
  private readonly fetcher?: OpenAiCompatibleFetchLike;
  private readonly credentialResolver?: OpenAiCompatibleCredentialResolver;
  private readonly baseUrl: string;

  constructor(
    public readonly metadata: ProviderMetadata,
    private readonly options: CreateOpenAiCompatibleProviderAdapterOptions,
  ) {
    this.fetcher = options.fetch ?? defaultFetch();
    this.credentialResolver = options.credentialResolver;
    this.baseUrl = (options.baseUrl ?? options.defaultBaseUrl).replace(/\/+$/, '');
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
    if (!this.metadata.operations.includes(request.operation)) {
      return unsupportedResponse(request, this.options.providerLabel);
    }
    if (!this.fetcher) {
      return providerErrorResponse(
        request,
        this.options.providerLabel,
        `Fetch API is unavailable for ${this.options.providerLabel} provider execution.`,
      );
    }

    const credential = await this.credentialResolver?.({
      providerId: this.options.providerId,
      envVar: this.metadata.credential.envVar,
    });
    const apiKey = typeof credential === 'string' && credential.trim() ? credential.trim() : null;
    if (!apiKey) return missingCredentialResponse(request, this.options.providerLabel);

    try {
      const response = await this.fetcher(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildChatCompletionsBody(request, this.options.defaultModelId)),
        signal: options.signal,
      });
      const raw = await safeJson(response);
      if (!response.ok) {
        const kind = failureKindFromError(raw, response);
        return providerErrorResponse(
          request,
          this.options.providerLabel,
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
        this.options.providerLabel,
        (error as Error).message || `${this.options.providerLabel} provider request failed.`,
        apiKey,
      );
    }
  }
}
