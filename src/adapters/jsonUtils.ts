// JSON serialization helpers — guarantee valid JSON before write/export
import type { FullProjectState, ExportBundle } from './types';
import type { DatabaseEntries, ItemDatabase, MapData, ProjectData } from '../types/project';
import { mergeDatabases } from './defaultDatabases';
import { normalizeAssetCatalog } from './defaultAssetCatalog';
import { withNormalizedVisualProfile } from '../visual/visualProfile';

export function safeStringify(value: unknown): string {
  // JSON.stringify never produces malformed JSON for plain values, but we round-trip
  // to confirm it parses back, so we never emit corrupt data.
  const text = JSON.stringify(value, null, 2);
  JSON.parse(text); // throws on invalid; lets caller surface error
  return text;
}

export function buildExportBundle(state: FullProjectState): ExportBundle {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    project: state.project,
    maps: state.maps,
    items: state.items,
    databases: state.databases,
    assets: normalizeAssetCatalog(state.assets),
  };
}

export function parseImportBundle(input: string): FullProjectState {
  const parsed = JSON.parse(input);

  if (parsed && typeof parsed === 'object' && 'project' in parsed && 'maps' in parsed && 'items' in parsed) {
    return validateBundleShape(parsed as Record<string, unknown>);
  }

  throw new Error('Imported JSON does not match expected project bundle shape');
}

function validateBundleShape(obj: Record<string, unknown>): FullProjectState {
  const project = obj.project as ProjectData | undefined;
  const maps = obj.maps as Record<string, MapData> | undefined;
  const items = obj.items as ItemDatabase | undefined;
  const databases = obj.databases as Partial<DatabaseEntries> | undefined;
  const assets = normalizeAssetCatalog(obj.assets);

  if (!project || typeof project !== 'object') {
    throw new Error('Imported bundle is missing valid project metadata');
  }
  if (!maps || typeof maps !== 'object') {
    throw new Error('Imported bundle is missing valid maps');
  }
  if (!items || typeof items !== 'object' || !Array.isArray(items.items)) {
    throw new Error('Imported bundle is missing valid items database');
  }

  return {
    project: withNormalizedVisualProfile(project),
    maps,
    items,
    databases: mergeDatabases(databases),
    assets,
  };
}
