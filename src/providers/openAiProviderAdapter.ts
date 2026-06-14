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

export interface OpenAiCredentialLookup {
  providerId: 'openai';
  envVar?: string;
}

export type OpenAiCredentialResolver = (
  lookup: OpenAiCredentialLookup,
) => string | null | undefined | Promise<string | null | undefined>;

export interface OpenAiFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers?: {
    get(name: string): string | null;
  } | Record<string, string | undefined>;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}

export interface OpenAiFetchInit {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export type OpenAiFetchLike = (url: string, init: OpenAiFetchInit) => Promise<OpenAiFetchResponse>;

export interface OpenAiProviderAdapterOptions {
  fetch?: OpenAiFetchLike;
  credentialResolver?: OpenAiCredentialResolver;
  baseUrl?: string;
}

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TEXT_MODEL = 'gpt-5.5';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

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

function unsupportedResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'unsupported-operation',
    message: `OpenAI adapter does not support ${request.operation}.`,
    retryGuidance: 'Select a provider/model that declares this capability before retrying.',
  });
}

function missingCredentialResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  return failedResponse(request, {
    kind: 'missing-credentials',
    message: 'OpenAI credential is not configured.',
    retryGuidance: 'Configure OpenAI credentials through an approved credential path before retrying.',
  });
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

function retryGuidance(kind: ProviderFailureKind, retryAfterSeconds?: number): string {
  if (kind === 'rate-limit') {
    return retryAfterSeconds !== undefined
      ? `Wait ${retryAfterSeconds} seconds before retrying this OpenAI request.`
      : 'Retry with exponential backoff after OpenAI rate-limit guidance is available.';
  }
  if (kind === 'quota-exceeded') {
    return 'Review OpenAI quota, billing, and the local budget settings before retrying.';
  }
  if (kind === 'timeout') {
    return retryAfterSeconds !== undefined
      ? `Retry after ${retryAfterSeconds} seconds if the request is still needed.`
      : 'Retry later if the request is still needed.';
  }
  return 'Review the OpenAI API error before retrying this request.';
}

function getHeader(response: OpenAiFetchResponse, header: string): string | null {
  const headers = response.headers;
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(header);
  const lower = header.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value ?? null;
  }
  return null;
}

function parseDurationSeconds(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return Math.max(0, Math.round(numeric));

  const seconds = trimmed.match(/^(\d+(?:\.\d+)?)s$/i);
  if (seconds) return Math.max(0, Math.round(Number(seconds[1])));
  const minutes = trimmed.match(/^(\d+(?:\.\d+)?)m(?:(\d+(?:\.\d+)?)s)?$/i);
  if (minutes) {
    return Math.max(0, Math.round(Number(minutes[1]) * 60 + Number(minutes[2] ?? 0)));
  }

  const date = Date.parse(trimmed);
  if (Number.isFinite(date)) return Math.max(0, Math.round((date - Date.now()) / 1000));
  return undefined;
}

function retryAfterSeconds(response: OpenAiFetchResponse): number | undefined {
  const retryAfter = getHeader(response, 'retry-after');
  if (retryAfter) return parseDurationSeconds(retryAfter);
  const resetRequests = getHeader(response, 'x-ratelimit-reset-requests');
  if (resetRequests) return parseDurationSeconds(resetRequests);
  return undefined;
}

