import { useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
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
  mapUsage?: Record<string, string[]>;
  onChange(value: TilesetDatabaseData): void;
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

export function TilesetEditor({ value, mapUsage = {}, onChange }: TilesetEditorProps) {
  const [selectedId, setSelectedId] = useState(value.tilesets[0]?.id ?? '');
  const [activeGroup, setActiveGroup] = useState<TilesetTileMetadata['group']>('A');
  const selected = value.tilesets.find(tileset => tileset.id === selectedId) ?? value.tilesets[0];
  const selectedUsage = selected ? mapUsage[selected.id] ?? [] : [];
  const ids = useMemo(() => new Set(value.tilesets.map(tileset => tileset.id)), [value.tilesets]);

  const emitTilesets = (tilesets: TilesetData[]) => onChange({ ...value, tilesets });

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

  if (value.tilesets.length === 0 || !selected) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="No tilesets yet"
          detail="Add a tileset to define tile art, passability, terrain tags, and map palette metadata."
        />
        <Button size="sm" icon={<Plus size={12} />} aria-label="Add tileset" onClick={addTileset}>
          Add tileset
        </Button>
      </div>
    );
  }

  const groupedTiles = selected.tiles.filter(tile => tile.group === activeGroup);

  return (
    <div className="flex gap-4 min-h-0">
      <div className="w-[220px] flex-shrink-0 border border-gray-200 bg-white">
        <div className="p-3 border-b border-gray-200">
          <Button size="sm" icon={<Plus size={12} />} aria-label="Add tileset" onClick={addTileset}>
            Add tileset
          </Button>
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
          {ASSET_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </datalist>
      </div>
    </div>
  );
}
