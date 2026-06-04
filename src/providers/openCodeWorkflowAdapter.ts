import { redactSecrets } from '../security/redaction';
import type {
  ProviderAdapter,
  ProviderAdapterExecuteOptions,
  ProviderAdapterFailure,
  ProviderAdapterRequest,
  ProviderAdapterResponse,
} from './providerAdapter';
import {
  getProviderMetadata,
  type ProviderMetadata,
  type ProviderModelDescriptor,
  type ProviderOperation,
} from './providerRegistry';

type OpenCodePermissionDecision = 'allow' | 'ask' | 'deny';
type OpenCodeWorkflowStatus =
  | 'handoff-ready'
  | 'queued'
  | 'running'
  | 'blocked'
  | 'failed'
  | 'completed';

type OpenCodePermissionMap = Record<string, OpenCodePermissionDecision>;

export interface OpenCodeWorkflowAdapterOptions {
  workspaceRoot?: string;
  knownSecrets?: string[];
}

const DEFAULT_PERMISSIONS: OpenCodePermissionMap = {
  read: 'allow',
  grep: 'allow',
  glob: 'allow',
  list: 'allow',
  edit: 'deny',
  bash: 'deny',
  webfetch: 'ask',
  external_directory: 'deny',
};

const SAFE_PERMISSION_VALUES = new Set<OpenCodePermissionDecision>(['allow', 'ask', 'deny']);
const SAFE_STATUSES = new Set<OpenCodeWorkflowStatus>([
  'handoff-ready',
  'queued',
  'running',
  'blocked',
  'failed',
  'completed',
]);

function responseBase(request: ProviderAdapterRequest): Pick<
  ProviderAdapterResponse,
  'id' | 'operation' | 'providerId' | 'modelId'
> {
  return {
    id: request.id,
    operation: request.operation,
    providerId: request.providerId,
    modelId: request.modelId ?? 'opencode-workflow',
  };
}

function failedResponse(
  request: ProviderAdapterRequest,
  failure: ProviderAdapterFailure,
  data?: Record<string, unknown>,
): ProviderAdapterResponse {
  return {
    ...responseBase(request),
    status: 'failed',
    error: failure.message,
    failure,
    ...(data ? { output: { data } } : {}),
  };
}

function cancelledResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  const failure: ProviderAdapterFailure = {
    kind: 'cancelled',
    message: 'OpenCode workflow request cancelled before handoff preparation.',
  };
  return {
    ...responseBase(request),
    status: 'cancelled',
    error: failure.message,
    failure,
  };
}

function unsupportedResponse(request: ProviderAdapterRequest): ProviderAdapterResponse {
  const failure: ProviderAdapterFailure = {
    kind: 'unsupported-operation',
    message: `OpenCode workflow adapter does not support ${request.operation}.`,
    retryGuidance: 'Use code.assist for OpenCode workflow handoffs.',
  };
  return failedResponse(request, failure);
}

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+/g, '/').trim();
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function isPathInside(root: string, candidate: string): boolean {
  const normalizedRoot = normalizePath(root).toLowerCase();
  const normalizedCandidate = normalizePath(candidate).toLowerCase();
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
}

