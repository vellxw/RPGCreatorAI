import { useEditor } from '../../stores/editorStore';
import { useProject } from '../../stores/projectStore';
import type { GameEvent } from '../../types/project';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const TILE_SIZE = 32;

const tileColors: Record<number, string> = {
  0: '#90c96e', // walkable grass
  1: '#7ab85a', // grass variant
  9: '#5a8a3a', // collision/wall
};

const eventColors: Record<string, string> = {
  npc: '#8b5cf6',
  transfer: '#06b6d4',
  chest: '#f59e0b',
  object: '#6b7280',
  trigger: '#ec4899',
};

const eventIcons: Record<string, string> = {
  npc: '👤',
  transfer: '🚪',
  chest: '📦',
  object: '⬜',
  trigger: '⚡',
};

export function MapCanvas() {
  const { state, dispatch } = useEditor();
  const project = useProject();
  const map = project.maps[state.selectedMapId];

  if (!map) return <div className="flex-1 flex items-center justify-center text-gray-400">No map selected</div>;

  const collisionLayer = map.layers.find(l => l.type === 'collision');
  const canvasWidth = map.width * TILE_SIZE;
  const canvasHeight = map.height * TILE_SIZE;

  const handleEventClick = (event: GameEvent) => {
    dispatch({ type: 'SELECT_EVENT', event, mapId: map.id });
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden relative">
      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div
          className="relative bg-white shadow-lg rounded-sm"
          style={{ width: canvasWidth * (state.zoom / 100), height: canvasHeight * (state.zoom / 100) }}
        >
          {/* Grid */}
          <svg
            width={canvasWidth}
            height={canvasHeight}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            className="w-full h-full"
          >
            {/* Tiles */}
            {collisionLayer && collisionLayer.tiles.map((tile, i) => {
              const x = (i % map.width) * TILE_SIZE;
              const y = Math.floor(i / map.width) * TILE_SIZE;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={TILE_SIZE}
                  height={TILE_SIZE}
                  fill={tileColors[tile] || '#7ab85a'}
                  stroke="#6aa04a"
                  strokeWidth="0.5"
                />
              );
            })}

            {/* Grid lines */}
            {Array.from({ length: map.width + 1 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={i * TILE_SIZE}
                y1={0}
                x2={i * TILE_SIZE}
                y2={canvasHeight}
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="0.5"
              />
            ))}
            {Array.from({ length: map.height + 1 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1={0}
                y1={i * TILE_SIZE}
                x2={canvasWidth}
                y2={i * TILE_SIZE}
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="0.5"
              />
            ))}

            {/* Player spawn */}
            {state.selectedMapId === project.project.startMapId && (
              <g>
                <rect
                  x={project.project.startPosition.x * TILE_SIZE + 4}
                  y={project.project.startPosition.y * TILE_SIZE + 4}
                  width={TILE_SIZE - 8}
                  height={TILE_SIZE - 8}
                  fill="#3b82f6"
                  rx="4"
                  opacity="0.9"
                />
                <text
                  x={project.project.startPosition.x * TILE_SIZE + TILE_SIZE / 2}
                  y={project.project.startPosition.y * TILE_SIZE + TILE_SIZE / 2 + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="white"
                  fontWeight="bold"
                >
                  P
                </text>
              </g>
            )}

            {/* Events */}
            {map.events.map(event => {
              const isSelected = state.selectedEvent?.id === event.id;
              return (
                <g
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="cursor-pointer"
                >
                  {isSelected && (
                    <rect
                      x={event.x * TILE_SIZE - 2}
                      y={event.y * TILE_SIZE - 2}
                      width={TILE_SIZE + 4}
                      height={TILE_SIZE + 4}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      rx="3"
                    />
                  )}
                  <rect
                    x={event.x * TILE_SIZE + 3}
                    y={event.y * TILE_SIZE + 3}
                    width={TILE_SIZE - 6}
                    height={TILE_SIZE - 6}
                    fill={eventColors[event.type] || '#6b7280'}
                    rx="3"
                    opacity="0.85"
                  />
                  <text
                    x={event.x * TILE_SIZE + TILE_SIZE / 2}
                    y={event.y * TILE_SIZE + TILE_SIZE / 2 + 5}
                    textAnchor="middle"
                    fontSize="14"
                  >
                    {eventIcons[event.type] || '⬜'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md px-3 py-1.5 shadow-sm">
        <span className="text-[12px] text-gray-600 font-mono">
          X: {state.selectedEvent?.x ?? '-'} Y: {state.selectedEvent?.y ?? '-'}
        </span>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md px-2 py-1 shadow-sm">
        <button
          onClick={() => dispatch({ type: 'SET_ZOOM', zoom: Math.max(50, state.zoom - 25) })}
          className="p-1 hover:bg-gray-100 rounded cursor-pointer"
        >
          <ZoomOut size={14} className="text-gray-500" />
        </button>
        <span className="text-[12px] text-gray-600 font-medium px-2">{state.zoom}%</span>
        <button
          onClick={() => dispatch({ type: 'SET_ZOOM', zoom: Math.min(200, state.zoom + 25) })}
          className="p-1 hover:bg-gray-100 rounded cursor-pointer"
        >
          <ZoomIn size={14} className="text-gray-500" />
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_ZOOM', zoom: 100 })}
          className="p-1 hover:bg-gray-100 rounded cursor-pointer ml-1"
        >
          <Maximize2 size={14} className="text-gray-500" />
        </button>
      </div>
    </div>
  );
}
