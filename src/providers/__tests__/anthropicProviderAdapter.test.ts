import { describe, expect, it, vi } from 'vitest';
import {
  createAnthropicProviderAdapter,
  type AnthropicCredentialResolver,
  type AnthropicFetchLike,
} from '../anthropicProviderAdapter';
import type { ProviderAdapterRequest } from '../providerAdapter';

const secret = 'sk-ant-test-provider-secret';

function request(overrides: Partial<ProviderAdapterRequest> = {}): ProviderAdapterRequest {
  return {
    id: 'anthropic-request-1',
    operation: 'text.generate',
    providerId: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    prompt: 'Draft a quest hook.',
    createdAt: '2026-06-04T05:20:00.000Z',
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

function adapter(fetch: AnthropicFetchLike, credentialResolver?: AnthropicCredentialResolver) {
  return createAnthropicProviderAdapter({
    fetch,
    credentialResolver: credentialResolver ?? (async () => secret),
  });
}

describe('anthropicProviderAdapter', () => {
  it('discovers configured Claude capabilities and models from registry metadata', async () => {
    const claude = adapter(vi.fn<AnthropicFetchLike>());

    await expect(claude.discoverCapabilities()).resolves.toEqual(['text.generate', 'code.assist']);
    await expect(claude.listModels()).resolves.toEqual(
      expect.arrayContaining([
        {
          id: 'claude-opus-4-8',
          label: 'Claude Opus 4.8',
          operations: ['text.generate', 'code.assist'],
        },
        {
          id: 'claude-sonnet-4-6',
          label: 'Claude Sonnet 4.6',
          operations: ['text.generate', 'code.assist'],
        },
      ]),
    );
  });

  it('fails closed without credentials and does not call fetch', async () => {
    const fetch = vi.fn<AnthropicFetchLike>();
    const credentialResolver = vi.fn(async () => null);
    const claude = adapter(fetch, credentialResolver);

    const result = await claude.execute(request());

    expect(fetch).not.toHaveBeenCalled();
    expect(credentialResolver).toHaveBeenCalledWith({
      providerId: 'anthropic',
      envVar: 'ANTHROPIC_API_KEY',
    });
    expect(result).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'missing-credentials',
        message: 'Anthropic credential is not configured.',
      },
    });
  });

  it('normalizes text.generate through the Messages API without leaking credentials', async () => {
    const fetch = vi.fn<AnthropicFetchLike>(async () => jsonResponse({
      id: 'msg_123',
      model: 'claude-sonnet-4-6',
      type: 'message',
      content: [{ type: 'text', text: 'A lantern goes dark beneath the old bridge.' }],
      usage: {
        input_tokens: 12,
        output_tokens: 9,
      },
    }));
    const claude = adapter(fetch);

    const result = await claude.execute(request({
      input: {
        instructions: 'Return one sentence.',
        maxTokens: 256,
      },
    }));

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'x-api-key': secret,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{ role: 'user', content: 'Draft a quest hook.' }],
      system: 'Return one sentence.',
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      modelId: 'claude-sonnet-4-6',
      output: { text: 'A lantern goes dark beneath the old bridge.' },
      usage: {
        inputTokens: 12,
        outputTokens: 9,
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('maps structured JSON requests to output_config.format', async () => {
    const fetch = vi.fn<AnthropicFetchLike>(async () => jsonResponse({
      id: 'msg_structured',
      model: 'claude-opus-4-8',
      type: 'message',
      content: [{ type: 'text', text: '{"name":"Lantern Bridge","objective":"Find the lost scout"}' }],
      usage: {
        input_tokens: 32,
        output_tokens: 18,
      },
    }));
    const claude = adapter(fetch);
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        objective: { type: 'string' },
      },
      required: ['name', 'objective'],
      additionalProperties: false,
    };

    const result = await claude.execute(request({
      id: 'structured-request-1',
      modelId: 'claude-opus-4-8',
      input: {
        jsonSchema: schema,
        maxTokens: 512,
      },
    }));

    const [, init] = fetch.mock.calls[0];
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      output_config: {
        format: {
          type: 'json_schema',
          schema,
        },
      },
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      output: {
        text: '{"name":"Lantern Bridge","objective":"Find the lost scout"}',
        data: {
          json: {
            name: 'Lantern Bridge',
            objective: 'Find the lost scout',
          },
        },
      },
    });
  });

  it('maps API errors and rate limits into structured redacted failures', async () => {
    const rateLimitedFetch = vi.fn<AnthropicFetchLike>(async () => jsonResponse({
      type: 'error',
      error: {
        type: 'rate_limit_error',
        message: `Rate limit reached for ${secret}`,
      },
    }, {
      status: 429,
      headers: { 'retry-after': '30' },
      statusText: 'Too Many Requests',
    }));
    const rateLimitedClaude = adapter(rateLimitedFetch);

    const rateLimited = await rateLimitedClaude.execute(request({ id: 'rate-limit-1' }));

    expect(rateLimited).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'rate-limit',
        retryAfterSeconds: 30,
      },
    });
    expect(JSON.stringify(rateLimited)).not.toContain(secret);

    const authErrorFetch = vi.fn<AnthropicFetchLike>(async () => jsonResponse({
      type: 'error',
      error: {
        type: 'authentication_error',
        message: `Invalid API key ${secret}`,
      },
    }, {
      status: 401,
      statusText: 'Unauthorized',
    }));
    const authErrorClaude = adapter(authErrorFetch);

    const authError = await authErrorClaude.execute(request({ id: 'auth-error-1' }));

    expect(authError).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'provider-error',
        message: 'Invalid API key [REDACTED]',
      },
    });
    expect(JSON.stringify(authError)).not.toContain(secret);
  });
});
