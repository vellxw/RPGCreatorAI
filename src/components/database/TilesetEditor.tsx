import { useMemo, useState } from 'react';
import { Copy, Plus, Trash2, Upload } from 'lucide-react';
import {
  importTilesetAsset,
  type TilesetImportRunner,
} from '../../adapters/tilesetImport';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import {
  CheckboxField,
  NumberField,
  SelectField,
  TextField,
} from './DatabaseFields';
import { tileAssetForKey, TILE_ASSET_KEYS } from '../../visual/tileCatalog';
import type {
  AssetCatalogEntry,
  Direction,
  TilePassability,
  TilesetData,
  TilesetDatabaseData,
  TilesetTileMetadata,
} from '../../types/project';

const TILE_GROUPS: TilesetTileMetadata['group'][] = ['A', 'B', 'C', 'D', 'E', 'Region', 'Collision'];
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const PASSABILITY_OPTIONS = [
  { value: 'passable', label: 'Passable' },
  { value: 'blocked', label: 'Blocked' },
];
const ASSET_OPTIONS = [...TILE_ASSET_KEYS].map(key => ({ value: key, label: key }));

interface TilesetEditorProps {
  value: TilesetDatabaseData;
  assets?: AssetCatalogEntry[];
  tilesetImporter?: TilesetImportRunner;
  mapUsage?: Record<string, string[]>;
  onAssetImported?(asset: AssetCatalogEntry): void;
  onChange(value: TilesetDatabaseData): void;
}

interface TilesetImportDraft {
  tilesetId: string;
  name: string;
  tileSize: number;
  columns: number;
  tileCount: number;
  defaultPassability: TilePassability;
  foregroundStartTile: number;
  regionMarkerCount: number;
}

function uniqueId(existing: Set<string>, base: string): string {
  let id = base;
  let i = 1;
  while (existing.has(id)) {
    i += 1;
    id = `${base}_${i}`;
  }
  return id;
}

