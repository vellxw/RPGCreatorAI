import type { FullProjectState } from '../adapters/types';
import type { AssetCatalogEntry, DatabasePaths, ProjectData } from '../types/project';
import { isSensitivePortableKey } from '../utils/portableSecrets';
import {
  isExternalReference,
  isExternalReferenceField,
  isSafePortablePath,
  isUnsafePortableMetadataKey,
  normalizePortablePath,
  validateRuntimeAssetMetadata,
} from '../utils/packageSecurity';
import { validateVisualNovelContent } from '../dialogue/evaluator';
import {
  GAME_BUNDLE_SCHEMA_VERSION,
  type GameBundleV1,
} from './contracts';

export type GameBundleCompileIssueCode =
  | 'invalid-value'
  | 'secret-redacted'
  | 'unsafe-path'
  | 'asset-not-allowlisted'
  | 'asset-not-runtime-compatible'
  | 'unknown-asset'
  | 'external-reference'
  | 'secret-metadata'
  | 'unsafe-archive-entry'
  | 'unsafe-asset-metadata'
  | 'unsafe-metadata';

export interface GameBundleCompileIssue {
  code: GameBundleCompileIssueCode;
  path: string;
  message: string;
}

export interface GameBundleCompileOptions {
  /**
   * Asset ids approved for this bundle. When omitted, the catalog's
   * `runtimeCompatible: true` entries form the allowlist.
   */
  assetAllowlist?: readonly string[];
  /** Project-relative roots from which runtime asset files may be loaded. */
  allowedAssetRoots?: readonly string[];
}

export type GameBundleCompileResult =
  | {
      ok: true;
      bundle: GameBundleV1;
      errors: [];
      warnings: GameBundleCompileIssue[];
    }
  | {
      ok: false;
      bundle?: undefined;
      errors: GameBundleCompileIssue[];
      warnings: GameBundleCompileIssue[];
    };

const DEFAULT_ASSET_ROOTS = ['assets'] as const;
/** True only for paths that cannot escape the project directory. */
export function isSafeBundlePath(value: string): boolean {
  return isSafePortablePath(value);
}

/** Produces the canonical path spelling stored in a portable bundle. */
export function normalizeBundlePath(value: string): string {
  return normalizePortablePath(value);
}

