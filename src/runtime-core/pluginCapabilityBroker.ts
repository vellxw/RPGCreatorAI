import {
  PLUGIN_PERMISSIONS,
  resolvePluginPermissions,
  validatePluginManifest,
  type PluginManifestV1,
  type PluginPermission,
  type PluginPermissionGrant,
} from './plugins';

/**
 * The broker is deliberately data-only. It never imports `manifest.entry`,
 * evaluates source, accepts executable callbacks, or dispatches host APIs.
 * A host may act on an `allowed` decision only through its own fixed handler
 * table.
 */

export const DEFAULT_PLUGIN_SANDBOX_LIMITS = Object.freeze({
  maxManifestBytes: 16 * 1024,
  maxRequiredPermissions: PLUGIN_PERMISSIONS.length,
  maxOptionalPermissions: PLUGIN_PERMISSIONS.length,
  maxRequestsPerSession: 1024,
  maxRequestPayloadBytes: 64 * 1024,
  maxSessionPayloadBytes: 1024 * 1024,
  maxDeniedRequestsBeforeQuarantine: 3,
});

export interface PluginSandboxLimits {
  maxManifestBytes: number;
  maxRequiredPermissions: number;
  maxOptionalPermissions: number;
  maxRequestsPerSession: number;
  maxRequestPayloadBytes: number;
  maxSessionPayloadBytes: number;
  maxDeniedRequestsBeforeQuarantine: number;
}

export type PluginQuarantineCode =
  | 'invalid-manifest'
  | 'manifest-size-limit'
  | 'required-permission-limit'
  | 'optional-permission-limit'
  | 'required-permission-denied'
  | 'host-quarantine'
  | 'plugin-id-mismatch'
  | 'unknown-permission'
  | 'request-limit'
  | 'invalid-payload-size'
  | 'request-payload-limit'
  | 'session-payload-limit'
  | 'denial-limit';

export interface PluginQuarantineReason {
  code: PluginQuarantineCode;
  message: string;
}

export interface PluginSandboxPermissions {
  allowed: readonly PluginPermission[];
  deniedRequired: readonly PluginPermission[];
  deniedOptional: readonly PluginPermission[];
  canActivate: boolean;
}

export interface PluginSandboxUsage {
  requestCount: number;
  deniedRequestCount: number;
  acceptedPayloadBytes: number;
}

export interface PluginSandboxState {
  pluginId: string | null;
  manifest: Readonly<PluginManifestV1> | null;
  manifestBytes: number;
  permissions: Readonly<PluginSandboxPermissions> | null;
  status: 'ready' | 'quarantined';
  limits: Readonly<PluginSandboxLimits>;
  usage: Readonly<PluginSandboxUsage>;
  quarantineReasons: readonly Readonly<PluginQuarantineReason>[];
}

export interface AssessPluginManifestOptions {
  grant?: PluginPermissionGrant;
  limits?: Partial<PluginSandboxLimits>;
  /** Host-owned review or policy decision. It cannot be set by the plugin. */
  quarantineReason?: string;
}

export interface PluginCapabilityRequest {
  pluginId: string;
  /** Kept as string so untyped boundary data can fail closed at runtime. */
  permission: PluginPermission | string;
  /** Calculated by the host from raw bytes; the broker never inspects payload objects. */
  payloadBytes?: number;
}

export type PluginCapabilityDecisionCode =
  | 'allowed'
  | 'plugin-quarantined'
  | 'plugin-id-mismatch'
  | 'unknown-permission'
  | 'request-limit-exceeded'
  | 'invalid-payload-size'
  | 'request-payload-limit-exceeded'
  | 'session-payload-limit-exceeded'
  | 'permission-denied'
  | 'denial-limit-exceeded';

export interface PluginCapabilityDecision {
  allowed: boolean;
  code: PluginCapabilityDecisionCode;
  reason: string;
  state: PluginSandboxState;
}

const MANIFEST_FIELDS = new Set([
  'schemaVersion',
  'id',
  'name',
  'version',
  'entry',
  'description',
  'permissions',
  'optionalPermissions',
]);

const KNOWN_PERMISSIONS = new Set<string>(PLUGIN_PERMISSIONS);

/**
 * Validates and snapshots a JSON manifest, resolves an explicit host grant,
 * applies limits, and starts unsafe/incomplete plugins in quarantine.
 */