function slugId(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function cloneTileset(tileset: TilesetData): TilesetData {
  return JSON.parse(JSON.stringify(tileset));
}

function defaultTile(id: number): TilesetTileMetadata {
  return {
    id,
    name: `Tile ${id}`,
    asset: 'voidWarning',
    group: 'A',
    passability: 'blocked',
    terrainTag: '',
    priority: 0,
  };
}

function nextTileId(tileset: TilesetData): number {
  const ids = new Set(tileset.tiles.map(tile => tile.id));
  let id = 0;
  while (ids.has(id)) id += 1;
  return id;
}

function defaultTilesetImportDraft(index: number): TilesetImportDraft {
  return {
    tilesetId: `tileset_${index}`,
    name: `Tileset ${index}`,
    tileSize: 32,
    columns: 8,
    tileCount: 64,
    defaultPassability: 'passable',
    foregroundStartTile: 0,
    regionMarkerCount: 0,
  };
}

function validateTilesetImportDraft(draft: TilesetImportDraft): string | null {
  if (!draft.tilesetId.trim()) return 'Tileset import ID is required.';
  if (!draft.name.trim()) return 'Tileset import name is required.';
  if (!Number.isFinite(draft.tileSize) || draft.tileSize <= 0) return 'Tile size must be a positive number.';
  if (!Number.isInteger(draft.columns) || draft.columns <= 0) return 'Column count must be a positive integer.';
  if (!Number.isInteger(draft.tileCount) || draft.tileCount <= 0) return 'Tile count must be a positive integer.';
  if (!Number.isInteger(draft.foregroundStartTile) || draft.foregroundStartTile < 0) {
    return 'Foreground start tile must be zero or a positive integer.';
  }
  if (draft.foregroundStartTile > draft.tileCount) {
    return 'Foreground start tile cannot be greater than tile count.';
  }
  if (!Number.isInteger(draft.regionMarkerCount) || draft.regionMarkerCount < 0) {
    return 'Region marker count must be zero or a positive integer.';
  }
  return null;
}

function buildImportedTileset(
  id: string,
  assetId: string,
  draft: TilesetImportDraft,
): TilesetData {
  const visualTiles = Array.from({ length: draft.tileCount }, (_, tileId): TilesetTileMetadata => {
    const foreground = draft.foregroundStartTile > 0 && tileId >= draft.foregroundStartTile;
    return {
      id: tileId,
      name: `Tile ${tileId}`,
      asset: assetId,
      group: foreground ? 'B' : 'A',
      passability: draft.defaultPassability,
      terrainTag: foreground ? 'foreground' : 'ground',
      priority: foreground ? 1 : 0,
    };
  });
  const regionTiles = Array.from({ length: draft.regionMarkerCount }, (_, index): TilesetTileMetadata => ({
    id: 1000 + index,
    name: `Region ${index + 1}`,
    asset: assetId,
    group: 'Region',
    passability: 'passable',
    terrainTag: `region_${index + 1}`,
    priority: 0,
  }));
  const collisionTile: TilesetTileMetadata = {
    id: 2000,
    name: 'Collision Block',
    asset: assetId,
    group: 'Collision',
    passability: 'blocked',
    terrainTag: 'collision',
    priority: 0,
  };
  return {
    id,
    name: draft.name.trim(),
    tileSize: draft.tileSize,
    tiles: [...visualTiles, ...regionTiles, collisionTile],
  };
}

function TilesetMetadataPreview({ draft }: { draft: TilesetImportDraft }) {
  const shownTiles = Math.max(1, Math.min(48, Math.trunc(draft.tileCount || 1)));
  const columns = Math.max(1, Math.min(12, Math.trunc(draft.columns || 1)));
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div
        aria-label="Tileset metadata preview"
        role="img"
        className="grid overflow-hidden rounded bg-gray-100"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(18px, 1fr))` }}
      >
        {Array.from({ length: shownTiles }, (_, tileId) => {
          const foreground = draft.foregroundStartTile > 0 && tileId >= draft.foregroundStartTile;
          return (
            <div
              key={tileId}
              className={`flex aspect-square items-center justify-center border border-white text-[9px] ${
                foreground ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
              }`}
            >
              {tileId}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        {draft.tileSize}px tiles · {draft.columns} columns · {draft.tileCount} visual · {draft.regionMarkerCount} region markers
      </p>
    </div>
  );
}

export function TilesetEditor({
  value,
  assets = [],
  tilesetImporter = importTilesetAsset,
  mapUsage = {},
  onAssetImported,
  onChange,
}: TilesetEditorProps) {
  const [selectedId, setSelectedId] = useState(value.tilesets[0]?.id ?? '');
  const [activeGroup, setActiveGroup] = useState<TilesetTileMetadata['group']>('A');
  const [tilesetDraft, setTilesetDraft] = useState<TilesetImportDraft | null>(null);
  const [tilesetImporting, setTilesetImporting] = useState(false);
  const [tilesetStatus, setTilesetStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const selected = value.tilesets.find(tileset => tileset.id === selectedId) ?? value.tilesets[0];
  const selectedUsage = selected ? mapUsage[selected.id] ?? [] : [];
  const ids = useMemo(() => new Set(value.tilesets.map(tileset => tileset.id)), [value.tilesets]);

  const emitTilesets = (tilesets: TilesetData[]) => onChange({ ...value, tilesets });

  const openTilesetImport = () => {
    setTilesetDraft(defaultTilesetImportDraft(value.tilesets.length + 1));
    setTilesetStatus(null);
  };

  const updateTilesetDraft = (changes: Partial<TilesetImportDraft>) => {
    setTilesetDraft(current => current ? { ...current, ...changes } : current);
  };

  const acceptTilesetImport = async () => {
    if (!tilesetDraft) return;
    const validationError = validateTilesetImportDraft(tilesetDraft);
    if (validationError) {
      setTilesetStatus({ tone: 'error', text: validationError });
      return;
    }

    setTilesetImporting(true);
    setTilesetStatus(null);
    try {
      const result = await tilesetImporter(
        assets.map(asset => asset.id),
        {
          idBase: slugId(tilesetDraft.name, 'tileset'),
          name: tilesetDraft.name.trim(),
          tileSize: tilesetDraft.tileSize,
          columns: tilesetDraft.columns,
          tileCount: tilesetDraft.tileCount,
        },
      );
      if (result.cancelled) return;
      if (!result.success || !result.asset) {
        setTilesetStatus({ tone: 'error', text: result.error ?? 'Tileset import failed.' });
        return;
      }

      onAssetImported?.(result.asset);
      const nextTilesetId = uniqueId(ids, slugId(tilesetDraft.tilesetId, `tileset_${value.tilesets.length + 1}`));
      const nextTileset = buildImportedTileset(nextTilesetId, result.asset.id, tilesetDraft);
      emitTilesets([...value.tilesets, nextTileset]);
      setSelectedId(nextTileset.id);
      setActiveGroup('A');
      setTilesetDraft(null);
      setTilesetStatus({ tone: 'success', text: `Imported ${result.asset.name}` });
    } catch (error) {
      setTilesetStatus({ tone: 'error', text: (error as Error).message });
    } finally {
      setTilesetImporting(false);
    }
  };

  const updateSelected = (changes: Partial<TilesetData>) => {
    if (!selected) return;
    emitTilesets(value.tilesets.map(tileset =>
      tileset.id === selected.id ? { ...tileset, ...changes, id: changes.id ?? tileset.id } : tileset,
    ));
    if (changes.id) setSelectedId(changes.id);
  };

  const updateTile = (tileId: number, changes: Partial<TilesetTileMetadata>) => {
    if (!selected) return;
    updateSelected({
      tiles: selected.tiles.map(tile =>
        tile.id === tileId ? { ...tile, ...changes } : tile,
      ),
    });
  };

  const addTileset = () => {
    const id = uniqueId(ids, `tileset_${value.tilesets.length + 1}`);
    const next: TilesetData = {
      id,
      name: id,
      tileSize: selected?.tileSize ?? 32,
      tiles: [defaultTile(0)],
    };
    emitTilesets([...value.tilesets, next]);
    setSelectedId(id);
    setActiveGroup('A');
  };

  const duplicateTileset = () => {
    if (!selected) return;
    const id = uniqueId(ids, `${selected.id}_copy`);
    const next = cloneTileset(selected);
    next.id = id;
    next.name = `${selected.name} Copy`;
    emitTilesets([...value.tilesets, next]);
    setSelectedId(id);
  };

  const deleteTileset = () => {
    if (!selected) return;
    const usageText = selectedUsage.length > 0
      ? ` It is referenced by ${selectedUsage.length} map${selectedUsage.length === 1 ? '' : 's'}.`
      : '';
    if (!confirm(`Delete tileset "${selected.id}"?${usageText}`)) return;
    const next = value.tilesets.filter(tileset => tileset.id !== selected.id);
    emitTilesets(next);
    setSelectedId(next[0]?.id ?? '');
  };

  const addTile = () => {
    if (!selected) return;
    const id = nextTileId(selected);
    updateSelected({ tiles: [...selected.tiles, { ...defaultTile(id), group: activeGroup }] });
  };

  const deleteTile = (tileId: number) => {
    if (!selected) return;
    updateSelected({ tiles: selected.tiles.filter(tile => tile.id !== tileId) });
  };

  const assetOptions = [
    ...ASSET_OPTIONS,
    ...assets
      .filter(asset => asset.kind === 'tileset')
      .map(asset => ({ value: asset.id, label: `${asset.name} (${asset.id})` })),
  ];
  const importControls = (
    <>
      {tilesetStatus && (
        <div
          className={`rounded-md border px-3 py-2 text-[12px] ${
            tilesetStatus.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {tilesetStatus.text}
        </div>
      )}
      {tilesetDraft && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-gray-700">Tileset import</p>
            <Button
              size="sm"
              aria-label="Cancel tileset import"
              onClick={() => setTilesetDraft(null)}
            >
              Cancel
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Tileset import ID" value={tilesetDraft.tilesetId} onChange={tilesetId => updateTilesetDraft({ tilesetId })} />
            <TextField label="Tileset import name" value={tilesetDraft.name} onChange={name => updateTilesetDraft({ name })} />
            <NumberField label="Tileset import tile size" value={tilesetDraft.tileSize} min={1} onChange={tileSize => updateTilesetDraft({ tileSize })} />
            <NumberField label="Tileset import columns" value={tilesetDraft.columns} min={1} onChange={columns => updateTilesetDraft({ columns })} />
            <NumberField label="Tileset import tile count" value={tilesetDraft.tileCount} min={1} onChange={tileCount => updateTilesetDraft({ tileCount })} />
            <SelectField
              label="Tileset import default passability"
              value={tilesetDraft.defaultPassability}
              options={PASSABILITY_OPTIONS}
              onChange={defaultPassability => updateTilesetDraft({ defaultPassability: defaultPassability as TilePassability })}
            />
            <NumberField label="Tileset import foreground start tile" value={tilesetDraft.foregroundStartTile} min={0} onChange={foregroundStartTile => updateTilesetDraft({ foregroundStartTile })} />
            <NumberField label="Tileset import region marker count" value={tilesetDraft.regionMarkerCount} min={0} onChange={regionMarkerCount => updateTilesetDraft({ regionMarkerCount })} />
          </div>
          <div className="mt-3">
            <TilesetMetadataPreview draft={tilesetDraft} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              icon={<Upload size={12} />}
              aria-label="Accept tileset import"
              disabled={tilesetImporting}
              onClick={acceptTilesetImport}
            >
              Accept tileset import
            </Button>
          </div>
        </div>
      )}
    </>
  );

  if (value.tilesets.length === 0 || !selected) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="No tilesets yet"
          detail="Add a tileset to define tile art, passability, terrain tags, and map palette metadata."
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Plus size={12} />} aria-label="Add tileset" onClick={addTileset}>
            Add tileset
          </Button>
          <Button size="sm" icon={<Upload size={12} />} aria-label="Import tileset" onClick={openTilesetImport}>
            Import tileset
          </Button>
        </div>
        {importControls}
      </div>
    );
  }

  const groupedTiles = selected.tiles.filter(tile => tile.group === activeGroup);

  return (
    <div className="flex gap-4 min-h-0">
      <div className="w-[220px] flex-shrink-0 border border-gray-200 bg-white">
        <div className="p-3 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Plus size={12} />} aria-label="Add tileset" onClick={addTileset}>
              Add tileset
            </Button>
            <Button size="sm" icon={<Upload size={12} />} aria-label="Import tileset" onClick={openTilesetImport}>
              Import tileset
            </Button>
          </div>
        </div>
        <div className="max-h-[620px] overflow-y-auto">
          {value.tilesets.map(tileset => (
            <button
              key={tileset.id}
              type="button"
              className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-gray-50 ${
                tileset.id === selected.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
              }`}
              onClick={() => setSelectedId(tileset.id)}
            >
              <span className="block truncate">{tileset.name || tileset.id}</span>
              <span className="block truncate text-[11px] text-gray-400">{tileset.id}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="grid grid-cols-2 gap-2 max-w-lg flex-1">
            <TextField label="Tileset ID" value={selected.id} onChange={id => updateSelected({ id })} />
            <TextField label="Tileset name" value={selected.name} onChange={name => updateSelected({ name })} />
            <NumberField label="Tile size" value={selected.tileSize} onChange={tileSize => updateSelected({ tileSize })} />
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              icon={<Copy size={12} />}
              aria-label={`Duplicate tileset ${selected.id}`}
              onClick={duplicateTileset}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={12} />}
              aria-label={`Delete tileset ${selected.id}`}
              onClick={deleteTileset}
            >
              Delete
            </Button>
          </div>
        </div>

        {selectedUsage.length > 0 && (
          <p className="text-[12px] text-amber-700">
            Referenced by {selectedUsage.length} map{selectedUsage.length === 1 ? '' : 's'}: {selectedUsage.join(', ')}
          </p>
        )}

        {importControls}

        <div className="flex flex-wrap gap-1">
          {TILE_GROUPS.map(group => (
            <button
              key={group}
              type="button"
              aria-label={`Show ${group} tiles`}
              className={`px-2.5 py-1 text-[12px] border border-gray-200 ${
                activeGroup === group ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveGroup(group)}
            >
              {group}
            </button>
          ))}
          <Button size="sm" icon={<Plus size={12} />} onClick={addTile}>
            Add tile
          </Button>
        </div>

        <div className="space-y-3">
          {groupedTiles.length === 0 ? (
            <EmptyState
              compact
              title={`No ${activeGroup} tiles`}
              detail="Use Add tile to define a tile in this group, then assign art and passability."
            />
          ) : (
            groupedTiles.map(tile => (
              <div key={tile.id} className="border border-gray-200 bg-white p-3 space-y-3">
                <div className="flex gap-3">
                  <img
                    src={tileAssetForKey(tile.asset)}
                    alt={`${tile.name || tile.id} swatch`}
                    className="h-10 w-10 border border-gray-200 bg-gray-100"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div className="grid grid-cols-5 gap-2 flex-1">
                    <NumberField label={`Tile ${tile.id} id`} value={tile.id} onChange={id => updateTile(tile.id, { id })} />
                    <TextField label={`Tile ${tile.id} name`} value={tile.name} onChange={name => updateTile(tile.id, { name })} />
                    <TextField label={`Tile ${tile.id} asset`} list="tileset-asset-keys" value={tile.asset} onChange={asset => updateTile(tile.id, { asset })} />
                    <SelectField
                      label={`Tile ${tile.id} group`}
                      value={tile.group}
                      options={TILE_GROUPS.map(group => ({ value: group, label: group }))}
                      onChange={group => updateTile(tile.id, { group: group as TilesetTileMetadata['group'] })}
                    />
                    <SelectField
                      label={`Tile ${tile.id} passability`}
                      value={tile.passability}
                      options={PASSABILITY_OPTIONS}
                      onChange={passability => updateTile(tile.id, { passability: passability as TilePassability })}
                    />
                    <TextField label={`Tile ${tile.id} terrain tag`} value={tile.terrainTag ?? ''} onChange={terrainTag => updateTile(tile.id, { terrainTag })} />
                    <NumberField label={`Tile ${tile.id} priority`} value={tile.priority ?? 0} onChange={priority => updateTile(tile.id, { priority })} />
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete tile ${tile.id}`}
                    className="text-gray-400 hover:text-red-500 self-start"
                    onClick={() => deleteTile(tile.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-4">
                  {(['ladder', 'bush', 'counter', 'damage'] as const).map(flag => (
                    <CheckboxField
                      key={flag}
                      label={`Tile ${tile.id} ${flag}`}
                      checked={Boolean(tile[flag])}
                      onChange={checked => updateTile(tile.id, { [flag]: checked } as Partial<TilesetTileMetadata>)}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-4">
                  {DIRECTIONS.map(direction => (
                    <CheckboxField
                      key={direction}
                      label={`Tile ${tile.id} ${direction} pass`}
                      checked={tile.directionalPassability?.[direction] ?? true}
                      onChange={checked =>
                        updateTile(tile.id, {
                          directionalPassability: {
                            ...(tile.directionalPassability ?? {}),
                            [direction]: checked,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <datalist id="tileset-asset-keys">
          {assetOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </datalist>
      </div>
    </div>
  );
}
