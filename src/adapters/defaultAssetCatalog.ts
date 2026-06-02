import type { AssetCatalogData, AssetCatalogEntry, AssetKind, AssetSource } from '../types/project';

export const EMPTY_ASSET_CATALOG: AssetCatalogData = {
  schemaVersion: 1,
  assets: [],
};

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeEntry(value: unknown): AssetCatalogEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kind = typeof record.kind === 'string' ? (record.kind as AssetKind) : 'image';
  const source = typeof record.source === 'string' ? (record.source as AssetSource) : 'local';

  return {
    id: typeof record.id === 'string' ? record.id : '',
    name: typeof record.name === 'string' ? record.name : '',
    kind,
    path: typeof record.path === 'string' ? record.path : '',
    source,
    tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
    provenance: typeof record.provenance === 'string' ? record.provenance : undefined,
    runtimeCompatible: typeof record.runtimeCompatible === 'boolean' ? record.runtimeCompatible : undefined,
    runtimeNotes: typeof record.runtimeNotes === 'string' ? record.runtimeNotes : undefined,
    notes: typeof record.notes === 'string' ? record.notes : undefined,
    protected: typeof record.protected === 'boolean' ? record.protected : undefined,
    width: asNumber(record.width),
    height: asNumber(record.height),
    frameWidth: asNumber(record.frameWidth),
    frameHeight: asNumber(record.frameHeight),
    frames: asNumber(record.frames),
    durationMs: asNumber(record.durationMs),
    generated:
      record.generated && typeof record.generated === 'object' && !Array.isArray(record.generated)
        ? (record.generated as AssetCatalogEntry['generated'])
        : undefined,
  };
}

export function normalizeAssetCatalog(input: unknown): AssetCatalogData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...EMPTY_ASSET_CATALOG, assets: [] };
  }
  const record = input as Record<string, unknown>;
  const assets = Array.isArray(record.assets)
    ? record.assets.map(normalizeEntry).filter((asset): asset is AssetCatalogEntry => asset !== null)
    : [];
  return {
    schemaVersion:
      typeof record.schemaVersion === 'number' && Number.isFinite(record.schemaVersion)
        ? record.schemaVersion
        : 1,
    assets,
  };
}
