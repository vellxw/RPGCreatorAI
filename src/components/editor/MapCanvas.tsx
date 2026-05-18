import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useEditor } from '../../stores/editorStore';
import { useProject, useProjectStore } from '../../stores/projectStore';
import type { EventType, GameEvent } from '../../types/project';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { eventAssets, gameAssets } from '../../assets/generated/assetCatalog';
import { normalizeVisualProfile } from '../../visual/visualProfile';
import {
  computeCameraFrame,
  computeFitScale,
  computePreviewSceneBounds,
} from '../../visual/viewport';
import { isSupportedVisualTile, isVoidVisualTile } from '../../visual/tileCatalog';

const groundAssets: Record<number, string> = {
  1: gameAssets.grass,
  2: gameAssets.path,
  3: gameAssets.water,
  4: gameAssets.snow,
  5: gameAssets.tree,
  6: gameAssets.interiorFloor,
  7: gameAssets.interiorWall,
};

export function MapCanvas() {
  const { state, dispatch } = useEditor();
  const project = useProject();
  const { dispatch: projectDispatch } = useProjectStore();
  const map = project.maps[state.selectedMapId];
  const canvasAreaRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [painting, setPainting] = useState(false);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [rectangleStart, setRectangleStart] = useState<{ x: number; y: number } | null>(null);
  const [availableSize, setAvailableSize] = useState({ width: 0, height: 0 });

  if (!map) return <div className="flex-1 flex items-center justify-center text-gray-400">No map selected</div>;

  const profile = normalizeVisualProfile(project.project.visualProfile);
  const tileSize = map.tileSize || profile.tileSize;
  const groundLayer = map.layers.find(l => l.name === 'ground');
  const collisionLayer = map.layers.find(l => l.type === 'collision');
  const freshSelectedEvent = state.selectedEvent
    ? map.events.find(event => event.id === state.selectedEvent?.id) ?? null
    : null;
  const mapPixelSize = { width: map.width * tileSize, height: map.height * tileSize };
  const focusCell =
    map.id === project.project.startMapId
      ? project.project.startPosition
      : freshSelectedEvent ?? { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const cameraFrame = computeCameraFrame({
    viewport: profile.baseResolution,
    map: mapPixelSize,
    focus: {
      x: focusCell.x * tileSize + tileSize / 2,
      y: focusCell.y * tileSize + tileSize / 2,
    },
    cameraMode: profile.cameraMode,
  });
  const sceneBounds = computePreviewSceneBounds({ map: mapPixelSize, frame: cameraFrame });
  const stageWidth = sceneBounds.width;
  const stageHeight = sceneBounds.height;
  const stageOffsetX = -sceneBounds.x;
  const stageOffsetY = -sceneBounds.y;
  const fitScale = computeFitScale(
    { width: stageWidth, height: stageHeight },
    {
      width: Math.max(1, availableSize.width - 64),
      height: Math.max(1, availableSize.height - 64),
    },
  );
  const effectiveScale = state.zoomMode === 'fit' ? fitScale : state.zoom / 100;
  const zoomReadout = Math.round(effectiveScale * 100);
  const cameraRange = {
    width: Math.max(0, mapPixelSize.width - profile.baseResolution.width),
    height: Math.max(0, mapPixelSize.height - profile.baseResolution.height),
  };

  useEffect(() => {
    const node = canvasAreaRef.current;
    if (!node) return;
    const update = () => setAvailableSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleEventClick = (event: GameEvent) => {
    dispatch({ type: 'SELECT_EVENT', event, mapId: map.id });
  };

  const eventIds = useMemo(() => new Set(map.events.map(event => event.id)), [map.events]);

  const cellFromPointer = (e: ReactPointerEvent<SVGSVGElement | SVGGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * stageWidth;
    const svgY = ((e.clientY - rect.top) / rect.height) * stageHeight;
    const x = Math.floor((svgX - stageOffsetX) / tileSize);
    const y = Math.floor((svgY - stageOffsetY) / tileSize);
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) return null;
    return { x, y };
  };

  const currentLayerName = state.activeLayer === 'collision' ? 'collision' : 'ground';
  const currentPaintTile =
    state.tool === 'erase'
      ? 0
      : state.activeLayer === 'visual'
        ? state.brush.kind === 'tile'
          ? state.brush.tileId
          : 1
        : state.brush.kind === 'collision'
          ? state.brush.tileId
          : 9;

  const paintBrushAt = (x: number, y: number) => {
    if (state.activeLayer === 'event') return;
    const radius = Math.floor(state.brushSize / 2);
    for (let yy = y - radius; yy <= y + radius; yy += 1) {
      for (let xx = x - radius; xx <= x + radius; xx += 1) {
        projectDispatch({
          type: 'PAINT_TILE',
          mapId: map.id,
          layerName: currentLayerName,
          x: xx,
          y: yy,
          tile: currentPaintTile,
        });
      }
    }
  };

  const nextEventId = (type: EventType) => {
    const base = type === 'transfer' ? 'transfer' : type;
    let n = 1;
    while (eventIds.has(`${base}_${n}`)) n += 1;
    return `${base}_${n}`;
  };

  const createEventAt = (type: EventType, x: number, y: number) => {
    const event: GameEvent = {
      id: nextEventId(type),
      type,
      x,
      y,
      solid: type === 'npc' || type === 'chest',
      sprite:
        type === 'npc'
          ? 'npc_old_man'
          : type === 'chest'
            ? 'chest_closed'
            : type === 'transfer'
              ? 'transfer_door'
              : undefined,
      trigger: type === 'transfer' || type === 'trigger' ? 'touch' : 'interact',
      commands: [],
    };
    projectDispatch({ type: 'ADD_EVENT', mapId: map.id, event });
    dispatch({ type: 'SELECT_EVENT', event, mapId: map.id });
  };

  const handleCanvasPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const cell = cellFromPointer(e);
    if (!cell) return;

    if (state.tool === 'select' || state.interactionMode === 'select') {
      dispatch({ type: 'SELECT_EVENT', event: null, mapId: null });
      return;
    }

    if (state.activeLayer === 'event') {
      if (state.tool === 'brush' && state.brush.kind === 'event') {
        createEventAt(state.brush.eventType, cell.x, cell.y);
      }
      return;
    }

    if (state.tool === 'fill') {
      projectDispatch({
        type: 'FLOOD_FILL',
        mapId: map.id,
        layerName: currentLayerName,
        x: cell.x,
        y: cell.y,
        tile: currentPaintTile,
      });
      return;
    }

    projectDispatch({ type: 'BEGIN_STROKE' });
    setPainting(true);
    if (state.tool === 'rectangle') {
      setRectangleStart(cell);
      return;
    }
    paintBrushAt(cell.x, cell.y);
  };

  const handleCanvasPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const cell = cellFromPointer(e);
    if (!cell) return;

    if (draggingEventId) {
      projectDispatch({
        type: 'UPDATE_EVENT',
        mapId: map.id,
        eventId: draggingEventId,
        changes: { x: cell.x, y: cell.y },
      });
      return;
    }

    if (painting && state.tool !== 'rectangle') {
      paintBrushAt(cell.x, cell.y);
    }
  };

  const stopPointerInteractions = (e?: ReactPointerEvent<SVGSVGElement>) => {
    if (rectangleStart && e) {
      const endCell = cellFromPointer(e);
      if (endCell) {
        projectDispatch({
          type: 'PAINT_RECT',
          mapId: map.id,
          layerName: currentLayerName,
          x1: rectangleStart.x,
          y1: rectangleStart.y,
          x2: endCell.x,
          y2: endCell.y,
          tile: currentPaintTile,
        });
      }
    }
    if (painting || draggingEventId) {
      projectDispatch({ type: 'END_STROKE' });
    }
    setPainting(false);
    setDraggingEventId(null);
    setRectangleStart(null);
  };

  const startEventDrag = (event: GameEvent, e: ReactPointerEvent<SVGGElement>) => {
    e.stopPropagation();
    handleEventClick(event);
    if (state.interactionMode === 'select') {
      projectDispatch({ type: 'BEGIN_STROKE' });
      setDraggingEventId(event.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden relative">
      {/* Canvas area */}
      <div ref={canvasAreaRef} className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div
          className="relative bg-slate-950 shadow-2xl rounded-[10px] ring-1 ring-slate-300"
          style={{ width: stageWidth * effectiveScale, height: stageHeight * effectiveScale }}
        >
          <svg
            ref={svgRef}
            width={stageWidth}
            height={stageHeight}
            viewBox={`0 0 ${stageWidth} ${stageHeight}`}
            className="w-full h-full overflow-visible"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={stopPointerInteractions}
            onPointerLeave={stopPointerInteractions}
          >
            <rect width={stageWidth} height={stageHeight} fill="#0f172a" />
            <defs>
              <pattern id="void-checker" width="16" height="16" patternUnits="userSpaceOnUse">
                <rect width="16" height="16" fill="#3b0d31" />
                <rect width="8" height="8" fill="#7c2d65" />
                <rect x="8" y="8" width="8" height="8" fill="#7c2d65" />
              </pattern>
            </defs>

            <g transform={`translate(${stageOffsetX} ${stageOffsetY})`}>
              {/* Tiles */}
              {groundLayer && groundLayer.tiles.map((tile, i) => {
                const x = (i % map.width) * tileSize;
                const y = Math.floor(i / map.width) * tileSize;
                if (isVoidVisualTile(tile) || !isSupportedVisualTile(tile)) {
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width={tileSize} height={tileSize} fill="#2a1026" />
                      <rect
                        x={x}
                        y={y}
                        width={tileSize}
                        height={tileSize}
                        fill="url(#void-checker)"
                        opacity="0.75"
                      />
                      <line
                        x1={x + 4}
                        y1={y + 4}
                        x2={x + tileSize - 4}
                        y2={y + tileSize - 4}
                        stroke={isVoidVisualTile(tile) ? '#f472b6' : '#ef4444'}
                        strokeWidth="3"
                      />
                      <line
                        x1={x + tileSize - 4}
                        y1={y + 4}
                        x2={x + 4}
                        y2={y + tileSize - 4}
                        stroke={isVoidVisualTile(tile) ? '#f472b6' : '#ef4444'}
                        strokeWidth="3"
                      />
                    </g>
                  );
                }
                return (
                  <image
                    key={i}
                    x={x}
                    y={y}
                    width={tileSize}
                    height={tileSize}
                    href={groundAssets[tile] ?? gameAssets.grass}
                    style={{ imageRendering: 'pixelated' }}
                  />
                );
              })}
              {state.activeLayer === 'collision' && collisionLayer && collisionLayer.tiles.map((tile, i) => {
                if (tile !== 9) return null;
                const x = (i % map.width) * tileSize;
                const y = Math.floor(i / map.width) * tileSize;
                return (
                  <image
                    key={`collision-${i}`}
                    x={x}
                    y={y}
                    width={tileSize}
                    height={tileSize}
                    href={gameAssets.collisionOverlay}
                    opacity="0.72"
                    style={{ imageRendering: 'pixelated' }}
                  />
                );
              })}

              {/* Grid lines */}
              {Array.from({ length: map.width + 1 }).map((_, i) => (
                <line
                  key={`v${i}`}
                  x1={i * tileSize}
                  y1={0}
                  x2={i * tileSize}
                  y2={mapPixelSize.height}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.5"
                />
              ))}
              {Array.from({ length: map.height + 1 }).map((_, i) => (
                <line
                  key={`h${i}`}
                  x1={0}
                  y1={i * tileSize}
                  x2={mapPixelSize.width}
                  y2={i * tileSize}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.5"
                />
              ))}

              {/* Player spawn */}
              {state.selectedMapId === project.project.startMapId && (
                <g>
                  <rect
                    x={project.project.startPosition.x * tileSize + 4}
                    y={project.project.startPosition.y * tileSize + 4}
                    width={tileSize - 8}
                    height={tileSize - 8}
                    fill="#3b82f6"
                    rx="4"
                    opacity="0.9"
                  />
                  <text
                    x={project.project.startPosition.x * tileSize + tileSize / 2}
                    y={project.project.startPosition.y * tileSize + tileSize / 2 + 4}
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
                    onPointerDown={e => startEventDrag(event, e)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <rect
                        x={event.x * tileSize - 2}
                        y={event.y * tileSize - 2}
                        width={tileSize + 4}
                        height={tileSize + 4}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        rx="3"
                      />
                    )}
                    <image
                      x={event.x * tileSize + 2}
                      y={event.y * tileSize + 2}
                      width={tileSize - 4}
                      height={tileSize - 4}
                      href={eventAssets[event.type]}
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </g>
                );
              })}
            </g>

            <rect
              x={stageOffsetX}
              y={stageOffsetY}
              width={mapPixelSize.width}
              height={mapPixelSize.height}
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              strokeDasharray="10 6"
            />
            <rect
              x={cameraFrame.x + stageOffsetX}
              y={cameraFrame.y + stageOffsetY}
              width={cameraFrame.width}
              height={cameraFrame.height}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3"
            />
            <rect
              x={stageOffsetX}
              y={stageOffsetY}
              width={cameraRange.width}
              height={cameraRange.height}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="2"
              strokeDasharray="6 6"
              opacity="0.9"
            />
            <text
              x={cameraFrame.x + stageOffsetX + 14}
              y={cameraFrame.y + stageOffsetY + 22}
              fill="#fef3c7"
              fontSize="14"
              fontWeight="700"
            >
              GAME VIEWPORT · {profile.aspectRatio}
            </text>
          </svg>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md px-3 py-1.5 shadow-sm">
        <span className="text-[12px] text-gray-600 font-mono">
          X: {freshSelectedEvent?.x ?? '-'} Y: {freshSelectedEvent?.y ?? '-'}
        </span>
        <span className="text-[11px] text-gray-400">·</span>
        <span className="text-[12px] text-gray-600">
          {state.interactionMode === 'select'
            ? 'Move events'
            : state.activeLayer === 'event' && state.brush.kind === 'event'
              ? `Place ${state.brush.label}`
              : `${state.tool[0].toUpperCase()}${state.tool.slice(1)} ${state.activeLayer}`}
        </span>
        <span className="text-[11px] text-gray-400">·</span>
        <span className="text-[12px] text-gray-600">
          Frame {profile.baseResolution.width}×{profile.baseResolution.height}
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
        <span className="text-[12px] text-gray-600 font-medium px-2">{zoomReadout}%</span>
        <button
          onClick={() => dispatch({ type: 'SET_ZOOM', zoom: Math.min(200, state.zoom + 25) })}
          className="p-1 hover:bg-gray-100 rounded cursor-pointer"
        >
          <ZoomIn size={14} className="text-gray-500" />
        </button>
        <button
          onClick={() => dispatch({ type: 'FIT_TO_VIEW' })}
          className={`px-2 py-1 text-[11px] rounded cursor-pointer ml-1 ${
            state.zoomMode === 'fit'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Fit
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_ACTUAL_SIZE' })}
          className={`px-2 py-1 text-[11px] rounded cursor-pointer ${
            state.zoomMode === 'manual' && state.zoom === 100
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          100%
        </button>
        <button
          onClick={() => dispatch({ type: 'FIT_TO_VIEW' })}
          className="p-1 hover:bg-gray-100 rounded cursor-pointer"
          title="Fit to view"
        >
          <Maximize2 size={14} className="text-gray-500" />
        </button>
      </div>
    </div>
  );
}
