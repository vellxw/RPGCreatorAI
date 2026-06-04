import { describe, expect, it, vi } from 'vitest';
import {
  createCustomOpenAiCompatibleProviderAdapter,
  type CustomOpenAiCompatibleCredentialResolver,
  type CustomOpenAiCompatibleFetchLike,
} from '../customOpenAiCompatibleProviderAdapter';
import type { ProviderAdapterRequest } from '../providerAdapter';

const secret = 'sk-custom-endpoint-test-secret';

function request(overrides: Partial<ProviderAdapterRequest> = {}): ProviderAdapterRequest {
  return {
    id: 'custom-request-1',
    operation: 'text.generate',
    providerId: 'custom',
    modelId: 'local-rpg-model',
    prompt: 'Draft a town rumor.',
    createdAt: '2026-06-04T06:45:00.000Z',
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

function adapter(
  fetch: CustomOpenAiCompatibleFetchLike,
  overrides: {
    credentialResolver?: CustomOpenAiCompatibleCredentialResolver;
    baseUrl?: string;
    modelId?: string;
    capabilities?: Array<'text' | 'structured-json' | 'code'>;
  } = {},
) {
  return createCustomOpenAiCompatibleProviderAdapter({
    fetch,
    credentialResolver: overrides.credentialResolver ?? (async () => secret),
    baseUrl: overrides.baseUrl ?? 'http://localhost:11434/v1',
    defaultModelId: overrides.modelId ?? 'local-rpg-model',
    capabilities: overrides.capabilities ?? ['text', 'structured-json', 'code'],
  });
}

describe('customOpenAiCompatibleProviderAdapter', () => {
  it('uses user-entered model and capability config without registry defaults', async () => {
    const custom = adapter(vi.fn<CustomOpenAiCompatibleFetchLike>());

    await expect(custom.discoverCapabilities()).resolves.toEqual(['text.generate', 'code.assist']);
    await expect(custom.listModels()).resolves.toEqual([
      {
        id: 'local-rpg-model',
        label: 'local-rpg-model',
        operations: ['text.generate', 'code.assist'],
      },
    ]);
    expect(custom.metadata).toMatchObject({
      id: 'custom',
      adapterKind: 'openai-compatible',
      credential: { required: true, envVar: 'CUSTOM_OPENAI_API_KEY' },
      modelSelection: 'user-selected',
    });
  });

  it('fails closed until base URL, model, capabilities, and credentials are configured', async () => {
    const fetch = vi.fn<CustomOpenAiCompatibleFetchLike>();

    await expect(adapter(fetch, { baseUrl: '' }).execute(request())).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'provider-error',
        message: 'Custom endpoint base URL is required.',
      },
    });
    await expect(adapter(fetch, { baseUrl: 'http://api.example.com/v1' }).execute(request())).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'provider-error',
        message: 'Custom endpoint remote base URLs must use HTTPS.',
      },
    });
    await expect(adapter(fetch, { modelId: '' }).execute(request({ modelId: undefined }))).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'provider-error',
        message: 'Custom endpoint requires a user-entered model id.',
      },
    });
    await expect(adapter(fetch, { capabilities: [] }).execute(request())).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'provider-error',
        message: 'Custom endpoint requires user-entered capability config.',
      },
    });
    await expect(adapter(fetch, {
      credentialResolver: async () => null,
    }).execute(request())).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'missing-credentials',
        message: 'Custom OpenAI-compatible endpoint credential is not configured.',
      },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('normalizes text.generate through a validated OpenAI-compatible chat endpoint', async () => {
    const fetch = vi.fn<CustomOpenAiCompatibleFetchLike>(async () => jsonResponse({
      id: 'chatcmpl_custom',
      model: 'local-rpg-model',
      choices: [
        {
          message: {
            role: 'assistant',
            content: '{"rumor":"The old bridge hums at midnight."}',
          },
        },
      ],
      usage: {
        prompt_tokens: 11,
        completion_tokens: 8,
      },
    }));
    const custom = adapter(fetch);

    const result = await custom.execute(request({
      input: {
        instructions: 'Return JSON only.',
        jsonSchema: {
          type: 'object',
          properties: { rumor: { type: 'string' } },
        },
        maxCompletionTokens: 256,
      },
    }));

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'local-rpg-model',
      messages: [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: 'Draft a town rumor.' },
      ],
      max_completion_tokens: 256,
      response_format: { type: 'json_object' },
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      modelId: 'local-rpg-model',
      output: {
        text: '{"rumor":"The old bridge hums at midnight."}',
        data: {
          json: {
            rumor: 'The old bridge hums at midnight.',
          },
        },
      },
      usage: {
        inputTokens: 11,
        outputTokens: 8,
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('rejects undeclared operations and redacts custom endpoint API failures', async () => {
    const textOnly = adapter(vi.fn<CustomOpenAiCompatibleFetchLike>(), {
      capabilities: ['text'],
    });

    await expect(textOnly.execute(request({ operation: 'code.assist' }))).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'unsupported-operation',
        message: 'Custom OpenAI-compatible endpoint adapter does not support code.assist.',
      },
    });

    const fetch = vi.fn<CustomOpenAiCompatibleFetchLike>(async () => jsonResponse({
      error: { message: `Upstream rejected token ${secret}` },
    }, {
      status: 429,
      headers: { 'retry-after': '30' },
      statusText: 'Too Many Requests',
    }));
    const custom = adapter(fetch);

    const result = await custom.execute(request({ id: 'rate-limit-1' }));

    expect(result).toMatchObject({
      status: 'failed',
      failure: {
        kind: 'rate-limit',
        retryAfterSeconds: 30,
        message: 'Upstream rejected token [REDACTED]',
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
