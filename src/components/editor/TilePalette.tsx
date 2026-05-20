import { useState } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Pencil,
  Eraser,
  Square,
  Move,
  Pipette,
  PaintBucket,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
import { eventAssets, gameAssets } from '../../assets/generated/assetCatalog';
import { useEditor, type BrushSelection } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { SCENE_TEMPLATES, cloneSceneTemplateMap, getSceneTemplate } from '../../templates/sceneTemplates';
import { listTilesetTiles, tileAssetForId } from '../../visual/tileCatalog';

interface TileCategory {
  id: string;
  name: string;
  color: string;
  tiles: string[];
}

const layerLabels = [
  ['ground', 'Ground'],
  ['decoration', 'Decor'],
  ['foreground', 'Front'],
  ['collision', 'Pass'],
  ['region', 'Region'],
  ['event', 'Events'],
] as const;

export function TilePalette({ embedded = false }: { embedded?: boolean }) {
  const { state: editor, dispatch } = useEditor();
  const { state: project, dispatch: projectDispatch } = useProjectStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ A: true, B: true });
  const [search, setSearch] = useState('');
  const selectedMap = project.maps[editor.selectedMapId];
  const tilesetTiles = listTilesetTiles(selectedMap?.tilesetId);
  const tileCategories: TileCategory[] = [
    { id: 'A', name: 'Tiles A', color: '#22c55e', tiles: tilesetTiles.filter(tile => tile.group === 'A').map(tile => String(tile.id)) },
    { id: 'B', name: 'Tiles B', color: '#10b981', tiles: tilesetTiles.filter(tile => tile.group === 'B').map(tile => String(tile.id)) },
    { id: 'C', name: 'Tiles C', color: '#8b5cf6', tiles: tilesetTiles.filter(tile => tile.group === 'C').map(tile => String(tile.id)) },
    { id: 'regions', name: 'Regions', color: '#0ea5e9', tiles: ['region_1', 'region_2', 'region_3', 'region_4', 'region_5', 'region_6', 'region_7', 'region_8'] },
    { id: 'collision', name: 'Passability', color: '#6b7280', tiles: ['eraseCollision', 'wall'] },
    { id: 'events', name: 'Events', color: '#ec4899', tiles: ['npc', 'chest', 'door', 'trigger'] },
  ].filter(cat => cat.tiles.length > 0);

  const toggleCategory = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const brushes: Record<string, BrushSelection> = Object.fromEntries(
    tilesetTiles.map(tile => [String(tile.id), { kind: 'tile', tileId: tile.id, label: tile.name } satisfies BrushSelection]),
  );
  Object.assign(brushes, {
    wall: { kind: 'collision', tileId: 9, label: 'wall' },
    eraseCollision: { kind: 'collision', tileId: 0, label: 'erase' },
    region_1: { kind: 'region', regionId: 1, label: 'Region 1' },
    region_2: { kind: 'region', regionId: 2, label: 'Region 2' },
    region_3: { kind: 'region', regionId: 3, label: 'Region 3' },
    region_4: { kind: 'region', regionId: 4, label: 'Region 4' },
    region_5: { kind: 'region', regionId: 5, label: 'Region 5' },
    region_6: { kind: 'region', regionId: 6, label: 'Region 6' },
    region_7: { kind: 'region', regionId: 7, label: 'Region 7' },
    region_8: { kind: 'region', regionId: 8, label: 'Region 8' },
    npc: { kind: 'event', eventType: 'npc', label: 'npc' },
    chest: { kind: 'event', eventType: 'chest', label: 'chest' },
    door: { kind: 'event', eventType: 'transfer', label: 'transfer' },
    trigger: { kind: 'event', eventType: 'trigger', label: 'trigger' },
  });

  const selectedTile =
    editor.brush.kind === 'tile'
      ? String(editor.brush.tileId)
      : editor.brush.kind === 'region'
        ? `region_${editor.brush.regionId}`
        : editor.brush.kind === 'event' && editor.brush.label === 'transfer'
          ? 'door'
          : editor.brush.kind === 'collision' && editor.brush.tileId === 0
            ? 'eraseCollision'
            : editor.brush.label;
  const selectedPreview =
    editor.brush.kind === 'tile'
      ? tileAssetForId(selectedMap?.tilesetId, editor.brush.tileId)
      : editor.brush.kind === 'collision'
        ? editor.brush.tileId === 9
          ? gameAssets.collisionOverlay
          : gameAssets.voidWarning
        : editor.brush.kind === 'region'
          ? gameAssets.collisionOverlay
          : editor.brush.label === 'transfer'
            ? eventAssets.transfer
            : eventAssets[editor.brush.label];

  const applyTemplate = (templateId: (typeof SCENE_TEMPLATES)[number]['id']) => {
    if (!selectedMap) return;
    const template = getSceneTemplate(templateId);
    projectDispatch({
      type: 'REPLACE_MAP',
      mapId: selectedMap.id,
      map: cloneSceneTemplateMap(templateId, selectedMap.id, selectedMap.name),
    });
    if (project.project.startMapId === selectedMap.id) {
      projectDispatch({
        type: 'UPDATE_PROJECT_META',
        changes: { startPosition: template.startPosition },
      });
    }
  };

  return (
    <div
      className={`bg-white flex flex-col min-h-0 ${
        embedded ? 'h-full' : 'w-[220px] flex-shrink-0 border-r border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        <span className="text-[13px] font-semibold text-gray-700">Tile Palette</span>
        <X size={14} className="text-gray-400 cursor-pointer hover:text-gray-600" />
      </div>

      <div className="px-3 py-2 border-b border-gray-100 space-y-2">
        <div className="space-y-1">
          {layerLabels.map(([layer, label]) => {
            const mapLayer = selectedMap?.layers.find(item => item.name === layer);
            const disabled = layer !== 'event' && !mapLayer;
            return (
              <div key={layer} className="flex items-center gap-1">
                <button
                  onClick={() => dispatch({ type: 'SET_ACTIVE_LAYER', layer })}
                  disabled={disabled}
                  className={`flex-1 px-2 py-1.5 text-[11px] rounded-md border text-left ${
                    editor.activeLayer === layer
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
                {mapLayer && (
                  <>
                    <button
                      type="button"
                      title={mapLayer.visible === false ? 'Show layer' : 'Hide layer'}
                      onClick={() =>
                        projectDispatch({
                          type: 'UPDATE_MAP_LAYER_META',
                          mapId: selectedMap.id,
                          layerName: mapLayer.name,
                          changes: { visible: mapLayer.visible === false },
                        })
                      }
                      className="p-1 text-gray-400 hover:text-gray-700"
                    >
                      {mapLayer.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      type="button"
                      title={mapLayer.locked ? 'Unlock layer' : 'Lock layer'}
                      onClick={() =>
                        projectDispatch({
                          type: 'UPDATE_MAP_LAYER_META',
                          mapId: selectedMap.id,
                          layerName: mapLayer.name,
                          changes: { locked: !mapLayer.locked },
                        })
                      }
                      className="p-1 text-gray-400 hover:text-gray-700"
                    >
                      {mapLayer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 p-2 rounded-md bg-gray-50 border border-gray-100">
          <img src={selectedPreview} alt="" className="w-8 h-8 object-contain" />
          <div>
            <div className="text-[11px] text-gray-500">Selected</div>
            <div className="text-[12px] font-medium text-gray-700">{editor.brush.label}</div>
          </div>
        </div>
      </div>

      {/* Tools */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
        {[
          { icon: Pencil, tool: 'brush' as const, title: 'Brush' },
          { icon: PaintBucket, tool: 'fill' as const, title: 'Fill' },
          { icon: Square, tool: 'rectangle' as const, title: 'Rectangle' },
          { icon: Eraser, tool: 'erase' as const, title: 'Erase' },
          { icon: Move, tool: 'select' as const, title: 'Select / move events' },
          { icon: Pipette, tool: 'brush' as const, title: 'Brush' },
        ].map(({ icon: Icon, tool, title }, i) => (
          <button
            key={i}
            onClick={() => {
              dispatch({ type: 'SET_TOOL', tool });
            }}
            title={title}
            className={`p-1.5 rounded cursor-pointer ${
              editor.tool === tool
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
            }`}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-b border-gray-100">
        <div className="text-[11px] font-medium text-gray-500 mb-1.5">Brush size</div>
        <div className="flex gap-1">
          {([1, 2, 3, 5] as const).map(size => (
            <button
              key={size}
              onClick={() => dispatch({ type: 'SET_BRUSH_SIZE', brushSize: size })}
              className={`flex-1 px-2 py-1 text-[11px] rounded border ${
                editor.brushSize === size
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {size}×{size}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tiles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-[12px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {tileCategories.map(cat => (
          <div key={cat.id}>
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              {expanded[cat.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="text-[13px] font-medium text-gray-700">{cat.name}</span>
            </button>
            {expanded[cat.id] && (
              <div className="grid grid-cols-4 gap-1 px-3 pb-2">
                {cat.tiles
                  .filter(tile => {
                    const brush = brushes[tile];
                    return (brush?.label ?? tile).toLowerCase().includes(search.toLowerCase());
                  })
                  .map(tile => (
                  <button
                    key={tile}
                    onClick={() => dispatch({ type: 'SET_BRUSH', brush: brushes[tile] })}
                    className={`w-10 h-10 rounded border-2 cursor-pointer transition-all ${
                      selectedTile === tile
                        ? 'border-indigo-500 shadow-md scale-105'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    title={brushes[tile]?.label ?? tile}
                  >
                    {brushes[tile]?.kind === 'region' ? (
                      <span className="flex h-full items-center justify-center text-[12px] font-semibold text-sky-700">
                        {brushes[tile].label.replace('Region ', '')}
                      </span>
                    ) : (
                      <img
                        src={
                          brushes[tile]?.kind === 'tile'
                            ? tileAssetForId(selectedMap?.tilesetId, brushes[tile].tileId)
                            : tile === 'wall'
                              ? gameAssets.collisionOverlay
                              : tile === 'eraseCollision'
                                ? gameAssets.voidWarning
                                : tile === 'door'
                                  ? eventAssets.transfer
                                  : eventAssets[(brushes[tile] as { label?: keyof typeof eventAssets } | undefined)?.label ?? 'trigger']
                        }
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="border-t border-gray-100 mt-2 pt-2">
          <div className="px-3 pb-2">
            <div className="text-[12px] font-semibold text-gray-700 mb-2">Scene Templates</div>
            <div className="space-y-1.5">
              {SCENE_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className="w-full text-left px-2.5 py-2 rounded-md border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  title={template.description}
                >
                  <div className="text-[12px] font-medium text-gray-700">{template.label}</div>
                  <div className="text-[10px] text-gray-500">{template.aspectRatio}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
