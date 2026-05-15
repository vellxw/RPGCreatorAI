import { useState } from 'react';
import { Search, ChevronDown, ChevronRight, X, Pencil, Eraser, Square, Circle, Move, Pipette } from 'lucide-react';

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
    tiles: ['grass-1', 'grass-2', 'grass-3', 'grass-4', 'dirt-1', 'dirt-2', 'dirt-3', 'dirt-4', 'sand-1', 'sand-2', 'sand-3', 'sand-4'],
  },
  { id: 'paths', name: 'Paths', color: '#f59e0b', tiles: ['path-1', 'path-2', 'path-3', 'path-4'] },
  { id: 'walls', name: 'Walls', color: '#6b7280', tiles: ['wall-1', 'wall-2', 'wall-3', 'wall-4'] },
  { id: 'water', name: 'Water', color: '#3b82f6', tiles: ['water-1', 'water-2', 'water-3', 'water-4'] },
  { id: 'objects', name: 'Objects', color: '#8b5cf6', tiles: ['tree-1', 'rock-1', 'bush-1', 'flower-1'] },
  { id: 'events', name: 'Events', color: '#ec4899', tiles: ['npc', 'chest', 'door', 'trigger'] },
];

const tileColors: Record<string, string> = {
  'grass-1': '#4ade80', 'grass-2': '#22c55e', 'grass-3': '#16a34a', 'grass-4': '#15803d',
  'dirt-1': '#d4a574', 'dirt-2': '#c49a6c', 'dirt-3': '#b8860b', 'dirt-4': '#a0522d',
  'sand-1': '#f5deb3', 'sand-2': '#deb887', 'sand-3': '#d2b48c', 'sand-4': '#c8a882',
  'path-1': '#d4a574', 'path-2': '#c49a6c', 'path-3': '#b8860b', 'path-4': '#a0522d',
  'wall-1': '#6b7280', 'wall-2': '#4b5563', 'wall-3': '#374151', 'wall-4': '#1f2937',
  'water-1': '#60a5fa', 'water-2': '#3b82f6', 'water-3': '#2563eb', 'water-4': '#1d4ed8',
  'tree-1': '#166534', 'rock-1': '#78716c', 'bush-1': '#15803d', 'flower-1': '#f472b6',
  'npc': '#8b5cf6', 'chest': '#f59e0b', 'door': '#06b6d4', 'trigger': '#ec4899',
};

export function TilePalette() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ terrain: true });
  const [selectedTile, setSelectedTile] = useState<string | null>('grass-1');
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
                    style={{ backgroundColor: tileColors[tile] || '#e5e7eb' }}
                    title={tile}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
