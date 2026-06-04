import { describe, expect, it, vi } from 'vitest';
import {
  createOpenAiProviderAdapter,
  type OpenAiCredentialResolver,
  type OpenAiFetchLike,
} from '../openAiProviderAdapter';
import type { ProviderAdapterRequest } from '../providerAdapter';

const secret = 'sk-test-openai-provider-secret';

function request(overrides: Partial<ProviderAdapterRequest> = {}): ProviderAdapterRequest {
  return {
    id: 'openai-request-1',
    operation: 'text.generate',
    providerId: 'openai',
    modelId: 'gpt-5.5',
    prompt: 'Draft a concise innkeeper greeting.',
    createdAt: '2026-06-04T04:00:00.000Z',
    input: {},
    ...overrides,
  };
}

function jsonResponse(
  body: unknown,
  options: { status?: number; headers?: Record<string, string>; statusText?: string } = {},
) {
  const status = options.status ?? 200;
  const headers = new Headers(options.headers ?? {});
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: options.statusText ?? (status >= 200 && status < 300 ? 'OK' : 'Error'),
    headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function adapter(fetch: OpenAiFetchLike, credentialResolver?: OpenAiCredentialResolver) {
  return createOpenAiProviderAdapter({
    fetch,
    credentialResolver: credentialResolver ?? (async () => secret),
  });
}

describe('openAiProviderAdapter', () => {
  it('discovers configured OpenAI capabilities and models from registry metadata', async () => {
    const openai = adapter(vi.fn());

    await expect(openai.discoverCapabilities()).resolves.toEqual([
      'text.generate',
      'image.generate',
      'image.edit',
      'vision.analyze',
    ]);
    await expect(openai.listModels()).resolves.toEqual(
      expect.arrayContaining([
        {
          id: 'gpt-5.5',
          label: 'GPT-5.5',
          operations: ['text.generate', 'vision.analyze'],
        },
        {
          id: 'gpt-image-2',
          label: 'GPT Image 2',
          operations: ['image.generate', 'image.edit'],
        },
      ]),
    );
  });

  it('fails closed without credentials and does not call fetch', async () => {
    const fetch = vi.fn<OpenAiFetchLike>();
    const credentialResolver = vi.fn(async () => null);
    const openai = adapter(fetch, credentialResolver);

    const result = await openai.execute(request());

    expect(fetch).not.toHaveBeenCalled();
    expect(credentialResolver).toHaveBeenCalledWith({
      providerId: 'openai',
      envVar: 'OPENAI_API_KEY',
    });
    expect(result).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'missing-credentials',
        message: 'OpenAI credential is not configured.',
      },
    });
  });

  it('normalizes text.generate through the Responses API without leaking credentials', async () => {
    const fetch = vi.fn<OpenAiFetchLike>(async () => jsonResponse({
      id: 'resp_123',
      model: 'gpt-5.5',
      output_text: 'Welcome to Mosslight Inn.',
      usage: {
        input_tokens: 9,
        output_tokens: 6,
      },
    }));
    const openai = adapter(fetch);

    const result = await openai.execute(request({
      input: {
        instructions: 'Return one sentence.',
        maxOutputTokens: 80,
      },
    }));

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'gpt-5.5',
      input: 'Draft a concise innkeeper greeting.',
      instructions: 'Return one sentence.',
      max_output_tokens: 80,
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      modelId: 'gpt-5.5',
      output: { text: 'Welcome to Mosslight Inn.' },
      usage: {
        inputTokens: 9,
        outputTokens: 6,
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('normalizes image.generate through the Image API', async () => {
    const fetch = vi.fn<OpenAiFetchLike>(async () => jsonResponse({
      created: 1780545600,
      data: [
        {
          b64_json: 'aW1hZ2UtZml4dHVyZQ==',
          revised_prompt: 'A crisp pixel-art forest tileset.',
        },
      ],
      usage: {
        input_tokens: 12,
        output_tokens: 196,
      },
    }));
    const openai = adapter(fetch);

    const result = await openai.execute(request({
      id: 'image-request-1',
      operation: 'image.generate',
      modelId: 'gpt-image-2',
      prompt: 'Create a forest RPG tileset.',
      input: {
        quality: 'medium',
        size: '1024x1024',
        outputFormat: 'png',
        background: 'opaque',
        moderation: 'auto',
      },
    }));

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'gpt-image-2',
      prompt: 'Create a forest RPG tileset.',
      quality: 'medium',
      size: '1024x1024',
      output_format: 'png',
      background: 'opaque',
      moderation: 'auto',
      n: 1,
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      output: {
        assetRefs: ['openai://generated/image-request-1/0'],
        data: {
          images: [
            {
              b64Json: 'aW1hZ2UtZml4dHVyZQ==',
              revisedPrompt: 'A crisp pixel-art forest tileset.',
              mimeType: 'image/png',
            },
          ],
        },
      },
      usage: {
        inputTokens: 12,
        outputTokens: 196,
        imageCount: 1,
      },
    });
  });

  it('normalizes image.edit requests when an image reference is provided', async () => {
    const fetch = vi.fn<OpenAiFetchLike>(async () => jsonResponse({
      data: [{ url: 'https://example.invalid/edited.png' }],
      usage: { input_tokens: 14, output_tokens: 196 },
    }));
    const openai = adapter(fetch);

    const result = await openai.execute(request({
      id: 'image-edit-request-1',
      operation: 'image.edit',
      modelId: 'gpt-image-2',
      prompt: 'Edit this portrait into a dusk variant.',
      input: {
        image: 'file-openai-image-123',
        size: '1024x1536',
        quality: 'high',
        output_format: 'png',
      },
    }));

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'gpt-image-2',
      prompt: 'Edit this portrait into a dusk variant.',
      image: 'file-openai-image-123',
      quality: 'high',
      size: '1024x1536',
      output_format: 'png',
      n: 1,
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      output: {
        assetRefs: ['https://example.invalid/edited.png'],
        data: {
          images: [{ url: 'https://example.invalid/edited.png', mimeType: 'image/png' }],
        },
      },
      usage: {
        inputTokens: 14,
        outputTokens: 196,
        imageCount: 1,
      },
    });
  });

  it('maps API errors and rate limits into structured redacted failures', async () => {
    const rateLimitedFetch = vi.fn<OpenAiFetchLike>(async () => jsonResponse({
      error: { message: `Rate limit reached for ${secret}` },
    }, {
      status: 429,
      headers: { 'retry-after': '45' },
      statusText: 'Too Many Requests',
    }));
    const openaiRateLimited = adapter(rateLimitedFetch);

    const rateLimited = await openaiRateLimited.execute(request({ id: 'rate-limit-1' }));

    expect(rateLimited).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'rate-limit',
        retryAfterSeconds: 45,
      },
    });
    expect(JSON.stringify(rateLimited)).not.toContain(secret);

    const apiErrorFetch = vi.fn<OpenAiFetchLike>(async () => jsonResponse({
      error: { message: `Invalid API key ${secret}`, code: 'invalid_api_key' },
    }, {
      status: 401,
      statusText: 'Unauthorized',
    }));
    const openaiApiError = adapter(apiErrorFetch);

    const apiError = await openaiApiError.execute(request({ id: 'api-error-1' }));

    expect(apiError).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'provider-error',
        message: 'Invalid API key [REDACTED]',
      },
    });
    expect(JSON.stringify(apiError)).not.toContain(secret);
  });
});