function isUnderAllowedRoot(path: string, roots: readonly string[]): boolean {
  const normalized = normalizeBundlePath(path).toLowerCase();
  return roots.some(root => {
    const normalizedRoot = normalizeBundlePath(root).replace(/\/$/, '').toLowerCase();
    return normalizedRoot !== '' && (normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`));
  });
}

function validateAndNormalizePath(
  value: unknown,
  path: string,
  errors: GameBundleCompileIssue[],
): string | undefined {
  if (typeof value !== 'string' || !isSafeBundlePath(value)) {
    errors.push({
      code: 'unsafe-path',
      path,
      message: `Expected a safe project-relative path at ${path}.`,
    });
    return undefined;
  }
  return normalizeBundlePath(value);
}

function cloneSerializable<T>(
  value: T,
  errors: GameBundleCompileIssue[],
  warnings: GameBundleCompileIssue[],
  path = '$',
  ancestors = new Set<object>(),
): T {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      errors.push({ code: 'invalid-value', path, message: `Non-finite number at ${path}.` });
      return null as T;
    }
    return value;
  }
  if (typeof value !== 'object') {
    errors.push({ code: 'invalid-value', path, message: `Non-JSON value at ${path}.` });
    return null as T;
  }

  const objectValue = value as object;
  if (ancestors.has(objectValue)) {
    errors.push({ code: 'invalid-value', path, message: `Circular value at ${path}.` });
    return null as T;
  }
  ancestors.add(objectValue);

  if (Array.isArray(value)) {
    const clone = value.map((entry, index) =>
      cloneSerializable(entry, errors, warnings, `${path}[${index}]`, ancestors),
    ) as T;
    ancestors.delete(objectValue);
    return clone;
  }

  const clone: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const entryPath = `${path}.${key}`;
    if (isUnsafePortableMetadataKey(key)) {
      errors.push({
        code: 'unsafe-metadata',
        path: entryPath,
        message: `Archive, link, or prototype metadata is not allowed at ${entryPath}.`,
      });
      continue;
    }
    if (isSensitivePortableKey(key)) {
      warnings.push({
        code: 'secret-redacted',
        path: entryPath,
        message: `Sensitive field ${entryPath} was excluded from the runtime bundle.`,
      });
      continue;
    }
    if (isExternalReferenceField(key) && isExternalReference(entry)) {
      errors.push({
        code: 'external-reference',
        path: entryPath,
        message: `External runtime reference is not allowed at ${entryPath}.`,
      });
      continue;
    }
    if (entry === undefined) continue;
    clone[key] = cloneSerializable(entry, errors, warnings, entryPath, ancestors);
  }
  ancestors.delete(objectValue);
  return clone as T;
}

function compileProject(
  source: ProjectData,
  errors: GameBundleCompileIssue[],
  warnings: GameBundleCompileIssue[],
): ProjectData {
  const maps = source.maps.map((reference, index) => ({
    id: reference.id,
    path:
      validateAndNormalizePath(reference.path, `project.maps[${index}].path`, errors) ?? '',
    ...(reference.parentId !== undefined ? { parentId: reference.parentId } : {}),
    ...(reference.order !== undefined ? { order: reference.order } : {}),
    ...(reference.expanded !== undefined ? { expanded: reference.expanded } : {}),
  }));

  const database = {} as DatabasePaths;
  for (const [key, value] of Object.entries(source.database) as Array<
    [keyof DatabasePaths, string | undefined]
  >) {
    if (value === undefined) continue;
    const safePath = validateAndNormalizePath(value, `project.database.${key}`, errors);
    if (safePath !== undefined) database[key] = safePath;
  }

  const project: ProjectData = {
    schemaVersion: source.schemaVersion,
    title: source.title,
    startMapId: source.startMapId,
    startPosition: cloneSerializable(source.startPosition, errors, warnings, 'project.startPosition'),
    maps,
    database,
  };
  if (source.assetCatalog !== undefined) {
    project.assetCatalog =
      validateAndNormalizePath(source.assetCatalog, 'project.assetCatalog', errors) ?? '';
  }
  if (source.visualProfile !== undefined) {
    project.visualProfile = cloneSerializable(
      source.visualProfile,
      errors,
      warnings,
      'project.visualProfile',
    );
  }
  // generationHistory is editor/provider provenance and is deliberately not runtime data.
  return project;
}

function compileAsset(asset: AssetCatalogEntry, normalizedPath: string): AssetCatalogEntry {
  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    path: normalizedPath,
    source: asset.source,
    runtimeCompatible: true,
    ...(asset.width !== undefined ? { width: asset.width } : {}),
    ...(asset.height !== undefined ? { height: asset.height } : {}),
    ...(asset.frameWidth !== undefined ? { frameWidth: asset.frameWidth } : {}),
    ...(asset.frameHeight !== undefined ? { frameHeight: asset.frameHeight } : {}),
    ...(asset.frames !== undefined ? { frames: asset.frames } : {}),
    ...(asset.durationMs !== undefined ? { durationMs: asset.durationMs } : {}),
  };
}

function validateRuntimeDataPaths(
  state: FullProjectState,
  errors: GameBundleCompileIssue[],
): void {
  const validateRegistry = (registry: Record<string, string> | undefined, path: string) => {
    for (const [id, value] of Object.entries(registry ?? {})) {
      validateAndNormalizePath(value, `${path}.${id}`, errors);
    }
  };

  validateRegistry(state.databases.system.audio, 'databases.system.audio');
  validateRegistry(state.databases.audio?.audio, 'databases.audio.audio');
  for (const registryName of ['sounds', 'bgm'] as const) {
    for (const [index, entry] of (state.databases.audio?.[registryName] ?? []).entries()) {
      validateAndNormalizePath(
        entry.path,
        `databases.audio.${registryName}[${index}].path`,
        errors,
      );
    }
  }

  const visit = (value: unknown, path: string, ancestors: Set<object>): void => {
    if (!value || typeof value !== 'object') return;
    const objectValue = value as object;
    if (ancestors.has(objectValue)) return;
    ancestors.add(objectValue);
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`, ancestors));
    } else {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        const entryPath = `${path}.${key}`;
        if (key === 'path') validateAndNormalizePath(entry, entryPath, errors);
        else visit(entry, entryPath, ancestors);
      }
    }
    ancestors.delete(objectValue);
  };
  visit(state.maps, 'maps', new Set());
  visit(state.items, 'items', new Set());
}

