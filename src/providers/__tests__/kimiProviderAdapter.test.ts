import { describe, expect, it, vi } from 'vitest';
import {
  createKimiProviderAdapter,
  type KimiCredentialResolver,
  type KimiFetchLike,
} from '../kimiProviderAdapter';
import type { ProviderAdapterRequest } from '../providerAdapter';

const secret = 'sk-moonshot-test-provider-secret';

function request(overrides: Partial<ProviderAdapterRequest> = {}): ProviderAdapterRequest {
  return {
    id: 'kimi-request-1',
    operation: 'text.generate',
    providerId: 'moonshot',
    modelId: 'kimi-k2.6',
    prompt: 'Draft a short item description.',
    createdAt: '2026-06-04T05:30:00.000Z',
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

function adapter(fetch: KimiFetchLike, credentialResolver?: KimiCredentialResolver, baseUrl?: string) {
  return createKimiProviderAdapter({
    fetch,
    credentialResolver: credentialResolver ?? (async () => secret),
    baseUrl,
  });
}

describe('kimiProviderAdapter', () => {
  it('discovers configured Kimi capabilities and models from registry metadata', async () => {
    const kimi = adapter(vi.fn<KimiFetchLike>());

    await expect(kimi.discoverCapabilities()).resolves.toEqual(['text.generate', 'code.assist']);
    await expect(kimi.listModels()).resolves.toEqual(
      expect.arrayContaining([
        {
          id: 'kimi-k2.6',
          label: 'Kimi K2.6',
          operations: ['text.generate', 'code.assist'],
        },
        {
          id: 'kimi-k2.5',
          label: 'Kimi K2.5',
          operations: ['text.generate', 'code.assist'],
        },
        {
          id: 'moonshot-v1-128k',
          label: 'Moonshot v1 128k',
          operations: ['text.generate'],
        },
      ]),
    );
  });

  it('fails closed without credentials and does not call fetch', async () => {
    const fetch = vi.fn<KimiFetchLike>();
    const credentialResolver = vi.fn(async () => null);
    const kimi = adapter(fetch, credentialResolver);

    const result = await kimi.execute(request());

    expect(fetch).not.toHaveBeenCalled();
    expect(credentialResolver).toHaveBeenCalledWith({
      providerId: 'moonshot',
      envVar: 'MOONSHOT_API_KEY',
    });
    expect(result).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'missing-credentials',
        message: 'Kimi / Moonshot credential is not configured.',
      },
    });
  });

  it('normalizes text.generate through the OpenAI-compatible Chat Completions API', async () => {
    const fetch = vi.fn<KimiFetchLike>(async () => jsonResponse({
      id: 'cmpl_123',
      model: 'kimi-k2.6',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'A glass charm that hums near hidden doors.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 14,
        completion_tokens: 10,
        total_tokens: 24,
      },
    }));
    const kimi = adapter(fetch);

    const result = await kimi.execute(request({
      input: {
        instructions: 'Return one sentence.',
        maxCompletionTokens: 256,
        thinking: { type: 'disabled' },
      },
    }));

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.moonshot.ai/v1/chat/completions');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'kimi-k2.6',
      messages: [
        { role: 'system', content: 'Return one sentence.' },
        { role: 'user', content: 'Draft a short item description.' },
      ],
      max_completion_tokens: 256,
      thinking: { type: 'disabled' },
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      modelId: 'kimi-k2.6',
      output: { text: 'A glass charm that hums near hidden doors.' },
      usage: {
        inputTokens: 14,
        outputTokens: 10,
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('uses a custom base URL and maps JSON authoring to response_format', async () => {
    const fetch = vi.fn<KimiFetchLike>(async () => jsonResponse({
      id: 'cmpl_json',
      model: 'moonshot-v1-128k',
      choices: [
        {
          message: {
            role: 'assistant',
            content: '{"id":"moon_key","name":"Moon Key"}',
          },
        },
      ],
      usage: {
        prompt_tokens: 18,
        completion_tokens: 12,
      },
    }));
    const kimi = adapter(fetch, undefined, 'https://workspace.example/v1');

    const result = await kimi.execute(request({
      id: 'json-request-1',
      modelId: 'moonshot-v1-128k',
      input: {
        jsonSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    }));

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://workspace.example/v1/chat/completions');
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'moonshot-v1-128k',
      response_format: { type: 'json_object' },
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      output: {
        text: '{"id":"moon_key","name":"Moon Key"}',
        data: {
          json: {
            id: 'moon_key',
            name: 'Moon Key',
          },
        },
      },
    });
  });

  it('maps Kimi API errors and rate limits into structured redacted failures', async () => {
    const rateLimitedFetch = vi.fn<KimiFetchLike>(async () => jsonResponse({
      error: { message: `Too many requests for ${secret}`, type: 'rate_limit_error' },
    }, {
      status: 429,
      headers: { 'x-ratelimit-reset': '30' },
      statusText: 'Too Many Requests',
    }));
    const rateLimitedKimi = adapter(rateLimitedFetch);

    const rateLimited = await rateLimitedKimi.execute(request({ id: 'rate-limit-1' }));

    expect(rateLimited).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'rate-limit',
        retryAfterSeconds: 30,
      },
    });
    expect(JSON.stringify(rateLimited)).not.toContain(secret);

    const balanceErrorFetch = vi.fn<KimiFetchLike>(async () => jsonResponse({
      error: { message: `Insufficient balance for ${secret}` },
    }, {
      status: 403,
      statusText: 'Forbidden',
    }));
    const balanceErrorKimi = adapter(balanceErrorFetch);

    const balanceError = await balanceErrorKimi.execute(request({ id: 'balance-error-1' }));

    expect(balanceError).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'quota-exceeded',
        message: 'Insufficient balance for [REDACTED]',
      },
    });
    expect(JSON.stringify(balanceError)).not.toContain(secret);
  });
});
