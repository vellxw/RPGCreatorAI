import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlaytestStore } from '../stores/playtestStore';
import { useProject, useProjectStore } from '../stores/projectStore';
import { Badge } from '../components/ui/Badge';
import {
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Gamepad2,
  RotateCcw,
  House,
  Lightbulb,
  Zap,
  ClipboardList,
  Bot,
  Link2,
  MessageSquare,
} from 'lucide-react';
import { getRuntimeLaunchAdapter, getFileSystemAdapter, getPlaytestSessionAdapter } from '../adapters/adapterFactory';
import { useEditor } from '../stores/editorStore';
import { validateProject } from '../validation/validateProject';
import { animationAssets, eventAssets, gameAssets } from '../assets/generated/assetCatalog';
import { normalizeVisualProfile } from '../visual/visualProfile';
import { computeCameraFrame } from '../visual/viewport';
import { isSupportedVisualTile, isVoidVisualTile, tileAssetForId } from '../visual/tileCatalog';
import {
  advanceTileFluidMotion,
  beginTileFluidStep,
  createTileFluidMotion,
  directionFromKey,
  movementSpeedToTilesPerSecond,
  type TileFluidMotion,
} from '../playtest/tileFluidMotion';
import type { AnimationSetDisplayData, Direction, GameEvent, MapData } from '../types/project';

function displayForCharacter(
  tileSize: number,
  display: AnimationSetDisplayData | undefined,
  fallbackHeightTiles: number,
  overrideHeightTiles?: number,
  aspect = 1,
) {
  const heightTiles = overrideHeightTiles ?? display?.heightTiles ?? fallbackHeightTiles;
  const widthTiles = display?.widthTiles ?? heightTiles * aspect;
  const height = tileSize * heightTiles;
  const width = tileSize * widthTiles;
  const yOffset = display?.yOffsetPx ?? 0;
  return { width, height, yOffset };
}

function animationSheetFor(
  setId: string | undefined,
  action: 'idle' | 'walk',
  direction: Direction,
): string | null {
  switch (setId) {
    case 'player_adventurer':
      return animationAssets.playerAdventurer[action][direction];
    case 'npc_old_man':
      return animationAssets.oldMan[action][direction];
    case 'npc_shopkeeper':
      return animationAssets.shopkeeper[action][direction];
    default:
      return null;
  }
}

function PlaytestControls({
  onMove,
  onRestart,
}: {
  onMove: (direction: Direction) => void;
  onRestart: () => void;
}) {
  return (
    <div className="w-[180px] flex-shrink-0 bg-white border-r border-gray-200 p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <Gamepad2 size={14} className="text-indigo-600" />
        <span className="text-[13px] font-semibold text-gray-700">Playtest Controls</span>
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-2">Movement: WASD / Arrows</p>
        <div className="grid grid-cols-3 gap-1 w-[100px] mx-auto">
          <div />
          <button
            onClick={() => onMove('up')}
            className="w-8 h-8 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-[11px] font-bold text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            ↑
          </button>
          <div />
          <button
            onClick={() => onMove('left')}
            className="w-8 h-8 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-[11px] font-bold text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            ←
          </button>
          <button
            onClick={() => onMove('down')}
            className="w-8 h-8 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-[11px] font-bold text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            ↓
          </button>
          <button
            onClick={() => onMove('right')}
            className="w-8 h-8 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-[11px] font-bold text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            →
          </button>
        </div>
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Interact: E / Enter / Space</p>
        <button className="w-full h-8 bg-gray-100 border border-gray-200 rounded text-[12px] font-medium text-gray-600 hover:bg-gray-200 cursor-pointer">
          E
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-gray-600">Save: F5</span>
          <span className="text-[11px] text-gray-400 font-mono">F5</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-gray-600">Load: F9</span>
          <span className="text-[11px] text-gray-400 font-mono">F9</span>
        </div>
      </div>

      <div className="space-y-2 mt-2">
        <button
          onClick={onRestart}
          className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer"
        >
          <RotateCcw size={14} /> Restart Test
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer">
          <House size={14} /> Spawn at Start
        </button>
      </div>

      <div className="mt-auto p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-[11px] text-blue-700">
          <span className="font-medium inline-flex items-center gap-1">
            <Lightbulb size={12} />
            Tip:
          </span>{' '}
          The preview below is a simulated editor preview, not the
          native runtime. Use &quot;Open in Runtime&quot; to launch the C++ executable.
        </p>
      </div>
    </div>
  );
}

