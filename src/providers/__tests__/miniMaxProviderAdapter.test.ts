import { describe, expect, it, vi } from 'vitest';
import {
  createMiniMaxProviderAdapter,
  type MiniMaxCredentialResolver,
  type MiniMaxFetchLike,
} from '../miniMaxProviderAdapter';
import type { ProviderAdapterRequest } from '../providerAdapter';

const secret = 'sk-minimax-test-provider-secret';

function request(overrides: Partial<ProviderAdapterRequest> = {}): ProviderAdapterRequest {
  return {
    id: 'minimax-request-1',
    operation: 'text.generate',
    providerId: 'minimax',
    modelId: 'MiniMax-M3',
    prompt: 'Draft a shopkeeper greeting.',
    createdAt: '2026-06-04T05:52:00.000Z',
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

function adapter(fetch: MiniMaxFetchLike, credentialResolver?: MiniMaxCredentialResolver, baseUrl?: string) {
  return createMiniMaxProviderAdapter({
    fetch,
    credentialResolver: credentialResolver ?? (async () => secret),
    baseUrl,
  });
}

describe('miniMaxProviderAdapter', () => {
  it('discovers app-supported MiniMax capabilities and models from registry metadata', async () => {
    const minimax = adapter(vi.fn<MiniMaxFetchLike>());

    await expect(minimax.discoverCapabilities()).resolves.toEqual(['text.generate', 'image.generate']);
    await expect(minimax.listModels()).resolves.toEqual(
      expect.arrayContaining([
        {
          id: 'MiniMax-M3',
          label: 'MiniMax M3',
          operations: ['text.generate'],
        },
        {
          id: 'MiniMax-M2.7-highspeed',
          label: 'MiniMax M2.7 Highspeed',
          operations: ['text.generate'],
        },
        {
          id: 'image-01',
          label: 'MiniMax Image 01',
          operations: ['image.generate'],
        },
      ]),
    );
  });

  it('fails closed without credentials and does not call fetch', async () => {
    const fetch = vi.fn<MiniMaxFetchLike>();
    const credentialResolver = vi.fn(async () => null);
    const minimax = adapter(fetch, credentialResolver);

    const result = await minimax.execute(request());

    expect(fetch).not.toHaveBeenCalled();
    expect(credentialResolver).toHaveBeenCalledWith({
      providerId: 'minimax',
      envVar: 'MINIMAX_API_KEY',
    });
    expect(result).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'missing-credentials',
        message: 'MiniMax credential is not configured.',
      },
    });
  });

  it('normalizes text.generate through MiniMax OpenAI-compatible Chat Completions', async () => {
    const fetch = vi.fn<MiniMaxFetchLike>(async () => jsonResponse({
      id: 'chatcmpl_minimax',
      model: 'MiniMax-M3',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Welcome, traveler. Fresh potions and sharper rumors await.',
          },
        },
      ],
      usage: {
        prompt_tokens: 18,
        completion_tokens: 10,
      },
    }));
    const minimax = adapter(fetch);

    const result = await minimax.execute(request({
      input: {
        instructions: 'Return one sentence.',
        maxCompletionTokens: 512,
        jsonSchema: {
          type: 'object',
          properties: { greeting: { type: 'string' } },
        },
      },
    }));

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/chat/completions');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'MiniMax-M3',
      messages: [
        { role: 'system', content: 'Return one sentence.' },
        { role: 'user', content: 'Draft a shopkeeper greeting.' },
      ],
      max_completion_tokens: 512,
      response_format: { type: 'json_object' },
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      modelId: 'MiniMax-M3',
      output: { text: 'Welcome, traveler. Fresh potions and sharper rumors await.' },
      usage: {
        inputTokens: 18,
        outputTokens: 10,
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('normalizes image.generate through MiniMax image_generation with base64 output', async () => {
    const fetch = vi.fn<MiniMaxFetchLike>(async () => jsonResponse({
      id: 'img_minimax',
      data: {
        image_base64: ['ZmFrZS1pbWFnZS0x', 'ZmFrZS1pbWFnZS0y'],
      },
      metadata: {
        failed_count: '0',
        success_count: '2',
      },
      base_resp: {
        status_code: 0,
        status_msg: 'success',
      },
    }));
    const minimax = adapter(fetch, undefined, 'https://gateway.example/minimax/v1');

    const result = await minimax.execute(request({
      id: 'image-request-1',
      operation: 'image.generate',
      modelId: 'image-01',
      prompt: 'A 16-bit potion icon on transparent background.',
      input: {
        aspectRatio: '1:1',
        responseFormat: 'base64',
        n: 2,
        promptOptimizer: true,
        seed: 42,
      },
    }));

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://gateway.example/minimax/v1/image_generation');
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'image-01',
      prompt: 'A 16-bit potion icon on transparent background.',
      aspect_ratio: '1:1',
      response_format: 'base64',
      n: 2,
      prompt_optimizer: true,
      seed: 42,
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      modelId: 'image-01',
      output: {
        assetRefs: [
          'minimax://generated/image-request-1/0',
          'minimax://generated/image-request-1/1',
        ],
        data: {
          images: [
            {
              b64Json: 'ZmFrZS1pbWFnZS0x',
              mimeType: 'image/jpeg',
              responseFormat: 'base64',
            },
            {
              b64Json: 'ZmFrZS1pbWFnZS0y',
              mimeType: 'image/jpeg',
              responseFormat: 'base64',
            },
          ],
          traceId: 'img_minimax',
        },
      },
      usage: {
        imageCount: 2,
      },
    });
  });

  it('maps MiniMax API errors and rate limits into structured redacted failures', async () => {
    const rateLimitedFetch = vi.fn<MiniMaxFetchLike>(async () => jsonResponse({
      base_resp: {
        status_code: 1002,
        status_msg: `rate limit reached for ${secret}`,
      },
    }, {
      headers: { 'retry-after': '45' },
    }));
    const rateLimitedMiniMax = adapter(rateLimitedFetch);

    const rateLimited = await rateLimitedMiniMax.execute(request({ id: 'rate-limit-1' }));

    expect(rateLimited).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'rate-limit',
        retryAfterSeconds: 45,
        message: 'rate limit reached for [REDACTED]',
      },
    });
    expect(JSON.stringify(rateLimited)).not.toContain(secret);

    const quotaFetch = vi.fn<MiniMaxFetchLike>(async () => jsonResponse({
      base_resp: {
        status_code: 1008,
        status_msg: `insufficient balance for ${secret}`,
      },
    }, {
      status: 402,
      statusText: 'Payment Required',
    }));
    const quotaMiniMax = adapter(quotaFetch);

    const quota = await quotaMiniMax.execute(request({ id: 'quota-1' }));

    expect(quota).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'quota-exceeded',
        message: 'insufficient balance for [REDACTED]',
      },
    });
    expect(JSON.stringify(quota)).not.toContain(secret);
  });

  it('does not execute audio or video until app workflows define those outputs', async () => {
    const fetch = vi.fn<MiniMaxFetchLike>();
    const minimax = adapter(fetch);

    const result = await minimax.execute(request({
      operation: 'video.generate',
      modelId: 'MiniMax-Hailuo-2.3',
    }));

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'unsupported-operation',
        message: 'MiniMax adapter does not support video.generate.',
      },
    });
  });
});
