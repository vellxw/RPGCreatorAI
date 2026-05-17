import { useState } from 'react';
import { Search, ChevronDown, ChevronRight, X, Pencil, Eraser, Square, Circle, Move, Pipette } from 'lucide-react';
import { eventAssets, gameAssets } from '../../assets/generated/assetCatalog';

interface TileCategory {
  id: string;
  name: string;
  color: string;
  tiles: string[];
}

const categories: TileCategory[] = [
  {
    id: 'terrain',
    name: 'Terrain',
    color: '#22c55e',
    tiles: ['grass', 'path', 'water'],
  },
  { id: 'walls', name: 'Walls', color: '#6b7280', tiles: ['wall'] },
  { id: 'events', name: 'Events', color: '#ec4899', tiles: ['npc', 'chest', 'door', 'trigger'] },
];

const tilePreviewAssets: Record<string, string> = {
  grass: gameAssets.grass,
  path: gameAssets.path,
  water: gameAssets.water,
  wall: gameAssets.wall,
  npc: eventAssets.npc,
  chest: eventAssets.chest,
  door: eventAssets.transfer,
  trigger: eventAssets.trigger,
};

export function TilePalette() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ terrain: true });
  const [selectedTile, setSelectedTile] = useState<string | null>('grass');
  const [search, setSearch] = useState('');

  const toggleCategory = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-[220px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        <span className="text-[13px] font-semibold text-gray-700">Tile Palette</span>
        <X size={14} className="text-gray-400 cursor-pointer hover:text-gray-600" />
      </div>

      {/* Tools */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
        {[Pencil, Eraser, Square, Circle, Move, Pipette].map((Icon, i) => (
          <button
            key={i}
            className={`p-1.5 rounded cursor-pointer ${i === 0 ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
          >
            <Icon size={14} />
          </button>
        ))}
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
        {categories.map(cat => (
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
                {cat.tiles.map(tile => (
                  <button
                    key={tile}
                    onClick={() => setSelectedTile(tile)}
                    className={`w-10 h-10 rounded border-2 cursor-pointer transition-all ${
                      selectedTile === tile
                        ? 'border-indigo-500 shadow-md scale-105'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    title={tile}
                  >
                    <img src={tilePreviewAssets[tile]} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
