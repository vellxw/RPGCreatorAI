import { describe, expect, it, vi } from 'vitest';
import {
  createDeepSeekProviderAdapter,
  type DeepSeekCredentialResolver,
  type DeepSeekFetchLike,
} from '../deepSeekProviderAdapter';
import type { ProviderAdapterRequest } from '../providerAdapter';

const secret = 'sk-deepseek-test-provider-secret';

function request(overrides: Partial<ProviderAdapterRequest> = {}): ProviderAdapterRequest {
  return {
    id: 'deepseek-request-1',
    operation: 'text.generate',
    providerId: 'deepseek',
    modelId: 'deepseek-v4-flash',
    prompt: 'Draft a puzzle room clue.',
    createdAt: '2026-06-04T05:40:00.000Z',
    input: {},
    ...overrides,
  };
}

function jsonResponse(
  body: unknown,
  options: { status?: number; headers?: Record<string, string>; statusText?: string } = {},
) {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: options.statusText ?? (status >= 200 && status < 300 ? 'OK' : 'Error'),
    headers: new Headers(options.headers ?? {}),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function adapter(fetch: DeepSeekFetchLike, credentialResolver?: DeepSeekCredentialResolver, baseUrl?: string) {
  return createDeepSeekProviderAdapter({
    fetch,
    credentialResolver: credentialResolver ?? (async () => secret),
    baseUrl,
  });
}

describe('deepSeekProviderAdapter', () => {
  it('discovers configured DeepSeek capabilities and models from registry metadata', async () => {
    const deepseek = adapter(vi.fn<DeepSeekFetchLike>());

    await expect(deepseek.discoverCapabilities()).resolves.toEqual(['text.generate', 'code.assist']);
    await expect(deepseek.listModels()).resolves.toEqual(
      expect.arrayContaining([
        {
          id: 'deepseek-v4-flash',
          label: 'DeepSeek V4 Flash',
          operations: ['text.generate', 'code.assist'],
        },
        {
          id: 'deepseek-v4-pro',
          label: 'DeepSeek V4 Pro',
          operations: ['text.generate', 'code.assist'],
        },
        {
          id: 'deepseek-reasoner',
          label: 'DeepSeek Reasoner',
          operations: ['text.generate', 'code.assist'],
        },
      ]),
    );
  });

  it('fails closed without credentials and does not call fetch', async () => {
    const fetch = vi.fn<DeepSeekFetchLike>();
    const credentialResolver = vi.fn(async () => null);
    const deepseek = adapter(fetch, credentialResolver);

    const result = await deepseek.execute(request());

    expect(fetch).not.toHaveBeenCalled();
    expect(credentialResolver).toHaveBeenCalledWith({
      providerId: 'deepseek',
      envVar: 'DEEPSEEK_API_KEY',
    });
    expect(result).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'missing-credentials',
        message: 'DeepSeek credential is not configured.',
      },
    });
  });

  it('normalizes text.generate through DeepSeek Chat Completions', async () => {
    const fetch = vi.fn<DeepSeekFetchLike>(async () => jsonResponse({
      id: 'cmpl_deepseek',
      model: 'deepseek-v4-flash',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Only the mirror that lies points true north.',
          },
        },
      ],
      usage: {
        prompt_tokens: 16,
        completion_tokens: 9,
      },
    }));
    const deepseek = adapter(fetch);

    const result = await deepseek.execute(request({
      input: {
        instructions: 'Return one line.',
        maxTokens: 384,
      },
    }));

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: 'Return one line.' },
        { role: 'user', content: 'Draft a puzzle room clue.' },
      ],
      max_tokens: 384,
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      modelId: 'deepseek-v4-flash',
      output: { text: 'Only the mirror that lies points true north.' },
      usage: {
        inputTokens: 16,
        outputTokens: 9,
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('supports custom base URLs and JSON authoring mode', async () => {
    const fetch = vi.fn<DeepSeekFetchLike>(async () => jsonResponse({
      id: 'cmpl_json',
      model: 'deepseek-v4-pro',
      choices: [
        {
          message: {
            role: 'assistant',
            content: '{"id":"mirror_room","clue":"Watch the false reflection"}',
          },
        },
      ],
      usage: {
        prompt_tokens: 22,
        completion_tokens: 14,
      },
    }));
    const deepseek = adapter(fetch, undefined, 'https://gateway.example/deepseek');

    const result = await deepseek.execute(request({
      id: 'json-request-1',
      modelId: 'deepseek-v4-pro',
      input: {
        jsonSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            clue: { type: 'string' },
          },
        },
      },
    }));

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://gateway.example/deepseek/chat/completions');
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'deepseek-v4-pro',
      response_format: { type: 'json_object' },
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      output: {
        data: {
          json: {
            id: 'mirror_room',
            clue: 'Watch the false reflection',
          },
        },
      },
    });
  });

  it('maps DeepSeek API errors and rate limits into structured redacted failures', async () => {
    const rateLimitedFetch = vi.fn<DeepSeekFetchLike>(async () => jsonResponse({
      error: { message: `Rate Limit Reached for ${secret}` },
    }, {
      status: 429,
      headers: { 'retry-after': '60' },
      statusText: 'Too Many Requests',
    }));
    const rateLimitedDeepSeek = adapter(rateLimitedFetch);

    const rateLimited = await rateLimitedDeepSeek.execute(request({ id: 'rate-limit-1' }));

    expect(rateLimited).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'rate-limit',
        retryAfterSeconds: 60,
      },
    });
    expect(JSON.stringify(rateLimited)).not.toContain(secret);

    const quotaFetch = vi.fn<DeepSeekFetchLike>(async () => jsonResponse({
      error: { message: `Insufficient Balance: ${secret}` },
    }, {
      status: 402,
      statusText: 'Payment Required',
    }));
    const quotaDeepSeek = adapter(quotaFetch);

    const quota = await quotaDeepSeek.execute(request({ id: 'quota-1' }));

    expect(quota).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'quota-exceeded',
        message: 'Insufficient Balance: [REDACTED]',
      },
    });
    expect(JSON.stringify(quota)).not.toContain(secret);
  });
});