async function safeJson(response: OpenAiFetchResponse): Promise<unknown> {
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

function errorMessageFromBody(body: unknown, response: OpenAiFetchResponse): string {
  if (isRecord(body)) {
    const error = body.error;
    if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
  }
  if (typeof body === 'string' && body.trim()) return body.trim();
  return `OpenAI API request failed with HTTP ${response.status} ${response.statusText}.`;
}

function failureKindFromError(body: unknown, response: OpenAiFetchResponse): ProviderFailureKind {
  if (response.status === 429) return 'rate-limit';
  if (response.status === 408 || response.status === 504) return 'timeout';

  const raw = JSON.stringify(body ?? '').toLowerCase();
  if (response.status === 402 || raw.includes('insufficient_quota') || raw.includes('quota')) {
    return 'quota-exceeded';
  }
  return 'provider-error';
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function usageFromOpenAi(value: unknown, imageCount?: number): ProviderUsageEstimate | undefined {
  if (!isRecord(value)) return imageCount ? { imageCount } : undefined;
  const usage: ProviderUsageEstimate = {
    inputTokens: finiteNumber(value.input_tokens) ?? finiteNumber(value.inputTokens),
    outputTokens: finiteNumber(value.output_tokens) ?? finiteNumber(value.outputTokens),
    imageCount,
  };
  return Object.values(usage).some(item => item !== undefined) ? usage : undefined;
}

function stringInput(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function promptFor(request: ProviderAdapterRequest): string {
  return request.prompt ?? stringInput(request.input?.prompt) ?? stringInput(request.input?.text) ?? '';
}

function modelFor(request: ProviderAdapterRequest, fallback: string): string {
  return request.modelId ?? stringInput(request.input?.model) ?? fallback;
}

function maxOutputTokens(input: Record<string, unknown>): number | undefined {
  const value = input.maxOutputTokens ?? input.max_output_tokens;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

function responsesInput(request: ProviderAdapterRequest): unknown {
  const raw = request.input ?? {};
  const direct = raw.responsesInput ?? raw.input;
  if (typeof direct === 'string' || Array.isArray(direct)) return direct;

  const prompt = promptFor(request);
  if (request.operation !== 'vision.analyze') return prompt;

  const imageUrl = stringInput(raw.imageUrl) ?? stringInput(raw.image_url);
  if (!imageUrl) return prompt;

  return [
    {
      role: 'user',
      content: [
        { type: 'input_text', text: prompt },
        { type: 'input_image', image_url: imageUrl, detail: stringInput(raw.detail) ?? 'auto' },
      ],
    },
  ];
}

function buildResponsesBody(request: ProviderAdapterRequest): Record<string, unknown> {
  const input = request.input ?? {};
  const body: Record<string, unknown> = {
    model: modelFor(request, DEFAULT_TEXT_MODEL),
    input: responsesInput(request),
  };

  const instructions = stringInput(input.instructions) ?? stringInput(input.system) ?? stringInput(input.developer);
  if (instructions) body.instructions = instructions;

  const maxTokens = maxOutputTokens(input);
  if (maxTokens !== undefined) body.max_output_tokens = maxTokens;

  return body;
}

function stringSetting(input: Record<string, unknown>, camel: string, snake: string): string | undefined {
  return stringInput(input[snake]) ?? stringInput(input[camel]);
}

function numericSetting(input: Record<string, unknown>, camel: string, snake: string): number | undefined {
  const value = input[snake] ?? input[camel];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
}

function addImageSettings(body: Record<string, unknown>, input: Record<string, unknown>): void {
  for (const [camel, snake] of [
    ['quality', 'quality'],
    ['size', 'size'],
    ['outputFormat', 'output_format'],
    ['background', 'background'],
    ['moderation', 'moderation'],
  ] as const) {
    const value = stringSetting(input, camel, snake);
    if (value) body[snake] = value;
  }

  const compression = numericSetting(input, 'outputCompression', 'output_compression');
  if (compression !== undefined) body.output_compression = Math.min(100, Math.max(0, compression));
}

function imageCount(input: Record<string, unknown>): number {
  const value = input.n ?? input.count;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(10, Math.round(value))
    : 1;
}

function buildImageGenerationBody(request: ProviderAdapterRequest): Record<string, unknown> {
  const input = request.input ?? {};
  const body: Record<string, unknown> = {
    model: modelFor(request, DEFAULT_IMAGE_MODEL),
    prompt: promptFor(request),
  };
  addImageSettings(body, input);
  body.n = imageCount(input);
  return body;
}

function imageReference(input: Record<string, unknown>): string | undefined {
  return stringInput(input.image) ??
    stringInput(input.imageFileId) ??
    stringInput(input.image_file_id) ??
    stringInput(input.sourceFileId) ??
    stringInput(input.source_file_id) ??
    stringInput(input.imageUrl) ??
    stringInput(input.image_url) ??
    stringInput(input.sourceImageUrl) ??
    stringInput(input.source_image_url);
}

function buildImageEditBody(request: ProviderAdapterRequest): Record<string, unknown> | ProviderAdapterResponse {
  const input = request.input ?? {};
  const image = imageReference(input);
  if (!image) {
    return failedResponse(request, {
      kind: 'provider-error',
      message: 'OpenAI image edit requires an image reference.',
      retryGuidance: 'Provide an uploaded file id or image URL before retrying.',
    });
  }

  const body: Record<string, unknown> = {
    model: modelFor(request, DEFAULT_IMAGE_MODEL),
    prompt: promptFor(request),
    image,
  };
  addImageSettings(body, input);
  const mask = stringInput(input.mask) ?? stringInput(input.maskFileId) ?? stringInput(input.mask_file_id);
  if (mask) body.mask = mask;
  body.n = imageCount(input);
  return body;
}

function isProviderAdapterResponse(value: unknown): value is ProviderAdapterResponse {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.operation === 'string' &&
    typeof value.providerId === 'string' &&
    typeof value.status === 'string';
}

function extractText(raw: unknown): string | undefined {
  if (!isRecord(raw)) return undefined;
  const direct = stringInput(raw.output_text);
  if (direct) return direct;

  const output = raw.output;
  if (!Array.isArray(output)) return undefined;
  const parts: string[] = [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (isRecord(block)) {
        const text = stringInput(block.text);
        if (text) parts.push(text);
      }
    }
  }
  return parts.length ? parts.join('\n') : undefined;
}

function normalizeTextResponse(request: ProviderAdapterRequest, raw: unknown): ProviderAdapterResponse {
  const text = extractText(raw);
  if (!text) {
    return providerErrorResponse(request, 'Malformed OpenAI text response.');
  }
  return {
    ...responseBase(request),
    modelId: request.modelId ?? (isRecord(raw) ? stringInput(raw.model) : undefined),
    status: 'succeeded',
    output: { text },
    usage: isRecord(raw) ? usageFromOpenAi(raw.usage) : undefined,
  };
}

function mimeTypeFor(input: Record<string, unknown>): string {
  const outputFormat = stringSetting(input, 'outputFormat', 'output_format') ?? 'png';
  return `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}`;
}

function normalizeImageResponse(request: ProviderAdapterRequest, raw: unknown): ProviderAdapterResponse {
  if (!isRecord(raw) || !Array.isArray(raw.data)) {
    return providerErrorResponse(request, 'Malformed OpenAI image response.');
  }

  const mimeType = mimeTypeFor(request.input ?? {});
  const images: Array<{ ref: string; data: Record<string, unknown> }> = [];
  raw.data.forEach((item, index) => {
    if (!isRecord(item)) return;
    const url = stringInput(item.url);
    const b64Json = stringInput(item.b64_json);
    if (!url && !b64Json) return;
    const revisedPrompt = stringInput(item.revised_prompt);
    images.push({
      ref: url ?? `openai://generated/${request.id}/${index}`,
      data: {
        ...(url ? { url } : {}),
        ...(b64Json ? { b64Json } : {}),
        ...(revisedPrompt ? { revisedPrompt } : {}),
        mimeType,
      },
    });
  });

  if (!images.length) return providerErrorResponse(request, 'Malformed OpenAI image response.');

  return {
    ...responseBase(request),
    status: 'succeeded',
    output: {
      assetRefs: images.map(image => image.ref),
      data: {
        images: images.map(image => image.data),
      },
    },
    usage: usageFromOpenAi(raw.usage, images.length),
  };
}

function endpointFor(operation: ProviderOperation): string {
  if (operation === 'text.generate' || operation === 'vision.analyze') return '/responses';
  if (operation === 'image.generate') return '/images/generations';
  if (operation === 'image.edit') return '/images/edits';
  return '';
}

function requestBodyFor(request: ProviderAdapterRequest): Record<string, unknown> | ProviderAdapterResponse {
  if (request.operation === 'text.generate' || request.operation === 'vision.analyze') return buildResponsesBody(request);
  if (request.operation === 'image.generate') return buildImageGenerationBody(request);
  if (request.operation === 'image.edit') return buildImageEditBody(request);
  return unsupportedResponse(request);
}

function normalizeSuccess(request: ProviderAdapterRequest, raw: unknown): ProviderAdapterResponse {
  if (request.operation === 'image.generate' || request.operation === 'image.edit') {
    return normalizeImageResponse(request, raw);
  }
  return normalizeTextResponse(request, raw);
}

function defaultFetch(): OpenAiFetchLike | undefined {
  if (typeof globalThis.fetch !== 'function') return undefined;
  return (url, init) => globalThis.fetch(url, init) as Promise<OpenAiFetchResponse>;
}

export function createOpenAiProviderAdapter(options: OpenAiProviderAdapterOptions = {}): ProviderAdapter {
  const metadata = getProviderMetadata('openai');
  if (!metadata) throw new Error('OpenAI provider metadata is missing.');
  return new OpenAiProviderAdapter(metadata, options);
}

class OpenAiProviderAdapter implements ProviderAdapter {
  private readonly fetcher?: OpenAiFetchLike;
  private readonly credentialResolver?: OpenAiCredentialResolver;
  private readonly baseUrl: string;

  constructor(
    public readonly metadata: ProviderMetadata,
    options: OpenAiProviderAdapterOptions,
  ) {
    this.fetcher = options.fetch ?? defaultFetch();
    this.credentialResolver = options.credentialResolver;
    this.baseUrl = (options.baseUrl ?? OPENAI_BASE_URL).replace(/\/+$/, '');
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

    const modelId = modelFor(request, '');
    const modelDescriptor = this.metadata.models.find(m => m.id === modelId);
    if (modelId && modelDescriptor && !modelDescriptor.operations.includes(request.operation)) {
      return failedResponse(request, {
        kind: 'unsupported-operation',
        message: `Model '${modelId}' does not support '${request.operation}'. Supported operations: ${modelDescriptor.operations.join(', ') || 'none'}.`,
        retryGuidance: 'Select a model that declares this operation before retrying.',
      });
    }

    if (!this.fetcher) {
      return providerErrorResponse(request, 'Fetch API is unavailable for OpenAI provider execution.');
    }

    const credential = await this.credentialResolver?.({
      providerId: 'openai',
      envVar: this.metadata.credential.envVar,
    });
    const apiKey = typeof credential === 'string' && credential.trim() ? credential.trim() : null;
    if (!apiKey) return missingCredentialResponse(request);

    const body = requestBodyFor(request);
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
        (error as Error).message || 'OpenAI provider request failed.',
        apiKey,
      );
    }
  }
}
