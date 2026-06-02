import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

export interface RuntimeStateSnapshot {
  frameNumber: number;
  mapId: string;
  player: {
    x: number;
    y: number;
    direction: string;
  };
  gold: number;
  party: string[];
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  selfSwitches: Record<string, boolean>;
  inventory: Record<string, number>;
  active: {
    dialogue: boolean;
    menu: boolean;
    shop: boolean;
    battle: boolean;
  };
  runningEventIds: string[];
}

interface RuntimeStatePanelProps {
  available: boolean;
  unavailableReason?: string | null;
  snapshotText?: string;
  snapshotPath?: string | null;
  error?: string | null;
  loading?: boolean;
  truncated?: boolean;
  onRefresh?: () => void;
}

function readRecord<T>(value: unknown): Record<string, T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, T>;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function parseRuntimeStateSnapshot(text: string): RuntimeStateSnapshot | null {
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const player = readRecord<unknown>(parsed.player);
    const active = readRecord<unknown>(parsed.active);
    const frameNumber = Number(parsed.frameNumber);
    return {
      frameNumber: Number.isFinite(frameNumber) ? frameNumber : 0,
      mapId: typeof parsed.mapId === 'string' ? parsed.mapId : '',
      player: {
        x: Number(player.x) || 0,
        y: Number(player.y) || 0,
        direction: typeof player.direction === 'string' ? player.direction : 'down',
      },
      gold: Number(parsed.gold) || 0,
      party: readStringArray(parsed.party),
      switches: readRecord<boolean>(parsed.switches),
      variables: readRecord<number>(parsed.variables),
      selfSwitches: readRecord<boolean>(parsed.selfSwitches),
      inventory: readRecord<number>(parsed.inventory),
      active: {
        dialogue: active.dialogue === true,
        menu: active.menu === true,
        shop: active.shop === true,
        battle: active.battle === true,
      },
      runningEventIds: readStringArray(parsed.runningEventIds),
    };
  } catch {
    return null;
  }
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function KeyValueList({ values }: { values: Record<string, string | number | boolean> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return <span className="text-gray-400">None</span>;
  }
  return (
    <div className="space-y-1">
      {entries.slice(0, 6).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="font-mono text-gray-600 truncate">{key}</span>
          <span className="font-mono text-gray-900">{String(value)}</span>
        </div>
      ))}
      {entries.length > 6 && <div className="text-gray-400">+{entries.length - 6} more</div>}
    </div>
  );
}

export function RuntimeStatePanel({
  available,
  unavailableReason,
  snapshotText = '',
  snapshotPath,
  error,
  loading = false,
  truncated = false,
  onRefresh,
}: RuntimeStatePanelProps) {
  if (!available) {
    return (
      <div className="h-full px-4 py-3 text-[12px] text-gray-600">
        <div className="font-semibold text-gray-800 mb-1">Native runtime state unavailable</div>
        <div>{unavailableReason ?? 'Run inside the Tauri desktop shell to read native runtime state snapshots.'}</div>
      </div>
    );
  }

  const snapshot = parseRuntimeStateSnapshot(snapshotText);

  return (
    <div className="h-full flex flex-col min-w-0 bg-white">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        <Activity size={13} className="text-emerald-600" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-gray-700">Native Runtime State</div>
          <div className="text-[11px] text-gray-500 font-mono truncate">
            {snapshotPath ? basename(snapshotPath) : 'No snapshot yet'}
          </div>
        </div>
        {truncated && (
          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
            Showing latest snapshot tail
          </span>
        )}
        {onRefresh && (
          <button
            type="button"
            title="Refresh runtime state"
            onClick={onRefresh}
            className="w-7 h-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center cursor-pointer"
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>
      {error && (
        <div className="px-4 py-2 text-[11px] text-red-600 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}
      {!snapshot ? (
        <div className="h-full p-3">
          {loading ? (
            <div className="px-1 py-1 text-[12px] text-gray-500">Loading native runtime state...</div>
          ) : (
            <EmptyState
              compact
              icon={<Activity size={15} />}
              title="No runtime state snapshot yet"
              detail="Launch the runtime or Refresh after a playtest is running to inspect the latest native state snapshot."
            />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-4 py-3 text-[11px] text-gray-700">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <div className="text-gray-400">Frame</div>
              <div className="font-mono text-gray-900">Frame {snapshot.frameNumber}</div>
            </div>
            <div>
              <div className="text-gray-400">Map</div>
              <div className="font-mono text-gray-900">{snapshot.mapId || '-'}</div>
            </div>
            <div>
              <div className="text-gray-400">Player</div>
              <div className="font-mono text-gray-900">{snapshot.player.x}, {snapshot.player.y}</div>
            </div>
            <div>
              <div className="text-gray-400">Gold</div>
              <div className="font-mono text-gray-900">{snapshot.gold}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <section>
              <div className="font-semibold text-gray-600 mb-1">Active</div>
              <KeyValueList values={snapshot.active} />
            </section>
            <section>
              <div className="font-semibold text-gray-600 mb-1">Switches</div>
              <KeyValueList values={snapshot.switches} />
            </section>
            <section>
              <div className="font-semibold text-gray-600 mb-1">Variables</div>
              <KeyValueList values={snapshot.variables} />
            </section>
            <section>
              <div className="font-semibold text-gray-600 mb-1">Inventory</div>
              <KeyValueList values={snapshot.inventory} />
            </section>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-4">
            <section>
              <div className="font-semibold text-gray-600 mb-1">Party</div>
              <div className="font-mono">{snapshot.party.length ? snapshot.party.join(', ') : 'None'}</div>
            </section>
            <section>
              <div className="font-semibold text-gray-600 mb-1">Running Events</div>
              {snapshot.runningEventIds.length ? (
                <div className="font-mono space-y-1">
                  {snapshot.runningEventIds.map(id => <div key={id}>{id}</div>)}
                </div>
              ) : (
                <div className="text-gray-400">None</div>
              )}
            </section>
          </div>
        </div>
      )}
      {snapshotText && !snapshot && (
        <div className="px-4 py-2 text-[11px] text-amber-700 bg-amber-50 border-t border-amber-100 flex items-center gap-1">
          <AlertTriangle size={12} />
          Snapshot JSON could not be parsed.
        </div>
      )}
    </div>
  );
}