function stringInput(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function booleanInput(input: Record<string, unknown>, key: string): boolean {
  return input[key] === true;
}

function workflowStatus(input: Record<string, unknown>): OpenCodeWorkflowStatus {
  const rawStatus = input.mockStatus;
  if (typeof rawStatus === 'string' && SAFE_STATUSES.has(rawStatus as OpenCodeWorkflowStatus)) {
    return rawStatus as OpenCodeWorkflowStatus;
  }
  return 'handoff-ready';
}

function permissionsFromInput(input: Record<string, unknown>): OpenCodePermissionMap | ProviderAdapterFailure {
  const rawPermissions = input.permissions;
  const permissions: OpenCodePermissionMap = rawPermissions &&
    typeof rawPermissions === 'object' &&
    !Array.isArray(rawPermissions)
    ? {}
    : { ...DEFAULT_PERMISSIONS };

  if (rawPermissions && typeof rawPermissions === 'object' && !Array.isArray(rawPermissions)) {
    for (const [key, value] of Object.entries(rawPermissions)) {
      if (!SAFE_PERMISSION_VALUES.has(value as OpenCodePermissionDecision)) {
        return {
          kind: 'provider-error',
          message: `OpenCode permission ${key} has unsupported decision ${String(value)}.`,
          retryGuidance: 'Use allow, ask, or deny permission decisions only.',
        };
      }
      permissions[key] = value as OpenCodePermissionDecision;
    }
  }

  permissions.external_directory = 'deny';
  if (!permissions.edit) permissions.edit = 'deny';
  if (!permissions.bash) permissions.bash = 'deny';

  if (permissions.edit === 'allow' || permissions.bash === 'allow') {
    return {
      kind: 'provider-error',
      message: 'OpenCode handoffs must keep edit and bash permissions at ask or deny.',
      retryGuidance: 'Prepare a non-destructive handoff first, then execute externally with explicit approval.',
    };
  }

  return permissions;
}

function isProviderFailure(value: OpenCodePermissionMap | ProviderAdapterFailure): value is ProviderAdapterFailure {
  return typeof (value as ProviderAdapterFailure).kind === 'string' &&
    typeof (value as ProviderAdapterFailure).message === 'string';
}

function safeText(value: string | undefined, knownSecrets: string[]): string {
  return redactSecrets(value ?? '', knownSecrets);
}

function handoffData(
  status: OpenCodeWorkflowStatus,
  cwd: string,
  permissions: OpenCodePermissionMap,
  request: ProviderAdapterRequest,
  knownSecrets: string[],
): Record<string, unknown> {
  const redactedPrompt = safeText(request.prompt, knownSecrets);
  return {
    workflow: 'opencode',
    status,
    execution: 'not-started',
    cwd,
    permissions,
    commandPreview: [
      'opencode',
      'run',
      '--permission',
      JSON.stringify(permissions),
      '[REDACTED_PROMPT]',
    ],
    promptPreview: redactedPrompt.slice(0, 240),
    mutationAllowed: false,
    requiresExplicitExecution: true,
  };
}

export function createOpenCodeWorkflowAdapter(
  options: OpenCodeWorkflowAdapterOptions = {},
): ProviderAdapter {
  const metadata = getProviderMetadata('opencode');
  if (!metadata) {
    throw new Error('OpenCode provider metadata is missing.');
  }
  return new OpenCodeWorkflowAdapter(metadata, options);
}

class OpenCodeWorkflowAdapter implements ProviderAdapter {
  private readonly workspaceRoot?: string;
  private readonly knownSecrets: string[];

  constructor(
    public readonly metadata: ProviderMetadata,
    options: OpenCodeWorkflowAdapterOptions,
  ) {
    this.workspaceRoot = options.workspaceRoot ? normalizePath(options.workspaceRoot) : undefined;
    this.knownSecrets = options.knownSecrets ?? [];
  }

  async discoverCapabilities(): Promise<ProviderOperation[]> {
    return [...this.metadata.operations];
  }

  async listModels(): Promise<ProviderModelDescriptor[]> {
    return this.metadata.models.map(model => ({
      ...model,
      operations: [...model.operations],
    }));
  }

  async execute(
    request: ProviderAdapterRequest,
    options: ProviderAdapterExecuteOptions = {},
  ): Promise<ProviderAdapterResponse> {
    if (options.signal?.aborted) {
      return cancelledResponse(request);
    }
    if (request.operation !== 'code.assist') {
      return unsupportedResponse(request);
    }

    const input = request.input ?? {};
    if (booleanInput(input, 'execute') || booleanInput(input, 'executionApproved')) {
      return failedResponse(request, {
        kind: 'unsupported-operation',
        message: 'OpenCode workflow adapter only prepares controlled handoffs; it does not execute external tools.',
        retryGuidance: 'Run OpenCode outside this adapter only through an explicit user/agent execution path.',
      });
    }

    const prompt = request.prompt?.trim();
    if (!prompt) {
      return failedResponse(request, {
        kind: 'provider-error',
        message: 'OpenCode workflow handoff requires a prompt.',
        retryGuidance: 'Provide the developer-facing task as request.prompt.',
      });
    }

    const workspaceRoot = normalizePath(
      stringInput(input, 'workspaceRoot') ?? this.workspaceRoot ?? stringInput(input, 'cwd') ?? '',
    );
    const cwd = normalizePath(stringInput(input, 'cwd') ?? workspaceRoot);
    if (!workspaceRoot || !cwd || !isPathInside(workspaceRoot, cwd)) {
      return failedResponse(request, {
        kind: 'provider-error',
        message: `OpenCode cwd ${cwd || '(missing)'} is outside the configured workspace root.`,
        retryGuidance: 'Use a repo-local cwd under the configured workspace root.',
      });
    }

    const permissions = permissionsFromInput(input);
    if (isProviderFailure(permissions)) {
      return failedResponse(request, permissions);
    }

    const status = workflowStatus(input);
    const data = handoffData(status, cwd, permissions, request, this.knownSecrets);
    if (status === 'blocked' || status === 'failed') {
      const reason = safeText(
        stringInput(input, status === 'blocked' ? 'blockReason' : 'failureReason') ??
          (status === 'blocked' ? 'Workflow is blocked.' : 'Workflow failed.'),
        this.knownSecrets,
      );
      return failedResponse(request, {
        kind: 'provider-error',
        message: `OpenCode workflow ${status}: ${reason}`,
        retryGuidance: 'Resolve the reported workflow condition before retrying the handoff.',
      }, data);
    }

    return {
      ...responseBase(request),
      status: 'succeeded',
      output: {
        text: `OpenCode handoff prepared (${status}).`,
        data,
      },
      usage: {
        inputTokens: prompt.split(/\s+/).length,
        outputTokens: 0,
      },
    };
  }
}