export function assessPluginManifest(
  value: unknown,
  options: AssessPluginManifestOptions = {},
): PluginSandboxState {
  const limits = resolveSandboxLimits(options.limits);
  const errors = validatePluginManifest(value);
  const record = isRecord(value) ? value : null;

  if (record) {
    if (record.description !== undefined && typeof record.description !== 'string') {
      errors.push('description must be a string when provided.');
    }

    for (const field of Object.keys(record).sort()) {
      if (!MANIFEST_FIELDS.has(field)) errors.push(`Manifest contains an unsupported field: ${field}.`);
    }

    if (Array.isArray(record.permissions) && Array.isArray(record.optionalPermissions)) {
      const required = new Set(record.permissions.filter(isString));
      const overlap = record.optionalPermissions.filter(isString).filter(permission => required.has(permission));
      for (const permission of [...new Set(overlap)].sort()) {
        errors.push(`Permission cannot be both required and optional: ${permission}.`);
      }
    }
  }

  if (errors.length > 0 || !record) {
    return createState({
      pluginId: safeCandidateId(record?.id),
      manifest: null,
      manifestBytes: 0,
      permissions: null,
      status: 'quarantined',
      limits,
      usage: emptyUsage(),
      quarantineReasons: errors.map(message => reason('invalid-manifest', message)),
    });
  }

  const manifest = snapshotManifest(record);
  const manifestBytes = utf8ByteLength(JSON.stringify(manifest) ?? '');
  const resolved = resolvePluginPermissions(manifest, options.grant);
  const permissions = Object.freeze({
    allowed: Object.freeze([...resolved.allowed]),
    deniedRequired: Object.freeze([...resolved.deniedRequired]),
    deniedOptional: Object.freeze([...resolved.deniedOptional]),
    canActivate: resolved.canActivate,
  });
  const quarantineReasons: PluginQuarantineReason[] = [];

  if (manifestBytes > limits.maxManifestBytes) {
    quarantineReasons.push(reason(
      'manifest-size-limit',
      `Manifest uses ${manifestBytes} bytes; limit is ${limits.maxManifestBytes}.`,
    ));
  }
  if (manifest.permissions.length > limits.maxRequiredPermissions) {
    quarantineReasons.push(reason(
      'required-permission-limit',
      `Manifest declares ${manifest.permissions.length} required permissions; limit is ${limits.maxRequiredPermissions}.`,
    ));
  }
  if ((manifest.optionalPermissions?.length ?? 0) > limits.maxOptionalPermissions) {
    quarantineReasons.push(reason(
      'optional-permission-limit',
      `Manifest declares ${manifest.optionalPermissions?.length ?? 0} optional permissions; limit is ${limits.maxOptionalPermissions}.`,
    ));
  }
  if (permissions.deniedRequired.length > 0) {
    quarantineReasons.push(reason(
      'required-permission-denied',
      `Required permissions are not granted: ${permissions.deniedRequired.join(', ')}.`,
    ));
  }
  if (options.quarantineReason?.trim()) {
    quarantineReasons.push(reason('host-quarantine', options.quarantineReason.trim()));
  }

  return createState({
    pluginId: manifest.id,
    manifest,
    manifestBytes,
    permissions,
    status: quarantineReasons.length === 0 ? 'ready' : 'quarantined',
    limits,
    usage: emptyUsage(),
    quarantineReasons,
  });
}

/**
 * Pure authorization step. The returned decision is only a capability token;
 * it does not execute a plugin or invoke the corresponding host capability.
 */
export function authorizePluginCapability(
  state: PluginSandboxState,
  request: PluginCapabilityRequest,
): PluginCapabilityDecision {
  const permission = request.permission;

  if (state.status === 'quarantined') {
    return decision(false, 'plugin-quarantined', 'Plugin is quarantined.', state);
  }

  if (request.pluginId !== state.pluginId) {
    const quarantined = quarantinePlugin(
      state,
      reason('plugin-id-mismatch', `Request plugin id ${request.pluginId} does not match ${state.pluginId}.`),
    );
    return decision(false, 'plugin-id-mismatch', 'Plugin id does not match the sandbox.', quarantined);
  }

  if (!isPluginPermission(permission)) {
    const quarantined = quarantinePlugin(
      state,
      reason('unknown-permission', `Unknown permission requested: ${String(permission)}.`),
    );
    return decision(false, 'unknown-permission', 'Unknown permissions fail closed.', quarantined);
  }

  if (state.usage.requestCount >= state.limits.maxRequestsPerSession) {
    const quarantined = quarantinePlugin(
      state,
      reason('request-limit', `Session request limit ${state.limits.maxRequestsPerSession} was reached.`),
    );
    return decision(false, 'request-limit-exceeded', 'Plugin request limit was reached.', quarantined);
  }

  const payloadBytes = request.payloadBytes ?? 0;
  if (!Number.isSafeInteger(payloadBytes) || payloadBytes < 0) {
    const quarantined = quarantinePlugin(
      state,
      reason('invalid-payload-size', 'Request payload size must be a non-negative safe integer.'),
    );
    return decision(false, 'invalid-payload-size', 'Invalid request payload size.', quarantined);
  }
  if (payloadBytes > state.limits.maxRequestPayloadBytes) {
    const quarantined = quarantinePlugin(
      state,
      reason(
        'request-payload-limit',
        `Request payload uses ${payloadBytes} bytes; limit is ${state.limits.maxRequestPayloadBytes}.`,
      ),
    );
    return decision(false, 'request-payload-limit-exceeded', 'Request payload limit was exceeded.', quarantined);
  }

  if (!state.permissions?.allowed.includes(permission)) {
    const usage = Object.freeze({
      ...state.usage,
      requestCount: state.usage.requestCount + 1,
      deniedRequestCount: state.usage.deniedRequestCount + 1,
    });
    const deniedState = createState({ ...state, usage });
    if (usage.deniedRequestCount >= state.limits.maxDeniedRequestsBeforeQuarantine) {
      const quarantined = quarantinePlugin(
        deniedState,
        reason(
          'denial-limit',
          `Denied request limit ${state.limits.maxDeniedRequestsBeforeQuarantine} was reached.`,
        ),
      );
      return decision(false, 'denial-limit-exceeded', 'Repeated denied requests quarantined the plugin.', quarantined);
    }
    return decision(false, 'permission-denied', 'Permission was not explicitly granted.', deniedState);
  }

  const nextPayloadTotal = state.usage.acceptedPayloadBytes + payloadBytes;
  if (nextPayloadTotal > state.limits.maxSessionPayloadBytes) {
    const quarantined = quarantinePlugin(
      state,
      reason(
        'session-payload-limit',
        `Accepted payload total would be ${nextPayloadTotal} bytes; limit is ${state.limits.maxSessionPayloadBytes}.`,
      ),
    );
    return decision(false, 'session-payload-limit-exceeded', 'Session payload limit was exceeded.', quarantined);
  }

  const nextState = createState({
    ...state,
    usage: Object.freeze({
      ...state.usage,
      requestCount: state.usage.requestCount + 1,
      acceptedPayloadBytes: nextPayloadTotal,
    }),
  });
  return decision(true, 'allowed', 'Permission is explicitly granted.', nextState);
}

