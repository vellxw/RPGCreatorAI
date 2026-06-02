import { useMemo, useState } from 'react';
import { Box, Grid2X2, Image, Music, Search, Sparkles } from 'lucide-react';
import { gameAssets } from '../assets/generated/assetCatalog';
import { Input, Select } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { useProject } from '../stores/projectStore';
import type { AssetCatalogEntry, AssetKind } from '../types/project';

const KIND_OPTIONS: Array<{ value: AssetKind | 'all'; label: string }> = [
  { value: 'all', label: 'All kinds' },
  { value: 'image', label: 'Images' },
  { value: 'spritesheet', label: 'Spritesheets' },
  { value: 'tileset', label: 'Tilesets' },
  { value: 'audio', label: 'Audio' },
  { value: 'generated', label: 'Generated' },
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

function DetailRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <dt className="text-[12px] font-medium text-gray-500">{label}</dt>
      <dd className="text-[12px] text-gray-800 min-w-0 break-words">{value}</dd>
    </div>
  );
}

export function AssetsScreen() {
  const state = useProject();
  const catalog = state.assets;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AssetKind | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string>('');

  const filteredAssets = useMemo(
    () => catalog.assets.filter(asset => matchesAsset(asset, query, kind)),
    [catalog.assets, kind, query],
  );
  const selected = filteredAssets.find(asset => asset.id === selectedId) ?? filteredAssets[0] ?? null;

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
        </div>
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
            <div className="max-w-4xl space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-semibold text-gray-900 truncate">{selected.name}</h2>
                  <p className="mt-1 text-[12px] text-gray-500 font-mono break-all">{selected.path}</p>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-gray-600 bg-gray-100 border border-gray-200 rounded-md px-2 py-1">
                  {iconForKind(selected.kind)}
                  <span>{kindLabel(selected.kind)}</span>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(220px,320px)_minmax(0,1fr)] gap-4">
                <Preview asset={selected} />
                <dl className="rounded-md border border-gray-200 px-3 bg-white">
                  <DetailRow label="ID" value={selected.id} />
                  <DetailRow label="Source" value={selected.source} />
                  <DetailRow label="Dimensions" value={dimensions(selected) ?? undefined} />
                  <DetailRow label="Frame Size" value={selected.frameWidth && selected.frameHeight ? `${selected.frameWidth} x ${selected.frameHeight}` : undefined} />
                  <DetailRow label="Frames" value={selected.frames} />
                  <DetailRow label="Duration" value={selected.durationMs ? `${selected.durationMs} ms` : undefined} />
                  <DetailRow label="Tags" value={selected.tags?.join(', ')} />
                  <DetailRow label="Generated Tool" value={selected.generated?.tool} />
                  <DetailRow label="Created" value={selected.generated?.createdAt} />
                </dl>
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
