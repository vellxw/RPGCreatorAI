import { describe, expect, it } from 'vitest';
import { buildProviderCapabilityGates } from '../modelCapabilityRegistry';
import { createOpenCodeWorkflowAdapter } from '../openCodeWorkflowAdapter';
import type { ProviderAdapterRequest } from '../providerAdapter';
import { getProviderMetadata, providerConfigsFromRegistry } from '../providerRegistry';

const workspaceRoot = 'C:/Users/franc/OneDrive/Escritorio/RPGCreatorAI';

function request(overrides: Partial<ProviderAdapterRequest> = {}): ProviderAdapterRequest {
  return {
    id: 'opencode-request-1',
    operation: 'code.assist',
    providerId: 'opencode',
    modelId: 'opencode-workflow',
    prompt: 'Audit provider adapter tests without editing files.',
    createdAt: '2026-06-04T06:30:00.000Z',
    input: {
      cwd: workspaceRoot,
      intent: 'audit',
    },
    ...overrides,
  };
}

describe('openCodeWorkflowAdapter', () => {
  it('discovers the controlled OpenCode workflow capability without credentials', async () => {
    const adapter = createOpenCodeWorkflowAdapter({ workspaceRoot });

    await expect(adapter.discoverCapabilities()).resolves.toEqual(['code.assist']);
    await expect(adapter.listModels()).resolves.toEqual([
      {
        id: 'opencode-workflow',
        label: 'OpenCode controlled workflow',
        operations: ['code.assist'],
      },
    ]);
    expect(adapter.metadata).toMatchObject({
      id: 'opencode',
      adapterKind: 'external-tool',
      credential: { required: false },
      modelSelection: 'not-required',
    });
  });

  it('keeps OpenCode routable for code tooling through provider capability gates', () => {
    const configs = providerConfigsFromRegistry();
    const opencode = configs.find(provider => provider.id === 'opencode');

    expect(getProviderMetadata('opencode')?.models).toContainEqual({
      id: 'opencode-workflow',
      label: 'OpenCode controlled workflow',
      operations: ['code.assist'],
    });
    expect(opencode).toMatchObject({
      credentialState: 'not-required',
      model: '',
    });

    const gates = buildProviderCapabilityGates([
      {
        ...opencode!,
        enabled: true,
        status: 'configured',
      },
    ]);

    expect(gates.find(gate => gate.id === 'code-tooling')).toMatchObject({
      available: true,
      providerId: 'opencode',
      modelId: 'opencode-workflow',
      reason: 'OpenCode adapter / OpenCode controlled workflow',
    });
  });

  it('returns a repo-local handoff without executing OpenCode or allowing mutation by default', async () => {
    const adapter = createOpenCodeWorkflowAdapter({
      workspaceRoot,
      knownSecrets: ['sk-opencode-test-secret'],
    });

    const result = await adapter.execute(request({
      prompt: 'Use token=sk-opencode-test-secret while preparing a safe review handoff.',
      input: {
        cwd: `${workspaceRoot}/src/providers`,
        intent: 'review adapters',
        permissions: {
          read: 'allow',
          grep: 'allow',
          edit: 'deny',
          bash: 'deny',
          webfetch: 'ask',
        },
      },
    }));

    expect(result).toMatchObject({
      status: 'succeeded',
      providerId: 'opencode',
      modelId: 'opencode-workflow',
      output: {
        text: expect.stringContaining('OpenCode handoff prepared'),
        data: {
          workflow: 'opencode',
          status: 'handoff-ready',
          execution: 'not-started',
          cwd: `${workspaceRoot}/src/providers`,
          mutationAllowed: false,
          requiresExplicitExecution: true,
          permissions: {
            read: 'allow',
            grep: 'allow',
            edit: 'deny',
            bash: 'deny',
            webfetch: 'ask',
            external_directory: 'deny',
          },
        },
      },
    });
    expect(result.output?.data?.commandPreview).toEqual([
      'opencode',
      'run',
      '--permission',
      '{"read":"allow","grep":"allow","edit":"deny","bash":"deny","webfetch":"ask","external_directory":"deny"}',
      '[REDACTED_PROMPT]',
    ]);
    expect(JSON.stringify(result)).not.toContain('sk-opencode-test-secret');
  });

  it('fails closed for execution requests and unsafe workspace paths', async () => {
    const adapter = createOpenCodeWorkflowAdapter({ workspaceRoot });

    await expect(adapter.execute(request({
      id: 'execute-request',
      input: {
        cwd: workspaceRoot,
        execute: true,
      },
    }))).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'unsupported-operation',
        message: 'OpenCode workflow adapter only prepares controlled handoffs; it does not execute external tools.',
      },
    });

    await expect(adapter.execute(request({
      id: 'outside-request',
      input: {
        cwd: 'C:/Users/franc/Documents/OtherProject',
      },
    }))).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'provider-error',
        message: expect.stringContaining('outside the configured workspace root'),
      },
    });
  });

  it('models workflow status and failure states deterministically offline', async () => {
    const adapter = createOpenCodeWorkflowAdapter({ workspaceRoot });

    await expect(adapter.execute(request({
      id: 'queued-request',
      input: {
        cwd: workspaceRoot,
        mockStatus: 'queued',
      },
    }))).resolves.toMatchObject({
      status: 'succeeded',
      output: {
        data: {
          status: 'queued',
          execution: 'not-started',
        },
      },
    });

    await expect(adapter.execute(request({
      id: 'blocked-request',
      input: {
        cwd: workspaceRoot,
        mockStatus: 'blocked',
        blockReason: 'OpenCode CLI is not installed.',
      },
    }))).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'provider-error',
        message: 'OpenCode workflow blocked: OpenCode CLI is not installed.',
      },
      output: {
        data: {
          status: 'blocked',
        },
      },
    });

    await expect(adapter.execute(request({
      id: 'completed-request',
      input: {
        cwd: workspaceRoot,
        mockStatus: 'completed',
      },
    }))).resolves.toMatchObject({
      status: 'succeeded',
      output: {
        data: {
          status: 'completed',
        },
      },
    });
  });
});
