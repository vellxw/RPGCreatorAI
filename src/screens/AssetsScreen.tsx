import { useMemo, useState, type ReactNode } from 'react';
import { Box, Grid2X2, Image, Music, Search, Sparkles, Upload } from 'lucide-react';
import { gameAssets } from '../assets/generated/assetCatalog';
import { Input, Select } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { ImageEditVariationPanel } from '../components/assets/ImageEditVariationPanel';
import { useProjectStore, type AssetCatalogMetadataChanges } from '../stores/projectStore';
import { mergeAudioRegistry } from '../audio/audioRegistry';
import { importAudioAsset, type AudioImportRunner } from '../adapters/audioImport';
import { importImageAsset, type ImageImportRunner } from '../adapters/assetImport';
import type { AudioImportUsage } from '../adapters/types';
import type { AssetCatalogEntry, AssetKind, AssetSource } from '../types/project';
import type {
  ImageEditVariationCapability,
  ImageEditVariationRunner,
} from '../providers/imageEditVariationWorkflow';
import { findReferences } from '../validation/referenceIndex';

const KIND_OPTIONS: Array<{ value: AssetKind | 'all'; label: string }> = [
  { value: 'all', label: 'All kinds' },
  { value: 'image', label: 'Images' },
  { value: 'spritesheet', label: 'Spritesheets' },
  { value: 'tileset', label: 'Tilesets' },
  { value: 'audio', label: 'Audio' },
  { value: 'generated', label: 'Generated' },
];

const SOURCE_OPTIONS: Array<{ value: AssetSource; label: string }> = [
  { value: 'local', label: 'Local' },
  { value: 'generated', label: 'Generated' },
  { value: 'imported', label: 'Imported' },
];

const RUNTIME_COMPATIBILITY_OPTIONS = [
  { value: 'unset', label: 'Not checked' },
  { value: 'true', label: 'Runtime compatible' },
  { value: 'false', label: 'Not runtime compatible' },
];

const PREVIEW_BY_PATH: Record<string, string> = {
  'assets/generated/web/player_adventurer.png': gameAssets.player,
  'assets/generated/web/npc_shopkeeper.png': gameAssets.shopkeeper,
  'assets/generated/web/tile_tree.png': gameAssets.tree,
  'assets/generated/web/tile_grass.png': gameAssets.grass,
};

function iconForKind(kind: AssetKind) {
  switch (kind) {
    case 'audio':
      return <Music size={16} />;
    case 'tileset':
      return <Grid2X2 size={16} />;
    case 'generated':
      return <Sparkles size={16} />;
    case 'spritesheet':
      return <Box size={16} />;
    case 'image':
    default:
      return <Image size={16} />;
  }
}

function kindLabel(kind: AssetKind): string {
  return kind === 'spritesheet' ? 'Sprite Sheet' : kind[0].toUpperCase() + kind.slice(1);
}

function sourceLabel(source: AssetSource): string {
  return SOURCE_OPTIONS.find(option => option.value === source)?.label ?? source;
}

function matchesAsset(asset: AssetCatalogEntry, query: string, kind: AssetKind | 'all'): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (kind !== 'all' && asset.kind !== kind) return false;
  if (!normalizedQuery) return true;
  const haystack = [
    asset.id,
    asset.name,
    asset.kind,
    asset.source,
    asset.path,
    asset.provenance ?? '',
    asset.runtimeNotes ?? '',
    asset.notes ?? '',
    asset.protected ? 'protected' : '',
    ...(asset.tags ?? []),
  ].join(' ').toLowerCase();
  return haystack.includes(normalizedQuery);
}

function dimensions(asset: AssetCatalogEntry): string | null {
  if (asset.width && asset.height) return `${asset.width} x ${asset.height}`;
  if (asset.frameWidth && asset.frameHeight) return `${asset.frameWidth} x ${asset.frameHeight}`;
  return null;
}

function Preview({ asset }: { asset: AssetCatalogEntry }) {
  const src = PREVIEW_BY_PATH[asset.path];
  if (src) {
    return (
      <div className="h-44 bg-neutral-100 border border-gray-200 rounded-md flex items-center justify-center overflow-hidden">
        <img src={src} alt="" className="max-h-full max-w-full object-contain image-render-pixel" />
      </div>
    );
  }

  return (
    <div className="h-44 bg-neutral-100 border border-gray-200 rounded-md flex items-center justify-center text-gray-400">
      {iconForKind(asset.kind)}
    </div>
  );
}

