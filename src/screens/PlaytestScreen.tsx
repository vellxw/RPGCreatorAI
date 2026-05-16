import { useState } from 'react';
import { usePlaytestStore } from '../stores/playtestStore';
import { useProject } from '../stores/projectStore';
import { Badge } from '../components/ui/Badge';
import { ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getRuntimeLaunchAdapter } from '../adapters/adapterFactory';

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
        <span className="text-[12px]">🎮</span>
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
          <span>🔄</span> Restart Test
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer">
          <span>🏠</span> Spawn at Start
        </button>
      </div>

      <div className="mt-auto p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-[11px] text-blue-700">
          <span className="font-medium">💡 Tip:</span> The preview below is a simulated editor preview, not the
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

  const TILE = 28;
  const w = map.width * TILE;
  const h = map.height * TILE;

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

      <div className="relative">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="rounded shadow-2xl">
          {map.layers.find(l => l.type === 'collision')?.tiles.map((tile, i) => {
            const x = (i % map.width) * TILE;
            const y = Math.floor(i / map.width) * TILE;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={TILE}
                height={TILE}
                fill={tile === 9 ? '#3d6b2e' : '#5a9a42'}
                stroke="#4a8a35"
                strokeWidth="0.3"
              />
            );
          })}

          {map.events.map(event => (
            <g key={event.id}>
              <rect
                x={event.x * TILE + 3}
                y={event.y * TILE + 3}
                width={TILE - 6}
                height={TILE - 6}
                fill={event.type === 'npc' ? '#8b5cf6' : event.type === 'chest' ? '#f59e0b' : '#06b6d4'}
                rx="3"
                opacity="0.8"
              />
              {event.type === 'npc' && (
                <>
                  <rect
                    x={event.x * TILE - 8}
                    y={event.y * TILE - 16}
                    width={TILE + 16}
                    height={14}
                    fill="#1f2937"
                    rx="3"
                    opacity="0.85"
                  />
                  <text
                    x={event.x * TILE + TILE / 2}
                    y={event.y * TILE - 6}
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

          <rect
            x={playerX * TILE + 2}
            y={playerY * TILE + 2}
            width={TILE - 4}
            height={TILE - 4}
            fill="#3b82f6"
            rx="4"
          />
        </svg>
      </div>
    </div>
  );
}

function RuntimeStateInspector({ state }: { state: ReturnType<typeof usePlaytestStore>['state'] }) {
  return (
    <div className="w-[240px] flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[12px]">⚡</span>
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
                  <span className="text-[12px]">🧪</span>
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
  const [status, setStatus] = useState<string | null>(null);

  const handleLaunch = async () => {
    const result = await adapter.launch('data/project.json');
    setStatus(result.success ? `Runtime launched (pid ${result.pid})` : `Launch failed: ${result.error}`);
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
            Runtime bridge: <span className="font-mono">{adapter.getStatus()}</span>
          </span>
          {!available && adapter.getUnavailableReason() && (
            <span className="text-[11px] text-gray-500 italic">— {adapter.getUnavailableReason()}</span>
          )}
        </div>
        <button
          onClick={handleLaunch}
          disabled={!available}
          className={`px-3 py-1.5 text-[12px] rounded-md cursor-pointer ${
            available
              ? 'bg-indigo-500 text-white hover:bg-indigo-600'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Open in Runtime
        </button>
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
            📋 Logs
          </button>
          <button className="text-[12px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">
            ✓ Validation <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">0</span>
          </button>
          <button className="text-[12px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">📊 Event Trace</button>
          <button className="text-[12px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">🤖 AI Debug</button>
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
          <span className="text-[12px]">🤖</span>
          <span className="text-[13px] font-semibold text-gray-700">AI Debug Assist</span>
          <Badge variant="info">Beta</Badge>
        </div>
        <div className="space-y-2">
          {[
            { icon: '⚡', text: 'Explain why the player cannot move here' },
            { icon: '🔗', text: 'Find broken transfer events' },
            { icon: '💬', text: 'Generate missing dialogue' },
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
  const { state, logs, movePlayer, restart } = usePlaytestStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <PlaytestControls onMove={movePlayer} onRestart={restart} />
        <GamePreview playerX={state.playerX} playerY={state.playerY} currentMap={state.currentMap} />
        <RuntimeStateInspector state={state} />
      </div>
      <RuntimeBridgePanel />
      <LogsPanel logs={logs} />
    </div>
  );
}