/** Quarantine is monotonic. Reassessment after host review creates a new state. */
export function quarantinePlugin(
  state: PluginSandboxState,
  quarantineReason: PluginQuarantineReason,
): PluginSandboxState {
  const exists = state.quarantineReasons.some(existing =>
    existing.code === quarantineReason.code && existing.message === quarantineReason.message,
  );
  return createState({
    ...state,
    status: 'quarantined',
    quarantineReasons: exists
      ? state.quarantineReasons
      : [...state.quarantineReasons, reason(quarantineReason.code, quarantineReason.message)],
  });
}

export function resolveSandboxLimits(
  overrides: Partial<PluginSandboxLimits> = {},
): Readonly<PluginSandboxLimits> {
  const limits: PluginSandboxLimits = {
    ...DEFAULT_PLUGIN_SANDBOX_LIMITS,
    ...overrides,
  };
  for (const [key, value] of Object.entries(limits)) {
    const minimum = key === 'maxDeniedRequestsBeforeQuarantine' ? 1 : 0;
    if (!Number.isSafeInteger(value) || value < minimum) {
      throw new RangeError(`${key} must be a safe integer greater than or equal to ${minimum}.`);
    }
  }
  return Object.freeze(limits);
}

function snapshotManifest(record: Record<string, unknown>): Readonly<PluginManifestV1> {
  const manifest: PluginManifestV1 = {
    schemaVersion: 1,
    id: record.id as string,
    name: (record.name as string).trim(),
    version: (record.version as string).trim(),
    entry: record.entry as string,
    permissions: Object.freeze([...(record.permissions as PluginPermission[])]),
    ...(typeof record.description === 'string' ? { description: record.description } : {}),
    ...(Array.isArray(record.optionalPermissions)
      ? { optionalPermissions: Object.freeze([...(record.optionalPermissions as PluginPermission[])]) }
      : {}),
  };
  return Object.freeze(manifest);
}

function createState(state: PluginSandboxState): PluginSandboxState {
  return Object.freeze({
    ...state,
    limits: Object.freeze({ ...state.limits }),
    usage: Object.freeze({ ...state.usage }),
    quarantineReasons: Object.freeze(state.quarantineReasons.map(item => reason(item.code, item.message))),
  });
}

function emptyUsage(): Readonly<PluginSandboxUsage> {
  return Object.freeze({ requestCount: 0, deniedRequestCount: 0, acceptedPayloadBytes: 0 });
}

function reason(code: PluginQuarantineCode, message: string): Readonly<PluginQuarantineReason> {
  return Object.freeze({ code, message });
}

function decision(
  allowed: boolean,
  code: PluginCapabilityDecisionCode,
  reasonText: string,
  state: PluginSandboxState,
): PluginCapabilityDecision {
  return Object.freeze({ allowed, code, reason: reasonText, state });
}

function isPluginPermission(value: string): value is PluginPermission {
  return KNOWN_PERMISSIONS.has(value);
}

function safeCandidateId(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)
    ? value
    : null;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