/**
 * Compiles editor state into a local-only GameBundle v1. The operation does
 * not read files, contact providers, or mutate its input.
 */
export function compileGameBundleV1(
  state: FullProjectState,
  options: GameBundleCompileOptions = {},
): GameBundleCompileResult {
  const errors: GameBundleCompileIssue[] = [];
  const warnings: GameBundleCompileIssue[] = [];
  const roots = options.allowedAssetRoots ?? DEFAULT_ASSET_ROOTS;

  const explicitAllowlist = options.assetAllowlist
    ? new Set(options.assetAllowlist)
    : undefined;
  const catalog = state.assets;
  const seenAssetIds = new Set<string>();
  const compiledAssets: AssetCatalogEntry[] = [];

  validateRuntimeDataPaths(state, errors);

  for (const [index, asset] of (catalog?.assets ?? []).entries()) {
    const assetPath = `assets.assets[${index}]`;
    if (seenAssetIds.has(asset.id)) {
      errors.push({
        code: 'invalid-value',
        path: `${assetPath}.id`,
        message: `Duplicate asset id "${asset.id}".`,
      });
      continue;
    }
    seenAssetIds.add(asset.id);

    const allowlisted = explicitAllowlist
      ? explicitAllowlist.has(asset.id)
      : asset.runtimeCompatible === true;
    if (!allowlisted) {
      warnings.push({
        code: 'asset-not-allowlisted',
        path: assetPath,
        message: `Asset "${asset.id}" was not included in the runtime allowlist.`,
      });
      continue;
    }
    if (asset.runtimeCompatible !== true) {
      errors.push({
        code: 'asset-not-runtime-compatible',
        path: assetPath,
        message: `Allowlisted asset "${asset.id}" is not marked runtime compatible.`,
      });
      continue;
    }
    const metadataIssues = validateRuntimeAssetMetadata(
      asset as unknown as Record<string, unknown>,
      assetPath,
      roots,
    );
    if (metadataIssues.length > 0) {
      errors.push(...metadataIssues);
      continue;
    }
    const normalizedPath = validateAndNormalizePath(asset.path, `${assetPath}.path`, errors);
    if (normalizedPath === undefined) continue;
    if (!isUnderAllowedRoot(normalizedPath, roots)) {
      errors.push({
        code: 'unsafe-path',
        path: `${assetPath}.path`,
        message: `Asset "${asset.id}" is outside the allowed asset roots.`,
      });
      continue;
    }
    compiledAssets.push(compileAsset(asset, normalizedPath));
  }

  if (explicitAllowlist) {
    for (const id of explicitAllowlist) {
      if (!seenAssetIds.has(id)) {
        errors.push({
          code: 'unknown-asset',
          path: 'options.assetAllowlist',
          message: `Allowlisted asset "${id}" does not exist in the catalog.`,
        });
      }
    }
  }

  const bundle: GameBundleV1 = {
    schemaVersion: GAME_BUNDLE_SCHEMA_VERSION,
    project: compileProject(state.project, errors, warnings),
    maps: cloneSerializable(state.maps, errors, warnings, 'maps'),
    items: cloneSerializable(state.items, errors, warnings, 'items'),
    databases: cloneSerializable(state.databases, errors, warnings, 'databases'),
    ...(catalog
      ? { assets: { schemaVersion: catalog.schemaVersion, assets: compiledAssets } }
      : {}),
    ...(state.dialogue
      ? { dialogue: cloneSerializable(state.dialogue, errors, warnings, 'dialogue') }
      : {}),
  };

  if (state.dialogue) {
    for (const issue of validateVisualNovelContent(state.dialogue)) {
      errors.push({
        code: 'invalid-value',
        path: `dialogue.${issue.path}`,
        message: issue.message,
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  // Assert the DTO can cross a JSON/process boundary before returning it.
  try {
    JSON.parse(JSON.stringify(bundle));
  } catch (error) {
    return {
      ok: false,
      errors: [{
        code: 'invalid-value',
        path: '$',
        message: `Game bundle is not JSON serializable: ${error instanceof Error ? error.message : String(error)}`,
      }],
      warnings,
    };
  }
  return { ok: true, bundle, errors: [], warnings };
}

export function serializeGameBundleV1(bundle: GameBundleV1): string {
  return JSON.stringify(bundle, null, 2);
}