const PreviewGroundLayer = memo(function PreviewGroundLayer({
  map,
  tileSize,
}: {
  map: MapData;
  tileSize: number;
}) {
  return (
    <>
      {map.layers.find(l => l.name === 'ground')?.tiles.map((tile, i) => {
        const x = (i % map.width) * tileSize;
        const y = Math.floor(i / map.width) * tileSize;
        if (isVoidVisualTile(tile) || !isSupportedVisualTile(tile, map.tilesetId)) {
          return (
            <image
              key={i}
              x={x}
              y={y}
              width={tileSize}
              height={tileSize}
              href={gameAssets.voidWarning}
              style={{ imageRendering: 'pixelated' }}
            />
          );
        }
        return (
          <image
            key={i}
            x={x}
            y={y}
            width={tileSize}
            height={tileSize}
            href={tileAssetForId(map.tilesetId, tile)}
            style={{ imageRendering: 'pixelated' }}
          />
        );
      })}
    </>
  );
});

const PreviewEventLayer = memo(function PreviewEventLayer({
  events,
  tileSize,
  animationDisplays,
  defaultCharacterHeightTiles,
}: {
  events: GameEvent[];
  tileSize: number;
  animationDisplays: Record<string, AnimationSetDisplayData | undefined>;
  defaultCharacterHeightTiles: number;
}) {
  return (
    <>
      {events.map(event => {
        const sheet = animationSheetFor(event.animationSet, 'idle', 'down');
        const display = animationDisplays[event.animationSet ?? ''];
        const usesCharacterScale =
          !!sheet || event.type === 'npc' || event.displayHeightTiles !== undefined;
        const size = usesCharacterScale
          ? displayForCharacter(tileSize, display, defaultCharacterHeightTiles, event.displayHeightTiles)
          : { width: tileSize, height: tileSize, yOffset: 0 };
        const x = event.x * tileSize + tileSize / 2 - size.width / 2;
        const y = event.y * tileSize + tileSize - size.height + size.yOffset;
        const clipId = `event-frame-${event.id}`;
        return (
          <g key={event.id}>
            {sheet ? (
              <>
                <clipPath id={clipId}>
                  <rect x={x} y={y} width={size.width} height={size.height} />
                </clipPath>
                <image
                  x={x}
                  y={y}
                  width={size.width * 4}
                  height={size.height}
                  href={sheet}
                  clipPath={`url(#${clipId})`}
                  style={{ imageRendering: 'pixelated' }}
                />
              </>
            ) : (
              <image
                x={x}
                y={y}
                width={size.width}
                height={size.height}
                href={eventAssets[event.type]}
                style={{ imageRendering: 'pixelated' }}
              />
            )}
            {event.type === 'npc' && (
              <>
                <rect
                  x={event.x * tileSize - 8}
                  y={event.y * tileSize - 16}
                  width={tileSize + 16}
                  height={14}
                  fill="#1f2937"
                  rx="3"
                  opacity="0.85"
                />
                <text
                  x={event.x * tileSize + tileSize / 2}
                  y={event.y * tileSize - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill="white"
                  fontWeight="bold"
                >
                  {event.id}
                </text>
              </>
            )}
          </g>
        );
      })}
    </>
  );
});

function PreviewPlayerSprite({
  visualX,
  visualY,
  direction,
  moving,
  motionElapsed,
  tileSize,
  display,
  defaultCharacterHeightTiles,
  currentMap,
}: {
  visualX: number;
  visualY: number;
  direction: Direction;
  moving: boolean;
  motionElapsed: number;
  tileSize: number;
  display?: AnimationSetDisplayData;
  defaultCharacterHeightTiles: number;
  currentMap: string;
}) {
  const playerAction = moving ? 'walk' : 'idle';
  const playerFrame = moving ? Math.floor((motionElapsed * 8) % 4) : 0;
  const playerSheet = animationAssets.playerAdventurer[playerAction][direction];
  const playerSize = displayForCharacter(tileSize, display, defaultCharacterHeightTiles);
  const playerX = visualX + tileSize / 2 - playerSize.width / 2;
  const playerY = visualY + tileSize - playerSize.height + playerSize.yOffset;
  const playerClipId = `player-frame-${currentMap}`;

  return (
    <>
      <defs>
        <clipPath id={playerClipId}>
          <rect
            x={playerX}
            y={playerY}
            width={playerSize.width}
            height={playerSize.height}
          />
        </clipPath>
      </defs>
      <image
        x={playerX - playerFrame * playerSize.width}
        y={playerY}
        width={playerSize.width * 4}
        height={playerSize.height}
        href={playerSheet}
        clipPath={`url(#${playerClipId})`}
        style={{ imageRendering: 'pixelated' }}
      />
    </>
  );
}

function GamePreview({
  playerX,
  playerY,
  visualX,
  visualY,
  direction,
  moving,
  motionElapsed,
  currentMap,
}: {
  playerX: number;
  playerY: number;
  visualX: number;
  visualY: number;
  direction: Direction;
  moving: boolean;
  motionElapsed: number;
  currentMap: string;
}) {
  const project = useProject();
  const map = project.maps[currentMap];
  const animationDisplays = useMemo(
    () =>
      Object.fromEntries(
        project.databases.animations.sets.map(set => [set.id, set.display]),
      ) as Record<string, AnimationSetDisplayData | undefined>,
    [project.databases.animations.sets],
  );
  if (!map) return null;

  const profile = normalizeVisualProfile(project.project.visualProfile);
  const tileSize = map.tileSize || profile.tileSize;
  const defaultCharacterHeightTiles =
    project.databases.system.defaultCharacterHeightTiles ?? 1.5;
  const playerAnimationSet = project.databases.system.playerAnimationSet ?? 'player_adventurer';
  const mapPixelSize = { width: map.width * tileSize, height: map.height * tileSize };
  const cameraFrame = computeCameraFrame({
    viewport: profile.baseResolution,
    map: mapPixelSize,
    focus: {
      x: visualX + tileSize / 2,
      y: visualY + tileSize / 2,
    },
    cameraMode: profile.cameraMode,
  });
  return (
    <div className="flex-1 bg-gray-900 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-3 left-3 bg-amber-100/95 text-amber-900 px-3 py-1.5 rounded-md text-[11px] font-medium z-10 border border-amber-300">
        Editor Preview (simulated) — not the native runtime
      </div>
      <div className="absolute top-3 right-3 bg-black/70 text-white px-3 py-2 rounded-md text-[11px] font-mono space-y-0.5 z-10">
        <div className="text-green-400">FPS: 60 (simulated)</div>
        <div>Map: {currentMap}</div>
        <div>
          Player: X {playerX} / Y {playerY}
        </div>
      </div>

      <div
        className="relative max-w-full max-h-full"
        style={{
          width: `min(100%, calc((100vh - 280px) * ${profile.baseResolution.width / profile.baseResolution.height}))`,
          aspectRatio: `${profile.baseResolution.width} / ${profile.baseResolution.height}`,
        }}
      >
        <svg
          width={profile.baseResolution.width}
          height={profile.baseResolution.height}
          viewBox={`${cameraFrame.x} ${cameraFrame.y} ${cameraFrame.width} ${cameraFrame.height}`}
          className="w-full h-full rounded shadow-2xl bg-slate-950"
        >
          <rect
            x={cameraFrame.x}
            y={cameraFrame.y}
            width={cameraFrame.width}
            height={cameraFrame.height}
            fill="#0f172a"
          />
          <PreviewGroundLayer map={map} tileSize={tileSize} />
          <PreviewEventLayer
            events={map.events}
            tileSize={tileSize}
            animationDisplays={animationDisplays}
            defaultCharacterHeightTiles={defaultCharacterHeightTiles}
          />
          <PreviewPlayerSprite
            visualX={visualX}
            visualY={visualY}
            direction={direction}
            moving={moving}
            motionElapsed={motionElapsed}
            tileSize={tileSize}
            display={animationDisplays[playerAnimationSet]}
            defaultCharacterHeightTiles={defaultCharacterHeightTiles}
            currentMap={currentMap}
          />
        </svg>
        <div className="absolute left-3 bottom-3 bg-black/70 text-white px-3 py-1.5 rounded-md text-[11px] font-mono">
          Viewport {profile.baseResolution.width}×{profile.baseResolution.height} · {profile.aspectRatio}
        </div>
      </div>
    </div>
  );
}

function RuntimeStateInspector({ state }: { state: ReturnType<typeof usePlaytestStore>['state'] }) {
  return (
    <div className="w-[240px] flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={14} className="text-amber-500" />
        <span className="text-[13px] font-semibold text-gray-700">Runtime State Inspector</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <StateRow label="Current Map" value={state.currentMap} />
          <StateRow label="Position (X, Y)" value={`${state.playerX}, ${state.playerY}`} />
          <StateRow label="Direction" value={state.direction} />
        </div>

        <div>
          <span className="text-[12px] font-semibold text-gray-700 block mb-2">Flags</span>
          <div className="space-y-1.5">
            {Object.entries(state.flags).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-[11px] text-gray-600 font-mono">{key}</span>
                <Badge variant={value ? 'success' : 'muted'}>{value ? 'true' : 'false'}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[12px] font-semibold text-gray-700 block mb-2">Inventory</span>
          <div className="space-y-1.5">
            {state.inventory.map(item => (
              <div key={item.itemId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={gameAssets.potion} alt="" className="w-4 h-4" />
                  <span className="text-[12px] text-gray-700">{item.name}</span>
                </div>
                <span className="text-[11px] text-gray-500">x{item.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[12px] font-semibold text-gray-700 block mb-2">Active Event</span>
          {state.activeEvent ? (
            <p className="text-[12px] text-indigo-600 font-mono">{state.activeEvent}</p>
          ) : (
            <p className="text-[12px] text-gray-400">None</p>
          )}
        </div>

      </div>
    </div>
  );
}

function RuntimeBridgePanel() {
  const adapter = getRuntimeLaunchAdapter();
  const sessionAdapter = getPlaytestSessionAdapter();
  const { state: projectState, dispatch: projectDispatch } = useProjectStore();
  const { state: editorState } = useEditor();
  const [status, setStatus] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState(adapter.getStatus());

  // Poll status every second while the bridge is available so the UI reflects
  // the runtime exiting on its own.
  useEffect(() => {
    if (!adapter.canLaunch()) return;
    let cancelled = false;
    const tick = async () => {
      const s = await (
        adapter as unknown as { getStatusAsync?: () => Promise<typeof runtimeStatus> }
      ).getStatusAsync?.();
      if (!cancelled && s) setRuntimeStatus(s);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [adapter]);

  const handleLaunch = async () => {
    const fsAdapter = getFileSystemAdapter();
    const projectRoot = fsAdapter?.getProjectRoot();
    if (!projectRoot) {
      setStatus('Open a project folder first (Project > Open).');
      return;
    }
    const validation = validateProject({
      project: projectState.project,
      maps: projectState.maps,
      items: projectState.items,
      databases: projectState.databases,
    });
    projectDispatch({ type: 'VALIDATE' });
    if (validation.errors.length > 0) {
      setStatus(`Launch blocked: ${validation.errors[0].message}`);
      return;
    }
    const session = await sessionAdapter.createSession(projectRoot, {
      project: projectState.project,
      maps: projectState.maps,
      items: projectState.items,
      databases: projectState.databases,
    }, {
      mode: editorState.playtestMode,
      currentMapId: editorState.selectedMapId,
      selectedEventMapId: editorState.selectedEventMapId ?? undefined,
      selectedEventId: editorState.selectedEvent?.id,
    });
    if (!session.success || !session.sessionRoot) {
      setStatus(`Launch blocked: ${session.error ?? 'playtest session was not created'}`);
      return;
    }
    const result = await adapter.launch(session.sessionRoot, { executableSearchRoot: projectRoot });
    setStatus(result.success ? `Runtime launched (pid ${result.pid}) from ${session.sessionRoot}` : `Launch failed: ${result.error}`);
    setRuntimeStatus(adapter.getStatus());
  };

  const handleKill = async () => {
    await adapter.kill();
    setStatus('Runtime stopped');
    setRuntimeStatus(adapter.getStatus());
  };

  const available = adapter.canLaunch() && sessionAdapter.canCreateSession();

  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {available ? (
            <CheckCircle2 size={14} className="text-green-500" />
          ) : (
            <AlertTriangle size={14} className="text-amber-500" />
          )}
          <span className="text-[12px] text-gray-700">
            Runtime bridge: <span className="font-mono">{runtimeStatus}</span>
          </span>
          {!available && (adapter.getUnavailableReason() ?? sessionAdapter.getUnavailableReason()) && (
            <span className="text-[11px] text-gray-500 italic">— {adapter.getUnavailableReason() ?? sessionAdapter.getUnavailableReason()}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {runtimeStatus === 'running' && available && (
            <button
              onClick={handleKill}
              className="px-3 py-1.5 text-[12px] rounded-md cursor-pointer bg-red-500 text-white hover:bg-red-600"
            >
              Stop Runtime
            </button>
          )}
          <button
            onClick={handleLaunch}
            disabled={!available || runtimeStatus === 'running'}
            className={`px-3 py-1.5 text-[12px] rounded-md cursor-pointer ${
              available && runtimeStatus !== 'running'
                ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Open in Runtime
          </button>
        </div>
      </div>
      {status && <p className="text-[11px] text-gray-600 mt-2">{status}</p>}
    </div>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className="text-[12px] text-gray-800 font-medium">{value}</span>
    </div>
  );
}

function LogsPanel({ logs }: { logs: ReturnType<typeof usePlaytestStore>['logs'] }) {
  const levelColors = {
    INFO: 'text-blue-600 bg-blue-50',
    WARN: 'text-amber-600 bg-amber-50',
    ERROR: 'text-red-600 bg-red-50',
  };

  return (
    <div className="h-[180px] flex-shrink-0 bg-white border-t border-gray-200 flex">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100">
          <button className="text-[12px] font-medium text-indigo-600 border-b-2 border-indigo-500 pb-1 cursor-pointer">
            <span className="inline-flex items-center gap-1">
              <ClipboardList size={12} />
              Logs
            </span>
          </button>
          <button className="text-[12px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">
            ✓ Validation <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">0</span>
          </button>
          <button className="text-[12px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">Event Trace</button>
          <button className="text-[12px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">AI Debug</button>
          <div className="ml-auto flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-green-500" />
            <span className="text-[11px] text-green-600 font-medium">Editor preview running</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 font-mono">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-3 text-[11px]">
              <span className="text-gray-400 w-14">{log.timestamp}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${levelColors[log.level]}`}>
                {log.level}
              </span>
              <span className="text-gray-700">{log.message}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-[280px] border-l border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={14} className="text-indigo-500" />
          <span className="text-[13px] font-semibold text-gray-700">AI Debug Assist</span>
          <Badge variant="info">Beta</Badge>
        </div>
        <div className="space-y-2">
          {[
            { icon: <Zap size={14} />, text: 'Explain why the player cannot move here' },
            { icon: <Link2 size={14} />, text: 'Find broken transfer events' },
            { icon: <MessageSquare size={14} />, text: 'Generate missing dialogue' },
          ].map((item, i) => (
            <button
              key={i}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-600 bg-gray-50 rounded-md hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors group text-left"
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.text}</span>
              <ChevronRight size={12} className="text-gray-300 group-hover:text-indigo-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlaytestScreen() {
  const project = useProject();
  const { state, logs, setPlayerPose, faceDirection, restart } = usePlaytestStore({
    currentMap: project.project.startMapId,
    playerX: project.project.startPosition.x,
    playerY: project.project.startPosition.y,
    direction: project.project.startPosition.direction,
  });
  const previewMap = project.maps[state.currentMap];
  const profile = normalizeVisualProfile(project.project.visualProfile);
  const seedTileSize = previewMap?.tileSize || profile.tileSize;
  const [motionView, setMotionView] = useState<TileFluidMotion>(() =>
    createTileFluidMotion({
      tileX: project.project.startPosition.x,
      tileY: project.project.startPosition.y,
      direction: project.project.startPosition.direction,
      tileSize: seedTileSize,
    }),
  );
  const motionRef = useRef(motionView);
  const heldDirectionRef = useRef<Direction | null>(null);
  const lastBlockedDirectionRef = useRef<Direction | null>(null);
  const playerTilesPerSecond = movementSpeedToTilesPerSecond(
    project.databases.system.playerMovementSpeed,
  );

  useEffect(() => {
    const next = createTileFluidMotion({
      tileX: state.playerX,
      tileY: state.playerY,
      direction: state.direction,
      tileSize: seedTileSize,
    });
    motionRef.current = next;
    setMotionView({ ...next });
  }, [state.currentMap, seedTileSize]);

  const isBlocked = useCallback((map: MapData | undefined, x: number, y: number) => {
    if (!map) return true;
    const collision = map.layers.find(layer => layer.name === 'collision');
    const tile = collision?.tiles[y * map.width + x] ?? 0;
    if (tile === 9) return true;
    return map.events.some(event => event.solid && event.x === x && event.y === y);
  }, []);

  const movePreviewPlayer = useCallback((direction: Direction) => {
    const motion = motionRef.current;
    const started = beginTileFluidStep(motion, direction, {
      width: previewMap?.width ?? 1,
      height: previewMap?.height ?? 1,
      isBlocked: (x, y) => isBlocked(previewMap, x, y),
    }, playerTilesPerSecond);
    if (!started) {
      if (lastBlockedDirectionRef.current !== direction) {
        faceDirection(direction);
        lastBlockedDirectionRef.current = direction;
      }
    } else {
      lastBlockedDirectionRef.current = null;
    }
    setMotionView({ ...motion });
  }, [faceDirection, isBlocked, playerTilesPerSecond, previewMap]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = directionFromKey(event.key);
      if (!direction) return;
      event.preventDefault();
      heldDirectionRef.current = direction;
      if (!motionRef.current.moving) {
        movePreviewPlayer(direction);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const direction = directionFromKey(event.key);
      if (!direction) return;
      event.preventDefault();
      if (heldDirectionRef.current === direction) {
        heldDirectionRef.current = null;
        lastBlockedDirectionRef.current = null;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [movePreviewPlayer]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const motion = motionRef.current;

      if (!motion.moving && heldDirectionRef.current) {
        const started = beginTileFluidStep(motion, heldDirectionRef.current, {
          width: previewMap?.width ?? 1,
          height: previewMap?.height ?? 1,
          isBlocked: (x, y) => isBlocked(previewMap, x, y),
        }, playerTilesPerSecond);
        if (!started) {
          if (lastBlockedDirectionRef.current !== heldDirectionRef.current) {
            faceDirection(heldDirectionRef.current);
            lastBlockedDirectionRef.current = heldDirectionRef.current;
          }
        } else {
          lastBlockedDirectionRef.current = null;
        }
      }

      const completed = advanceTileFluidMotion(motion, dt, playerTilesPerSecond);
      if (completed) {
        setPlayerPose(completed.tileX, completed.tileY, completed.direction);
        if (heldDirectionRef.current) {
          const started = beginTileFluidStep(motion, heldDirectionRef.current, {
            width: previewMap?.width ?? 1,
            height: previewMap?.height ?? 1,
            isBlocked: (x, y) => isBlocked(previewMap, x, y),
          }, playerTilesPerSecond);
          if (!started) {
            faceDirection(heldDirectionRef.current);
          }
        }
      }
      setMotionView({ ...motion });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [previewMap, setPlayerPose, faceDirection, isBlocked, playerTilesPerSecond]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <PlaytestControls onMove={movePreviewPlayer} onRestart={restart} />
        <GamePreview
          playerX={motionView.tileX}
          playerY={motionView.tileY}
          visualX={motionView.visualX}
          visualY={motionView.visualY}
          direction={motionView.direction}
          moving={motionView.moving}
          motionElapsed={motionView.elapsed}
          currentMap={state.currentMap}
        />
        <RuntimeStateInspector state={state} />
      </div>
      <RuntimeBridgePanel />
      <LogsPanel logs={logs} />
    </div>
  );
}
