// JSON serialization helpers — guarantee valid JSON before write/export
import type { FullProjectState, ExportBundle } from './types';
import type { DatabaseEntries, ItemDatabase, MapData, ProjectData } from '../types/project';
import { mergeDatabases } from './defaultDatabases';
import { normalizeAssetCatalog } from './defaultAssetCatalog';
import { withNormalizedVisualProfile } from '../visual/visualProfile';
import { redactPortableSecrets } from '../utils/portableSecrets';

export const EXPORT_BUNDLE_SCHEMA_VERSION = 2 as const;
const LEGACY_EXPORT_BUNDLE_SCHEMA_VERSION = 1 as const;

export function safeStringify(value: unknown): string {
  // JSON.stringify never produces malformed JSON for plain values, but we round-trip
  // to confirm it parses back, so we never emit corrupt data.
  const text = JSON.stringify(value, null, 2);
  JSON.parse(text); // throws on invalid; lets caller surface error
  return text;
}

export function buildExportBundle(state: FullProjectState): ExportBundle {
  const bundle: ExportBundle = {
    schemaVersion: EXPORT_BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...(state.templateId ? { templateId: state.templateId } : {}),
    project: state.project,
    maps: state.maps,
    items: state.items,
    databases: state.databases,
    assets: normalizeAssetCatalog(state.assets),
    ...(state.dialogue ? { dialogue: state.dialogue } : {}),
  };
  return redactPortableSecrets(bundle);
}

export function parseImportBundle(input: string): FullProjectState {
  const parsed = redactPortableSecrets(JSON.parse(input));

  if (parsed && typeof parsed === 'object' && 'project' in parsed && 'maps' in parsed && 'items' in parsed) {
    const bundle = parsed as Record<string, unknown>;
    const rawVersion = bundle.schemaVersion;
    const version = rawVersion === undefined ? LEGACY_EXPORT_BUNDLE_SCHEMA_VERSION : rawVersion;
    if (
      typeof version !== 'number'
      || !Number.isInteger(version)
      || (version !== LEGACY_EXPORT_BUNDLE_SCHEMA_VERSION
        && version !== EXPORT_BUNDLE_SCHEMA_VERSION)
    ) {
      throw new Error(`Unsupported project bundle schema version: ${String(version)}`);
    }
    return validateBundleShape(bundle);
  }

  throw new Error('Imported JSON does not match expected project bundle shape');
}

function validateBundleShape(obj: Record<string, unknown>): FullProjectState {
  const project = obj.project as ProjectData | undefined;
  const maps = obj.maps as Record<string, MapData> | undefined;
  const items = obj.items as ItemDatabase | undefined;
  const databases = obj.databases as Partial<DatabaseEntries> | undefined;
  const assets = normalizeAssetCatalog(obj.assets);

  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    throw new Error('Imported bundle is missing valid project metadata');
  }
  if (!maps || typeof maps !== 'object' || Array.isArray(maps)) {
    throw new Error('Imported bundle is missing valid maps');
  }
  if (!items || typeof items !== 'object' || Array.isArray(items) || !Array.isArray(items.items)) {
    throw new Error('Imported bundle is missing valid items database');
  }

  return {
    ...(obj.templateId === 'blank' || obj.templateId === 'horror-bl'
      ? { templateId: obj.templateId }
      : {}),
    project: withNormalizedVisualProfile(project),
    maps,
    items,
    databases: mergeDatabases(databases),
    assets,
    ...(obj.dialogue && typeof obj.dialogue === 'object' && !Array.isArray(obj.dialogue)
      ? { dialogue: obj.dialogue as FullProjectState['dialogue'] }
      : {}),
  };
}