function parseTagList(value: string): string[] {
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function runtimeCompatibilityValue(asset: AssetCatalogEntry): string {
  if (asset.runtimeCompatible === undefined) return 'unset';
  return asset.runtimeCompatible ? 'true' : 'false';
}

function runtimeCompatibilityFromValue(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function DetailRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <dt className="text-[12px] font-medium text-gray-500">{label}</dt>
      <dd className="text-[12px] text-gray-800 min-w-0 break-words">{value}</dd>
    </div>
  );
}

function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600">
      {children}
    </span>
  );
}

interface AssetsScreenProps {
  imageImporter?: ImageImportRunner;
  audioImporter?: AudioImportRunner;
  imageEditRunner?: ImageEditVariationRunner;
  imageEditCapability?: ImageEditVariationCapability;
}

export function AssetsScreen({
  imageImporter = importImageAsset,
  audioImporter = importAudioAsset,
  imageEditRunner,
  imageEditCapability,
}: AssetsScreenProps) {
  const { state, dispatch } = useProjectStore();
  const catalog = state.assets;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AssetKind | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [audioUsage, setAudioUsage] = useState<AudioImportUsage>('sfx');
  const [importStatus, setImportStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const filteredAssets = useMemo(
    () => catalog.assets.filter(asset => matchesAsset(asset, query, kind)),
    [catalog.assets, kind, query],
  );
  const selected = filteredAssets.find(asset => asset.id === selectedId) ?? filteredAssets[0] ?? null;
  const selectedReferences = useMemo(() => {
    if (!selected) return [];
    return findReferences(
      {
        project: state.project,
        maps: state.maps,
        items: state.items,
        databases: state.databases,
        assets: state.assets,
      },
      { table: 'assets', id: selected.id },
    );
  }, [selected, state.assets, state.databases, state.items, state.maps, state.project]);

  const updateSelectedMetadata = (changes: AssetCatalogMetadataChanges) => {
    if (!selected) return;
    dispatch({ type: 'UPDATE_ASSET_CATALOG_METADATA', id: selected.id, changes });
  };

  const handleImportImage = async () => {
    setImporting(true);
    setImportStatus(null);
    try {
      const result = await imageImporter(catalog.assets.map(asset => asset.id));
      if (result.cancelled) return;
      if (!result.success || !result.asset) {
        setImportStatus({ tone: 'error', text: result.error ?? 'Image import failed.' });
        return;
      }
      dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset: result.asset });
      setSelectedId(result.asset.id);
      setImportStatus({ tone: 'success', text: `Imported ${result.asset.name}` });
    } catch (error) {
      setImportStatus({ tone: 'error', text: (error as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const handleImportAudio = async () => {
    setImporting(true);
    setImportStatus(null);
    try {
      const existingIds = Array.from(
        new Set([
          ...catalog.assets.map(asset => asset.id),
          ...Object.keys(mergeAudioRegistry(state.databases.system.audio)),
        ]),
      );
      const result = await audioImporter(existingIds, { usage: audioUsage });
      if (result.cancelled) return;
      if (!result.success || !result.asset) {
        setImportStatus({ tone: 'error', text: result.error ?? 'Audio import failed.' });
        return;
      }
      dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset: result.asset });
      dispatch({
        type: 'UPDATE_SYSTEM_DATA',
        changes: {
          audio: {
            ...(state.databases.system.audio ?? {}),
            [result.asset.id]: result.asset.path,
          },
        },
      });
      setSelectedId(result.asset.id);
      setImportStatus({ tone: 'success', text: `Imported audio ${result.asset.name}` });
    } catch (error) {
      setImportStatus({ tone: 'error', text: (error as Error).message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="min-w-[220px]">
          <h1 className="text-[16px] font-semibold text-gray-900">Assets</h1>
          <p className="text-[12px] text-gray-500">
            {catalog.assets.length} cataloged asset{catalog.assets.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex-1 min-w-[260px] flex items-end gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-[31px] text-gray-400" />
            <Input
              label="Filter"
              aria-label="Filter assets"
              value={query}
              onInput={event => setQuery(event.currentTarget.value)}
              className="pl-8"
            />
          </div>
          <Select
            label="Kind"
            value={kind}
            options={KIND_OPTIONS}
            onChange={value => setKind(value as AssetKind | 'all')}
            ariaLabel="Filter asset kind"
          />
          <Button
            icon={<Upload size={14} />}
            onClick={handleImportImage}
            disabled={importing}
            title={importing ? 'Image import is already running' : 'Import a project-owned image asset'}
          >
            Import Image
          </Button>
          <Select
            label="Audio usage"
            value={audioUsage}
            options={[
              { value: 'sfx', label: 'SFX' },
              { value: 'bgm', label: 'BGM' },
            ]}
            onChange={value => setAudioUsage(value as AudioImportUsage)}
            ariaLabel="Audio usage"
          />
          <Button
            icon={<Music size={14} />}
            onClick={handleImportAudio}
            disabled={importing}
            title={importing ? 'Audio import is already running' : 'Import a project-owned WAV audio asset'}
          >
            Import Audio
          </Button>
        </div>
        {importStatus && (
          <div
            className={`w-full rounded-md border px-3 py-2 text-[12px] ${
              importStatus.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {importStatus.text}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-[320px] flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50">
          {filteredAssets.length === 0 ? (
            <div className="p-3">
              <EmptyState
                compact
                title="No assets match"
                detail="The current filter does not match any catalog entries."
              />
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredAssets.map(asset => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelectedId(asset.id)}
                  aria-current={selected?.id === asset.id ? 'page' : undefined}
                  className={`w-full text-left rounded-md px-3 py-2 border transition-colors ${
                    selected?.id === asset.id
                      ? 'bg-white border-indigo-200 shadow-sm'
                      : 'bg-transparent border-transparent hover:bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-500 flex-shrink-0">{iconForKind(asset.kind)}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-gray-800 truncate">{asset.name}</span>
                      <span className="block text-[11px] text-gray-500 font-mono truncate">{asset.id}</span>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                    <span>{kindLabel(asset.kind)}</span>
                    <span className="text-gray-300">/</span>
                    <span>{asset.source}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-4">
          {selected ? (
            <div className="max-w-6xl space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-semibold text-gray-900 truncate">{selected.name}</h2>
                  <p className="mt-1 text-[12px] text-gray-500 font-mono break-all">{selected.path}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <StatusChip>
                    <span className="mr-1 text-gray-500">{iconForKind(selected.kind)}</span>
                    {kindLabel(selected.kind)}
                  </StatusChip>
                  <StatusChip>{sourceLabel(selected.source)}</StatusChip>
                  {selected.protected && <StatusChip>Protected</StatusChip>}
                  {selected.generated && <StatusChip>Generated metadata</StatusChip>}
                  {selected.runtimeCompatible === true && <StatusChip>Runtime ready</StatusChip>}
                  {selected.runtimeCompatible === false && <StatusChip>Runtime blocked</StatusChip>}
                </div>
              </div>

              <div className="grid grid-cols-[minmax(220px,300px)_minmax(0,1fr)] gap-4">
                <div className="space-y-4">
                  <Preview asset={selected} />
                  <section className="rounded-md border border-gray-200 bg-white px-3 py-3">
                    <h3 className="text-[12px] font-semibold text-gray-800">Reference safety</h3>
                    <p className="mt-1 text-[12px] text-gray-500">
                      {selectedReferences.length === 0
                        ? 'No catalog references'
                        : `Referenced by ${selectedReferences.length} source${selectedReferences.length === 1 ? '' : 's'}`}
                    </p>
                    {selectedReferences.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {selectedReferences.map(reference => (
                          <li
                            key={`${reference.table}:${reference.source}`}
                            className="text-[11px] font-mono text-gray-600 break-all"
                          >
                            {reference.source}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <ImageEditVariationPanel
                    selected={selected}
                    assets={catalog.assets}
                    existingAssetIds={catalog.assets.map(asset => asset.id)}
                    imageEditRunner={imageEditRunner}
                    capability={imageEditCapability}
                    onAssetAccepted={asset => {
                      dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset });
                      setSelectedId(asset.id);
                      setImportStatus({ tone: 'success', text: `Accepted ${asset.name}` });
                    }}
                  />
                  <dl className="rounded-md border border-gray-200 px-3 bg-white">
                    <DetailRow label="Kind" value={kindLabel(selected.kind)} />
                    <DetailRow label="Path" value={selected.path} />
                    <DetailRow label="Dimensions" value={dimensions(selected) ?? undefined} />
                    <DetailRow label="Frame Size" value={selected.frameWidth && selected.frameHeight ? `${selected.frameWidth} x ${selected.frameHeight}` : undefined} />
                    <DetailRow label="Frames" value={selected.frames} />
                    <DetailRow label="Duration" value={selected.durationMs ? `${selected.durationMs} ms` : undefined} />
                    <DetailRow label="Generated Tool" value={selected.generated?.tool} />
                    <DetailRow label="Created" value={selected.generated?.createdAt} />
                  </dl>
                </div>

                <section className="rounded-md border border-gray-200 bg-white p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Asset ID"
                      aria-label="Asset ID"
                      value={selected.id}
                      disabled
                      className="font-mono text-gray-500 bg-gray-50"
                    />
                    <Input
                      label="Display name"
                      aria-label="Asset display name"
                      value={selected.name}
                      onInput={event => updateSelectedMetadata({ name: event.currentTarget.value })}
                    />
                    <Select
                      label="Source"
                      ariaLabel="Asset source"
                      value={selected.source}
                      options={SOURCE_OPTIONS}
                      onChange={value => updateSelectedMetadata({ source: value as AssetSource })}
                    />
                    <Input
                      label="Tags"
                      aria-label="Asset tags"
                      value={selected.tags?.join(', ') ?? ''}
                      onInput={event => updateSelectedMetadata({ tags: parseTagList(event.currentTarget.value) })}
                    />
                    <Input
                      label="Provenance"
                      aria-label="Asset provenance"
                      value={selected.provenance ?? ''}
                      onInput={event => updateSelectedMetadata({ provenance: event.currentTarget.value })}
                      className="col-span-2"
                    />
                    <Input
                      label="Width"
                      aria-label="Asset width"
                      type="number"
                      min="1"
                      value={selected.width ?? ''}
                      onInput={event => updateSelectedMetadata({ width: optionalNumber(event.currentTarget.value) })}
                    />
                    <Input
                      label="Height"
                      aria-label="Asset height"
                      type="number"
                      min="1"
                      value={selected.height ?? ''}
                      onInput={event => updateSelectedMetadata({ height: optionalNumber(event.currentTarget.value) })}
                    />
                    <Input
                      label="Frame width"
                      aria-label="Asset frame width"
                      type="number"
                      min="1"
                      value={selected.frameWidth ?? ''}
                      onInput={event => updateSelectedMetadata({ frameWidth: optionalNumber(event.currentTarget.value) })}
                    />
                    <Input
                      label="Frame height"
                      aria-label="Asset frame height"
                      type="number"
                      min="1"
                      value={selected.frameHeight ?? ''}
                      onInput={event => updateSelectedMetadata({ frameHeight: optionalNumber(event.currentTarget.value) })}
                    />
                    <Input
                      label="Frames"
                      aria-label="Asset frames"
                      type="number"
                      min="1"
                      value={selected.frames ?? ''}
                      onInput={event => updateSelectedMetadata({ frames: optionalNumber(event.currentTarget.value) })}
                    />
                    <Input
                      label="Duration ms"
                      aria-label="Asset duration ms"
                      type="number"
                      min="1"
                      value={selected.durationMs ?? ''}
                      onInput={event => updateSelectedMetadata({ durationMs: optionalNumber(event.currentTarget.value) })}
                    />
                    <Select
                      label="Runtime"
                      ariaLabel="Runtime compatibility"
                      value={runtimeCompatibilityValue(selected)}
                      options={RUNTIME_COMPATIBILITY_OPTIONS}
                      onChange={value => updateSelectedMetadata({ runtimeCompatible: runtimeCompatibilityFromValue(value) })}
                    />
                    <label className="flex items-end gap-2 rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px] text-gray-600">
                      <input
                        type="checkbox"
                        aria-label="Protected asset metadata"
                        checked={selected.protected === true}
                        onChange={event => updateSelectedMetadata({ protected: event.currentTarget.checked })}
                      />
                      <span className="pb-0.5">Protected</span>
                    </label>
                    <div className="col-span-2 flex flex-col gap-1">
                      <label htmlFor="asset-runtime-notes" className="text-[12px] font-medium text-gray-500">
                        Runtime notes
                      </label>
                      <textarea
                        id="asset-runtime-notes"
                        aria-label="Runtime notes"
                        value={selected.runtimeNotes ?? ''}
                        onInput={event => updateSelectedMetadata({ runtimeNotes: event.currentTarget.value })}
                        rows={3}
                        className="px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-y"
                      />
                    </div>
                    <div className="col-span-2 flex flex-col gap-1">
                      <label htmlFor="asset-notes" className="text-[12px] font-medium text-gray-500">
                        Notes
                      </label>
                      <textarea
                        id="asset-notes"
                        aria-label="Asset notes"
                        value={selected.notes ?? ''}
                        onInput={event => updateSelectedMetadata({ notes: event.currentTarget.value })}
                        rows={4}
                        className="px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-y"
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <EmptyState
              align="center"
              title="No assets cataloged"
              detail="Project-owned visual and audio assets will appear here once they are registered."
            />
          )}
        </main>
      </div>
    </div>
  );
}
