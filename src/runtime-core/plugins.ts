export const PLUGIN_MANIFEST_SCHEMA_VERSION = 1 as const;

export const PLUGIN_PERMISSIONS = [
  'runtime.state.read',
  'runtime.state.write',
  'runtime.input.read',
  'runtime.events.emit',
  'runtime.audio.play',
  'runtime.storage.read',
  'runtime.storage.write',
] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export interface PluginManifestV1 {
  schemaVersion: typeof PLUGIN_MANIFEST_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  entry: string;
  description?: string;
  permissions: readonly PluginPermission[];
  optionalPermissions?: readonly PluginPermission[];
}

export type PluginManifest = PluginManifestV1;

/** Host-owned allowlist. Absence of a grant means no permissions. */
export interface PluginPermissionGrant {
  pluginId: string;
  permissions: readonly PluginPermission[];
}

export interface ResolvedPluginPermissions {
  pluginId: string;
  allowed: ReadonlySet<PluginPermission>;
  deniedRequired: readonly PluginPermission[];
  deniedOptional: readonly PluginPermission[];
  canActivate: boolean;
}

export function validatePluginManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['Manifest must be an object.'];
  if (value.schemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PLUGIN_MANIFEST_SCHEMA_VERSION}.`);
  }
  if (typeof value.id !== 'string' || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value.id)) {
    errors.push('id must use lowercase letters, numbers, dots, underscores, or hyphens.');
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) errors.push('name is required.');
  if (typeof value.version !== 'string' || value.version.trim().length === 0) errors.push('version is required.');
  if (typeof value.entry !== 'string' || !isSafeRelativePath(value.entry)) {
    errors.push('entry must be a safe relative path.');
  }
  validatePermissionList(value.permissions, 'permissions', errors);
  if (value.optionalPermissions !== undefined) {
    validatePermissionList(value.optionalPermissions, 'optionalPermissions', errors);
  }
  return errors;
}

export function resolvePluginPermissions(
  manifest: PluginManifestV1,
  grant?: PluginPermissionGrant,
): ResolvedPluginPermissions {
  const granted = grant?.pluginId === manifest.id ? new Set(grant.permissions) : new Set<PluginPermission>();
  const required = new Set(manifest.permissions);
  const optional = new Set(manifest.optionalPermissions ?? []);
  const allowed = new Set<PluginPermission>();

  for (const permission of [...required, ...optional]) {
    if (granted.has(permission)) allowed.add(permission);
  }
  const deniedRequired = [...required].filter(permission => !allowed.has(permission));
  const deniedOptional = [...optional].filter(permission => !allowed.has(permission));
  return {
    pluginId: manifest.id,
    allowed,
    deniedRequired,
    deniedOptional,
    canActivate: deniedRequired.length === 0,
  };
}

export function hasPluginPermission(
  resolved: ResolvedPluginPermissions,
  permission: PluginPermission,
): boolean {
  return resolved.allowed.has(permission);
}

function validatePermissionList(value: unknown, field: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array.`);
    return;
  }
  const known = new Set<string>(PLUGIN_PERMISSIONS);
  const seen = new Set<string>();
  for (const permission of value) {
    if (typeof permission !== 'string' || !known.has(permission)) {
      errors.push(`${field} contains an unknown permission: ${String(permission)}.`);
    } else if (seen.has(permission)) {
      errors.push(`${field} contains a duplicate permission: ${permission}.`);
    }
    if (typeof permission === 'string') seen.add(permission);
  }
}

function isSafeRelativePath(path: string): boolean {
  if (path.length === 0 || path.startsWith('/') || path.startsWith('\\')) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  if (/[<>:"|?*\0]/.test(path)) return false;
  return !path.split(/[\\/]+/).some(segment => segment === '..' || segment === '.' || segment.length === 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
