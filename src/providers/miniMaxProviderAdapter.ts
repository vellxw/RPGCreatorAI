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

export interface MiniMaxCredentialLookup {
  providerId: 'minimax';
  envVar?: string;
}

export type MiniMaxCredentialResolver = (
  lookup: MiniMaxCredentialLookup,
) => string | null | undefined | Promise<string | null | undefined>;

export interface MiniMaxFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers?: {
    get(name: string): string | null;
  } | Record<string, string | undefined>;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}

export interface MiniMaxFetchInit {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export type MiniMaxFetchLike = (url: string, init: MiniMaxFetchInit) => Promise<MiniMaxFetchResponse>;

export interface MiniMaxProviderAdapterOptions {
  fetch?: MiniMaxFetchLike;
  credentialResolver?: MiniMaxCredentialResolver;
  baseUrl?: string;
}

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';
const DEFAULT_TEXT_MODEL = 'MiniMax-M3';
const DEFAULT_IMAGE_MODEL = 'image-01';
const supportedOperations: ProviderOperation[] = ['text.generate', 'image.generate'];

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
    message: 'MiniMax credential is not configured.',
    retryGuidance: 'Configure MiniMax credentials through an approved credential path before retrying.',
  });
}

function unsupportedResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'unsupported-operation',
    message: `MiniMax adapter does not support ${request.operation}.`,
    retryGuidance: 'Select a provider/model that declares this capability before retrying.',
  });
}

