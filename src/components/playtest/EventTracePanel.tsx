import { AlertTriangle, GitBranch, ListFilter } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '../ui/EmptyState';

export interface EventTraceRow {
  sequence: number;
  sourceType: string;
  mapId: string;
  eventId: string;
  commonEventId: string;
  commandPath: string;
  commandType: string;
  action: string;
  result: string;
}

type TraceFilter = 'all' | 'mapEvent' | 'commonEvent' | 'warning' | 'branch';

const tracePrefix = '[TRACE] ';

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseEventTraceRows(logText: string): EventTraceRow[] {
  return logText
    .split(/\r?\n/)
    .flatMap(line => {
      const start = line.indexOf(tracePrefix);
      if (start < 0) return [];
      const payload = line.slice(start + tracePrefix.length).trim();
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        const sequence = Number(parsed.sequence);
        if (!Number.isFinite(sequence)) return [];
        return [{
          sequence,
          sourceType: readString(parsed.sourceType),
          mapId: readString(parsed.mapId),
          eventId: readString(parsed.eventId),
          commonEventId: readString(parsed.commonEventId),
          commandPath: readString(parsed.commandPath),
          commandType: readString(parsed.commandType),
          action: readString(parsed.action),
          result: readString(parsed.result),
        }];
      } catch {
        return [];
      }
    });
}

function rowSource(row: EventTraceRow): string {
  if (row.sourceType === 'commonEvent') return `Common ${row.commonEventId || '-'}`;
  if (row.sourceType === 'mapEvent') return `Map ${row.mapId || '-'} / ${row.eventId || '-'}`;
  return row.sourceType || 'Runtime';
}

function matchesFilter(row: EventTraceRow, filter: TraceFilter): boolean {
  switch (filter) {
    case 'mapEvent':
      return row.sourceType === 'mapEvent';
    case 'commonEvent':
      return row.sourceType === 'commonEvent';
    case 'warning':
      return row.action === 'warning' || row.action === 'error';
    case 'branch':
      return row.action === 'branch';
    case 'all':
    default:
      return true;
  }
}

export function EventTracePanel({ logText }: { logText: string }) {
  const [filter, setFilter] = useState<TraceFilter>('all');
  const rows = useMemo(() => parseEventTraceRows(logText), [logText]);
  const filteredRows = useMemo(
    () => rows.filter(row => matchesFilter(row, filter)),
    [rows, filter],
  );

  const filters: Array<{ id: TraceFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'mapEvent', label: 'Map' },
    { id: 'commonEvent', label: 'Common' },
    { id: 'warning', label: 'Warning' },
    { id: 'branch', label: 'Branch' },
  ];

  return (
    <div className="h-full flex flex-col min-w-0 bg-white">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        <GitBranch size={13} className="text-indigo-500" />
        <div className="text-[12px] font-semibold text-gray-700">
          {rows.length} trace {rows.length === 1 ? 'row' : 'rows'}
        </div>
        <div className="ml-2 flex items-center gap-1">
          <ListFilter size={12} className="text-gray-400" />
          {filters.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`h-6 px-2 rounded border text-[11px] cursor-pointer ${
                filter === item.id
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="h-full p-3">
          <EmptyState
            compact
            icon={<GitBranch size={15} />}
            title="No event trace rows yet"
            detail="Launch the native runtime, then trigger a map event or common event to produce deterministic trace rows."
          />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="h-full px-4 py-3 text-[12px] text-gray-500">
          No trace rows match the selected filter.
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="min-w-full text-[11px]">
            <thead className="sticky top-0 bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left font-medium px-3 py-1.5 w-12">#</th>
                <th className="text-left font-medium px-3 py-1.5">Source</th>
                <th className="text-left font-medium px-3 py-1.5">Path</th>
                <th className="text-left font-medium px-3 py-1.5">Command</th>
                <th className="text-left font-medium px-3 py-1.5">Action</th>
                <th className="text-left font-medium px-3 py-1.5">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-gray-700">
              {filteredRows.map(row => (
                <tr key={`${row.sequence}-${row.commandPath}-${row.action}`}>
                  <td className="px-3 py-1.5 text-gray-400">{row.sequence}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{rowSource(row)}</td>
                  <td className="px-3 py-1.5 text-gray-500">{row.commandPath || '-'}</td>
                  <td className="px-3 py-1.5">{row.commandType || '-'}</td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                      row.action === 'warning' || row.action === 'error'
                        ? 'bg-amber-50 text-amber-700'
                        : row.action === 'branch'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-50 text-gray-700'
                    }`}>
                      {(row.action === 'warning' || row.action === 'error') && <AlertTriangle size={10} />}
                      {row.action || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">{row.result || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
