import { memo, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { usePlaytestStore } from '../stores/playtestStore';
import { useProject, useProjectStore } from '../stores/projectStore';
import { Badge } from '../components/ui/Badge';
import {
  CheckCircle2,
  AlertTriangle,
  Gamepad2,
  RotateCcw,
  House,
  Lightbulb,
  Zap,
  ClipboardList,
} from 'lucide-react';
import { getRuntimeLaunchAdapter, getFileSystemAdapter, getPlaytestSessionAdapter } from '../adapters/adapterFactory';
import { useEditor } from '../stores/editorStore';
import { validateProject } from '../validation/validateProject';
import { RuntimeLogPanel } from '../components/playtest/RuntimeLogPanel';
import { EventTracePanel } from '../components/playtest/EventTracePanel';
import { RuntimeStatePanel } from '../components/playtest/RuntimeStatePanel';
import {
  RuntimeLaunchFeedback,
  playtestModeLabel,
  type RuntimeLaunchFeedbackState,
} from '../components/playtest/RuntimeLaunchFeedback';
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
import type { RuntimeLaunchAdapter, RuntimeStatus } from '../adapters/types';

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
          native runtime. Native launch is handled by the runtime bridge panel.
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
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="inline-flex items-center gap-2">
          <Zap size={14} className="text-amber-500" />
          <span className="text-[13px] font-semibold text-gray-700">Editor State Inspector</span>
        </span>
        <Badge variant="muted">simulated</Badge>
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

function RuntimeBridgePanel({
  adapter,
  sessionAdapter,
  runtimeStatus,
  setRuntimeStatus,
}: {
  adapter: RuntimeLaunchAdapter;
  sessionAdapter: ReturnType<typeof getPlaytestSessionAdapter>;
  runtimeStatus: RuntimeStatus;
  setRuntimeStatus: Dispatch<SetStateAction<RuntimeStatus>>;
}) {
  const { state: projectState, dispatch: projectDispatch } = useProjectStore();
  const { state: editorState } = useEditor();
  const [feedback, setFeedback] = useState<RuntimeLaunchFeedbackState | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

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
    if (isLaunching || runtimeStatus === 'running') return;
    const modeLabel = playtestModeLabel(editorState.playtestMode);
    const fsAdapter = getFileSystemAdapter();
    const projectRoot = fsAdapter?.getProjectRoot();
    if (!projectRoot) {
      setFeedback({
        tone: 'warning',
        title: `${modeLabel} launch needs an open project`,
        detail: 'Open or create a project folder before launching the native runtime.',
      });
      return;
    }
    setIsLaunching(true);
    setFeedback({
      tone: 'loading',
      title: `Preparing ${modeLabel} playtest`,
      detail: 'Validating project data and writing a temporary playtest session.',
    });
    const validation = validateProject({
      project: projectState.project,
      maps: projectState.maps,
      items: projectState.items,
      databases: projectState.databases,
    });
    projectDispatch({ type: 'VALIDATE' });
    if (validation.errors.length > 0) {
      setFeedback({
        tone: 'error',
        title: `${modeLabel} launch blocked by validation`,
        detail: `${validation.errors[0].message} Fix validation errors before launching the runtime.`,
      });
      setIsLaunching(false);
      return;
    }
    try {
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
        setFeedback({
          tone: 'error',
          title: `${modeLabel} session was not created`,
          detail: session.error ?? 'The desktop shell did not return a temporary playtest session path.',
        });
        return;
      }
      const result = await adapter.launch(session.sessionRoot, { executableSearchRoot: projectRoot });
      if (result.success) {
        setFeedback({
          tone: 'success',
          title: `${modeLabel} runtime launched`,
          detail: result.pid
            ? `PID ${result.pid} is running from a temporary playtest session.`
            : 'The runtime accepted the temporary playtest session.',
          sessionRoot: session.sessionRoot,
          diagnosticsHint: 'Use Runtime Log, Event Trace, and Runtime State for launch output.',
        });
      } else {
        setFeedback({
          tone: 'error',
          title: `${modeLabel} launch failed`,
          detail: result.error ?? 'The desktop shell returned a failed runtime launch result.',
          sessionRoot: session.sessionRoot,
          diagnosticsHint: 'Open Runtime Log after a successful launch; failed process starts are reported here.',
        });
      }
      setRuntimeStatus(adapter.getStatus());
    } finally {
      setIsLaunching(false);
    }
  };

  const handleKill = async () => {
    await adapter.kill();
    setFeedback({
      tone: 'info',
      title: 'Runtime stopped',
      detail: 'Runtime bridge is ready for another playtest launch.',
    });
    setRuntimeStatus(adapter.getStatus());
  };

  const available = adapter.canLaunch() && sessionAdapter.canCreateSession();
  const unavailableReason = adapter.getUnavailableReason() ?? sessionAdapter.getUnavailableReason();
  const visibleFeedback = feedback ?? (!available
    ? {
        tone: 'warning' as const,
        title: 'Native runtime launch unavailable',
        detail: unavailableReason ?? 'Run inside the Tauri desktop shell to launch Project Start.',
      }
    : null);
  const modeLabel = playtestModeLabel(editorState.playtestMode);
  const launchDisabled = !available || runtimeStatus === 'running' || isLaunching;

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
          {!available && unavailableReason && (
            <span className="text-[11px] text-gray-500 italic">- {unavailableReason}</span>
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
            disabled={launchDisabled}
            className={`px-3 py-1.5 text-[12px] rounded-md inline-flex items-center gap-1.5 ${
              !launchDisabled
                ? 'bg-indigo-500 text-white hover:bg-indigo-600 cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Gamepad2 size={13} />
            {isLaunching ? `Launching ${modeLabel}` : `Launch ${modeLabel}`}
          </button>
        </div>
      </div>
      <RuntimeLaunchFeedback feedback={visibleFeedback} />
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

function RuntimeLogContainer({
  adapter,
  runtimeStatus,
  onContentChange,
}: {
  adapter: RuntimeLaunchAdapter;
  runtimeStatus: RuntimeStatus;
  onContentChange?: (content: string) => void;
}) {
  const [content, setContent] = useState('');
  const [logPath, setLogPath] = useState<string | null>(null);
  const [diagnosticsDir, setDiagnosticsDir] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = adapter.canLaunch();

  const refresh = useCallback(async () => {
    if (!available) return;
    setLoading(true);
    try {
      const diagnostics = await adapter.getDiagnostics();
      if (diagnostics.success) {
        setDiagnosticsDir(diagnostics.diagnosticsDir ?? null);
      }
      const info = await adapter.getLatestLog();
      if (!info.success || !info.path) {
        setLogPath(null);
        setContent('');
        onContentChange?.('');
        setTruncated(false);
        setError(info.error ?? 'No runtime log has been created yet.');
        return;
      }
      setLogPath(info.path);
      const tail = await adapter.readLatestLogTail(256 * 1024);
      if (!tail.success) {
        setContent('');
        onContentChange?.('');
        setTruncated(false);
        setError(tail.error ?? 'Could not read runtime log.');
        return;
      }
      setContent(tail.content ?? '');
      onContentChange?.(tail.content ?? '');
      setTruncated(!!tail.truncated);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [adapter, available, onContentChange]);

  useEffect(() => {
    refresh();
    if (runtimeStatus !== 'running') return;
    const id = window.setInterval(refresh, 1000);
    return () => window.clearInterval(id);
  }, [refresh, runtimeStatus]);

  const copyLog = useCallback(async () => {
    if (!content) return;
    await navigator.clipboard?.writeText(content);
  }, [content]);

  const openLogFolder = useCallback(async () => {
    const result = await adapter.openLogFolder();
    if (!result.success) setError(result.error ?? 'Could not open runtime log folder.');
  }, [adapter]);

  return (
    <RuntimeLogPanel
      available={available}
      unavailableReason={adapter.getUnavailableReason()}
      diagnosticsDir={diagnosticsDir}
      logPath={logPath}
      content={content}
      error={error}
      truncated={truncated}
      loading={loading}
      onRefresh={refresh}
      onCopy={copyLog}
      onOpenFolder={openLogFolder}
    />
  );
}

function LogsPanel({
  logs,
  runtimeAdapter,
  runtimeStatus,
}: {
  logs: ReturnType<typeof usePlaytestStore>['logs'];
  runtimeAdapter: RuntimeLaunchAdapter;
  runtimeStatus: RuntimeStatus;
}) {
  const [activeTab, setActiveTab] = useState<'editor' | 'runtime' | 'validation' | 'trace' | 'state'>('editor');
  const [runtimeLogText, setRuntimeLogText] = useState('');
  const [runtimeSnapshotText, setRuntimeSnapshotText] = useState('');
  const [runtimeSnapshotPath, setRuntimeSnapshotPath] = useState<string | null>(null);
  const [runtimeSnapshotError, setRuntimeSnapshotError] = useState<string | null>(null);
  const [runtimeSnapshotLoading, setRuntimeSnapshotLoading] = useState(false);
  const [runtimeSnapshotTruncated, setRuntimeSnapshotTruncated] = useState(false);
  const levelColors = {
    INFO: 'text-blue-600 bg-blue-50',
    WARN: 'text-amber-600 bg-amber-50',
    ERROR: 'text-red-600 bg-red-50',
  };

  const refreshTraceLog = useCallback(async () => {
    if (!runtimeAdapter.canLaunch()) {
      setRuntimeLogText('');
      return;
    }
    const info = await runtimeAdapter.getLatestLog();
    if (!info.success || !info.path) {
      setRuntimeLogText('');
      return;
    }
    const tail = await runtimeAdapter.readLatestLogTail(256 * 1024);
    setRuntimeLogText(tail.success ? tail.content ?? '' : '');
  }, [runtimeAdapter]);

  useEffect(() => {
    refreshTraceLog();
    if (runtimeStatus !== 'running') return;
    const id = window.setInterval(refreshTraceLog, 1000);
    return () => window.clearInterval(id);
  }, [refreshTraceLog, runtimeStatus]);

  const refreshRuntimeSnapshot = useCallback(async () => {
    if (!runtimeAdapter.canLaunch()) {
      setRuntimeSnapshotText('');
      setRuntimeSnapshotPath(null);
      setRuntimeSnapshotError(runtimeAdapter.getUnavailableReason());
      setRuntimeSnapshotTruncated(false);
      return;
    }
    setRuntimeSnapshotLoading(true);
    try {
      const snapshot = await runtimeAdapter.readLatestSnapshot(128 * 1024);
      if (!snapshot.success) {
        setRuntimeSnapshotText('');
        setRuntimeSnapshotPath(snapshot.path ?? null);
        setRuntimeSnapshotError(snapshot.error ?? 'No native runtime state snapshot has been created yet.');
        setRuntimeSnapshotTruncated(false);
        return;
      }
      setRuntimeSnapshotText(snapshot.content ?? '');
      setRuntimeSnapshotPath(snapshot.path ?? null);
      setRuntimeSnapshotError(null);
      setRuntimeSnapshotTruncated(!!snapshot.truncated);
    } finally {
      setRuntimeSnapshotLoading(false);
    }
  }, [runtimeAdapter]);

  useEffect(() => {
    refreshRuntimeSnapshot();
    if (runtimeStatus !== 'running') return;
    const id = window.setInterval(refreshRuntimeSnapshot, 1000);
    return () => window.clearInterval(id);
  }, [refreshRuntimeSnapshot, runtimeStatus]);

  return (
    <div className="h-[180px] flex-shrink-0 bg-white border-t border-gray-200 flex">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100">
          <button
            onClick={() => setActiveTab('editor')}
            className={`text-[12px] font-medium pb-1 cursor-pointer ${activeTab === 'editor' ? 'text-indigo-600 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="inline-flex items-center gap-1">
              <ClipboardList size={12} />
              Editor Preview
            </span>
          </button>
          <button
            onClick={() => setActiveTab('runtime')}
            className={`text-[12px] pb-1 cursor-pointer ${activeTab === 'runtime' ? 'text-indigo-600 border-b-2 border-indigo-500 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Runtime Log
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`text-[12px] pb-1 cursor-pointer ${activeTab === 'validation' ? 'text-indigo-600 border-b-2 border-indigo-500 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ✓ Validation <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">0</span>
          </button>
          <button
            onClick={() => setActiveTab('trace')}
            className={`text-[12px] pb-1 cursor-pointer ${activeTab === 'trace' ? 'text-indigo-600 border-b-2 border-indigo-500 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Event Trace
          </button>
          <button
            onClick={() => setActiveTab('state')}
            className={`text-[12px] pb-1 cursor-pointer ${activeTab === 'state' ? 'text-indigo-600 border-b-2 border-indigo-500 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Runtime State
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-green-500" />
            <span className="text-[11px] text-green-600 font-medium">Editor preview running</span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {activeTab === 'editor' && (
            <div className="h-full overflow-y-auto px-4 py-2 space-y-1 font-mono">
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
          )}
          {activeTab === 'runtime' && (
            <RuntimeLogContainer
              adapter={runtimeAdapter}
              runtimeStatus={runtimeStatus}
              onContentChange={setRuntimeLogText}
            />
          )}
          {activeTab === 'validation' && (
            <div className="h-full px-4 py-3 text-[12px] text-gray-500">No validation errors in the current preview session.</div>
          )}
          {activeTab === 'trace' && <EventTracePanel logText={runtimeLogText} />}
          {activeTab === 'state' && (
            <RuntimeStatePanel
              available={runtimeAdapter.canLaunch()}
              unavailableReason={runtimeAdapter.getUnavailableReason()}
              snapshotText={runtimeSnapshotText}
              snapshotPath={runtimeSnapshotPath}
              error={runtimeSnapshotError}
              loading={runtimeSnapshotLoading}
              truncated={runtimeSnapshotTruncated}
              onRefresh={refreshRuntimeSnapshot}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function PlaytestScreen() {
  const project = useProject();
  const runtimeAdapter = useMemo(() => getRuntimeLaunchAdapter(), []);
  const playtestSessionAdapter = useMemo(() => getPlaytestSessionAdapter(), []);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>(runtimeAdapter.getStatus());
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
      <RuntimeBridgePanel
        adapter={runtimeAdapter}
        sessionAdapter={playtestSessionAdapter}
        runtimeStatus={runtimeStatus}
        setRuntimeStatus={setRuntimeStatus}
      />
      <LogsPanel logs={logs} runtimeAdapter={runtimeAdapter} runtimeStatus={runtimeStatus} />
    </div>
  );
}