function retryGuidance(kind: ProviderFailureKind, retryAfterSeconds?: number): string {
  if (kind === 'rate-limit') {
    return retryAfterSeconds !== undefined
      ? `Wait ${retryAfterSeconds} seconds before retrying this MiniMax request.`
      : 'Retry after MiniMax rate-limit guidance is available.';
  }
  if (kind === 'quota-exceeded') {
    return 'Review MiniMax balance, quota, and local budget settings before retrying.';
  }
  if (kind === 'timeout') {
    return retryAfterSeconds !== undefined
      ? `Retry after ${retryAfterSeconds} seconds if the request is still needed.`
      : 'Retry later if the request is still needed.';
  }
  return 'Review the MiniMax API error before retrying this request.';
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

function getHeader(response: MiniMaxFetchResponse, header: string): string | null {
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

function retryAfterSeconds(response: MiniMaxFetchResponse): number | undefined {
  const retryAfter = getHeader(response, 'retry-after');
  return retryAfter ? parseRetryValue(retryAfter) : undefined;
}

async function safeJson(response: MiniMaxFetchResponse): Promise<unknown> {
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

function stringInput(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function promptFor(request: ProviderAdapterRequest): string {
  return request.prompt ?? stringInput(request.input?.prompt) ?? stringInput(request.input?.text) ?? '';
}

function modelFor(request: ProviderAdapterRequest, fallback: string): string {
  return request.modelId ?? stringInput(request.input?.model) ?? fallback;
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

function buildTextBody(request: ProviderAdapterRequest): Record<string, unknown> {
  const input = request.input ?? {};
  const body: Record<string, unknown> = {
    model: modelFor(request, DEFAULT_TEXT_MODEL),
    messages: messagesFor(request),
  };

  const maxTokens = maxCompletionTokens(input);
  if (maxTokens !== undefined) body.max_completion_tokens = maxTokens;
  if (isRecord(input.thinking)) body.thinking = input.thinking;
  if (typeof input.reasoningSplit === 'boolean') body.reasoning_split = input.reasoningSplit;
  if (typeof input.reasoning_split === 'boolean') body.reasoning_split = input.reasoning_split;
  if (typeof input.temperature === 'number') body.temperature = input.temperature;
  if (typeof input.topP === 'number') body.top_p = input.topP;
  if (typeof input.top_p === 'number') body.top_p = input.top_p;

  if (isRecord(input.responseFormat)) {
    body.response_format = input.responseFormat;
  } else if (isRecord(input.jsonSchema) || isRecord(input.schema)) {
    body.response_format = { type: 'json_object' };
  }

  return body;
}

function clampImageCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(9, Math.round(value))
    : 1;
}

function aspectRatioFromSize(size: string): string | undefined {
  switch (size) {
    case '1024x1024':
    case '2048x2048':
      return '1:1';
    case '1024x1536':
      return '2:3';
    case '1536x1024':
      return '3:2';
    case '2048x1152':
    case '3840x2160':
      return '16:9';
    case '2160x3840':
      return '9:16';
    default:
      return undefined;
  }
}

function numericImageDimension(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded >= 512 && rounded <= 2048 && rounded % 8 === 0 ? rounded : undefined;
}

function buildSubjectReference(input: Record<string, unknown>): unknown[] | undefined {
  if (Array.isArray(input.subjectReference)) return input.subjectReference;
  if (Array.isArray(input.subject_reference)) return input.subject_reference;
  const imageFile = stringInput(input.imageFile) ??
    stringInput(input.image_file) ??
    stringInput(input.imageUrl) ??
    stringInput(input.image_url) ??
    stringInput(input.sourceImageUrl) ??
    stringInput(input.source_image_url);
  if (!imageFile) return undefined;
  return [{ type: stringInput(input.subjectType) ?? 'character', image_file: imageFile }];
}

function buildImageBody(request: ProviderAdapterRequest): Record<string, unknown> {
  const input = request.input ?? {};
  const body: Record<string, unknown> = {
    model: modelFor(request, DEFAULT_IMAGE_MODEL),
    prompt: promptFor(request),
  };

  const explicitAspectRatio = stringInput(input.aspectRatio) ?? stringInput(input.aspect_ratio);
  const size = stringInput(input.size);
  const aspectRatio = explicitAspectRatio ?? (size ? aspectRatioFromSize(size) : undefined);
  if (aspectRatio) body.aspect_ratio = aspectRatio;

  const width = numericImageDimension(input.width);
  const height = numericImageDimension(input.height);
  if (!aspectRatio && width !== undefined && height !== undefined) {
    body.width = width;
    body.height = height;
  }

  const responseFormat = stringInput(input.responseFormat) ?? stringInput(input.response_format);
  body.response_format = responseFormat === 'url' ? 'url' : 'base64';
  body.n = clampImageCount(input.n ?? input.count);

  const promptOptimizer = input.promptOptimizer ?? input.prompt_optimizer;
  if (typeof promptOptimizer === 'boolean') body.prompt_optimizer = promptOptimizer;

  const seed = finiteNumber(input.seed);
  if (seed !== undefined) body.seed = Math.round(seed);

  const subjectReference = buildSubjectReference(input);
  if (subjectReference) body.subject_reference = subjectReference;

  return body;
}

function usageFromText(value: unknown): ProviderUsageEstimate | undefined {
  if (!isRecord(value)) return undefined;
  const usage: ProviderUsageEstimate = {
    inputTokens: finiteNumber(value.prompt_tokens) ?? finiteNumber(value.input_tokens),
    outputTokens: finiteNumber(value.completion_tokens) ?? finiteNumber(value.output_tokens),
  };
  return Object.values(usage).some(item => item !== undefined) ? usage : undefined;
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
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

function normalizeTextSuccess(request: ProviderAdapterRequest, raw: unknown): ProviderAdapterResponse {
  const text = extractText(raw);
  if (!text) return providerErrorResponse(request, 'Malformed MiniMax chat completion response.');
  const json = parseJsonText(text);
  return {
    ...responseBase(request),
    modelId: isRecord(raw) ? stringInput(raw.model) ?? request.modelId : request.modelId,
    status: 'succeeded',
    output: {
      text,
      ...(json !== undefined ? { data: { json } } : {}),
    },
    usage: isRecord(raw) ? usageFromText(raw.usage) : undefined,
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function imageMimeType(): string {
  return 'image/jpeg';
}

function normalizeImageSuccess(request: ProviderAdapterRequest, raw: unknown): ProviderAdapterResponse {
  if (!isRecord(raw) || !isRecord(raw.data)) {
    return providerErrorResponse(request, 'Malformed MiniMax image response.');
  }

  const urls = stringArray(raw.data.image_urls);
  const b64Images = stringArray(raw.data.image_base64);
  const mimeType = imageMimeType();
  const images: Array<{ ref: string; data: Record<string, unknown> }> = [];

  urls.forEach(url => {
    images.push({
      ref: url,
      data: {
        url,
        mimeType,
        responseFormat: 'url',
      },
    });
  });

  b64Images.forEach((b64Json, index) => {
    images.push({
      ref: `minimax://generated/${request.id}/${index}`,
      data: {
        b64Json,
        mimeType,
        responseFormat: 'base64',
      },
    });
  });

  if (!images.length) return providerErrorResponse(request, 'Malformed MiniMax image response.');

  const metadata = isRecord(raw.metadata) ? raw.metadata : {};
  const successCount = finiteNumber(metadata.success_count);
  return {
    ...responseBase(request),
    modelId: request.modelId ?? DEFAULT_IMAGE_MODEL,
    status: 'succeeded',
    output: {
      assetRefs: images.map(image => image.ref),
      data: {
        images: images.map(image => image.data),
        traceId: stringInput(raw.id),
        metadata: Object.keys(metadata).length ? { ...metadata } : undefined,
      },
    },
    usage: {
      imageCount: successCount ?? images.length,
    },
  };
}

function baseResp(raw: unknown): Record<string, unknown> | undefined {
  return isRecord(raw) && isRecord(raw.base_resp) ? raw.base_resp : undefined;
}

function baseRespStatusCode(raw: unknown): number | undefined {
  const base = baseResp(raw);
  return base ? finiteNumber(base.status_code) : undefined;
}

function baseRespMessage(raw: unknown): string | undefined {
  const base = baseResp(raw);
  return base ? stringInput(base.status_msg) : undefined;
}

function errorMessageFromBody(body: unknown, response: MiniMaxFetchResponse): string {
  const baseMessage = baseRespMessage(body);
  if (baseMessage) return baseMessage;
  if (isRecord(body)) {
    const error = body.error;
    if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
  }
  if (typeof body === 'string' && body.trim()) return body.trim();
  return `MiniMax API request failed with HTTP ${response.status} ${response.statusText}.`;
}

function failureKindFromError(body: unknown, response: MiniMaxFetchResponse): ProviderFailureKind {
  const code = baseRespStatusCode(body);
  if (response.status === 429 || code === 1002 || code === 2045) return 'rate-limit';
  if (response.status === 408 || code === 1001 || code === 1024 || code === 1033) return 'timeout';
  const raw = JSON.stringify(body ?? '').toLowerCase();
  if (
    response.status === 402 ||
    code === 1008 ||
    code === 2056 ||
    raw.includes('insufficient balance') ||
    raw.includes('usage limit exceeded') ||
    raw.includes('quota')
  ) {
    return 'quota-exceeded';
  }
  return 'provider-error';
}

function endpointFor(operation: ProviderOperation): string {
  if (operation === 'text.generate') return '/chat/completions';
  if (operation === 'image.generate') return '/image_generation';
  return '';
}

function bodyFor(request: ProviderAdapterRequest): Record<string, unknown> | ProviderAdapterResponse {
  if (request.operation === 'text.generate') return buildTextBody(request);
  if (request.operation === 'image.generate') return buildImageBody(request);
  return unsupportedResponse(request);
}

function normalizeSuccess(request: ProviderAdapterRequest, raw: unknown): ProviderAdapterResponse {
  const statusCode = baseRespStatusCode(raw);
  if (statusCode !== undefined && statusCode !== 0) {
    return providerErrorResponse(
      request,
      baseRespMessage(raw) ?? `MiniMax API request failed with status code ${statusCode}.`,
      undefined,
      failureKindFromError(raw, { ok: true, status: 200, statusText: 'OK', json: async () => raw }),
    );
  }
  if (request.operation === 'image.generate') return normalizeImageSuccess(request, raw);
  return normalizeTextSuccess(request, raw);
}

function isProviderAdapterResponse(value: unknown): value is ProviderAdapterResponse {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.operation === 'string' &&
    typeof value.providerId === 'string' &&
    typeof value.status === 'string';
}

function defaultFetch(): MiniMaxFetchLike | undefined {
  if (typeof globalThis.fetch !== 'function') return undefined;
  return (url, init) => globalThis.fetch(url, init) as Promise<MiniMaxFetchResponse>;
}

export function createMiniMaxProviderAdapter(options: MiniMaxProviderAdapterOptions = {}): ProviderAdapter {
  const metadata = getProviderMetadata('minimax');
  if (!metadata) throw new Error('MiniMax provider metadata is missing.');
  return new MiniMaxProviderAdapter(metadata, options);
}

class MiniMaxProviderAdapter implements ProviderAdapter {
  private readonly fetcher?: MiniMaxFetchLike;
  private readonly credentialResolver?: MiniMaxCredentialResolver;
  private readonly baseUrl: string;

  constructor(
    public readonly metadata: ProviderMetadata,
    options: MiniMaxProviderAdapterOptions,
  ) {
    this.fetcher = options.fetch ?? defaultFetch();
    this.credentialResolver = options.credentialResolver;
    this.baseUrl = (options.baseUrl ?? MINIMAX_BASE_URL).replace(/\/+$/, '');
  }

  async discoverCapabilities(): Promise<ProviderOperation[]> {
    return this.metadata.operations.filter(operation => supportedOperations.includes(operation));
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
    if (!supportedOperations.includes(request.operation) || !this.metadata.operations.includes(request.operation)) {
      return unsupportedResponse(request);
    }
    if (!this.fetcher) {
      return providerErrorResponse(request, 'Fetch API is unavailable for MiniMax provider execution.');
    }

    const credential = await this.credentialResolver?.({
      providerId: 'minimax',
      envVar: this.metadata.credential.envVar,
    });
    const apiKey = typeof credential === 'string' && credential.trim() ? credential.trim() : null;
    if (!apiKey) return missingCredentialResponse(request);

    const body = bodyFor(request);
    if (isProviderAdapterResponse(body)) return body;

    try {
      const response = await this.fetcher(`${this.baseUrl}${endpointFor(request.operation)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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

      const statusCode = baseRespStatusCode(raw);
      if (statusCode !== undefined && statusCode !== 0) {
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
        (error as Error).message || 'MiniMax provider request failed.',
        apiKey,
      );
    }
  }
}
