import { useEffect, useState } from 'react';
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
import { getRuntimeLaunchAdapter, getFileSystemAdapter } from '../adapters/adapterFactory';
import { performSave } from '../stores/saveActions';
import { editorAssets, eventAssets, gameAssets, uiAssets } from '../assets/generated/assetCatalog';
import { normalizeVisualProfile } from '../visual/visualProfile';
import { computeCameraFrame } from '../visual/viewport';
import { isSupportedVisualTile, isVoidVisualTile } from '../visual/tileCatalog';

function PlaytestControls({
  onMove,
  onRestart,
}: {
  onMove: (dx: number, dy: number) => void;
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
            onClick={() => onMove(0, -1)}
            className="w-8 h-8 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-[11px] font-bold text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            ↑
          </button>
          <div />
          <button
            onClick={() => onMove(-1, 0)}
            className="w-8 h-8 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-[11px] font-bold text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            ←
          </button>
          <button
            onClick={() => onMove(0, 1)}
            className="w-8 h-8 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-[11px] font-bold text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            ↓
          </button>
          <button
            onClick={() => onMove(1, 0)}
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

function GamePreview({
  playerX,
  playerY,
  currentMap,
}: {
  playerX: number;
  playerY: number;
  currentMap: string;
}) {
  const project = useProject();
  const map = project.maps[currentMap];
  if (!map) return null;

  const profile = normalizeVisualProfile(project.project.visualProfile);
  const tileSize = map.tileSize || profile.tileSize;
  const mapPixelSize = { width: map.width * tileSize, height: map.height * tileSize };
  const cameraFrame = computeCameraFrame({
    viewport: profile.baseResolution,
    map: mapPixelSize,
    focus: {
      x: playerX * tileSize + tileSize / 2,
      y: playerY * tileSize + tileSize / 2,
    },
    cameraMode: profile.cameraMode,
  });
  const previewGroundAssets: Record<number, string> = {
    1: gameAssets.grass,
    2: gameAssets.path,
    3: gameAssets.water,
    4: gameAssets.snow,
    5: gameAssets.tree,
    6: gameAssets.interiorFloor,
    7: gameAssets.interiorWall,
  };

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
          {map.layers.find(l => l.name === 'ground')?.tiles.map((tile, i) => {
            const x = (i % map.width) * tileSize;
            const y = Math.floor(i / map.width) * tileSize;
            if (isVoidVisualTile(tile) || !isSupportedVisualTile(tile)) {
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
                href={previewGroundAssets[tile] ?? gameAssets.voidWarning}
                style={{ imageRendering: 'pixelated' }}
              />
            );
          })}

          {map.events.map(event => (
            <g key={event.id}>
              <image
                x={event.x * tileSize + 2}
                y={event.y * tileSize + 2}
                width={tileSize - 4}
                height={tileSize - 4}
                href={eventAssets[event.type]}
                style={{ imageRendering: 'pixelated' }}
              />
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
          ))}

          <image
            x={playerX * tileSize + 2}
            y={playerY * tileSize + 2}
            width={tileSize - 4}
            height={tileSize - 4}
            href={gameAssets.player}
            style={{ imageRendering: 'pixelated' }}
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

        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 cursor-pointer">
          <span className="font-mono text-[10px]">{'{}'}</span>
          View Full State (JSON)
        </button>
      </div>
    </div>
  );
}

function RuntimeBridgePanel() {
  const adapter = getRuntimeLaunchAdapter();
  const { state: projectState, dispatch: projectDispatch } = useProjectStore();
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
    if (projectState.dirty) {
      const save = await performSave(projectState, projectDispatch);
      if (!save.success) {
        setStatus(`Launch blocked: ${save.errors[0] ?? 'save failed'}`);
        return;
      }
    }
    const result = await adapter.launch(projectRoot);
    setStatus(result.success ? `Runtime launched (pid ${result.pid})` : `Launch failed: ${result.error}`);
    setRuntimeStatus(adapter.getStatus());
  };

  const handleKill = async () => {
    await adapter.kill();
    setStatus('Runtime stopped');
    setRuntimeStatus(adapter.getStatus());
  };

  const available = adapter.canLaunch();

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
          {!available && adapter.getUnavailableReason() && (
            <span className="text-[11px] text-gray-500 italic">— {adapter.getUnavailableReason()}</span>
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
  const { state, logs, movePlayer, restart } = usePlaytestStore({
    currentMap: project.project.startMapId,
    playerX: project.project.startPosition.x,
    playerY: project.project.startPosition.y,
    direction: project.project.startPosition.direction,
  });
  const previewMap = project.maps[state.currentMap];
  const movePreviewPlayer = (dx: number, dy: number) => {
    movePlayer(dx, dy, previewMap?.width ?? 1, previewMap?.height ?? 1);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <PlaytestControls onMove={movePreviewPlayer} onRestart={restart} />
        <GamePreview playerX={state.playerX} playerY={state.playerY} currentMap={state.currentMap} />
        <RuntimeStateInspector state={state} />
      </div>
      <RuntimeBridgePanel />
      <LogsPanel logs={logs} />
    </div>
  );
}
