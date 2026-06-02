import { Copy, FolderOpen, RefreshCw, TerminalSquare } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

interface RuntimeLogPanelProps {
  available: boolean;
  unavailableReason?: string | null;
  diagnosticsDir?: string | null;
  logPath?: string | null;
  content?: string;
  error?: string | null;
  truncated?: boolean;
  loading?: boolean;
  onRefresh: () => void;
  onCopy: () => void;
  onOpenFolder: () => void;
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

export function RuntimeLogPanel({
  available,
  unavailableReason,
  diagnosticsDir,
  logPath,
  content = '',
  error,
  truncated = false,
  loading = false,
  onRefresh,
  onCopy,
  onOpenFolder,
}: RuntimeLogPanelProps) {
  if (!available) {
    return (
      <div className="h-full px-4 py-3 text-[12px] text-gray-600">
        <div className="font-semibold text-gray-800 mb-1">Native runtime logs unavailable</div>
        <div>{unavailableReason ?? 'Run inside the Tauri desktop shell to read native runtime logs.'}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-w-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-gray-700">Runtime Log</div>
          <div className="text-[11px] text-gray-500 font-mono truncate">
            {logPath ? basename(logPath) : 'No runtime log yet'}
          </div>
          {diagnosticsDir && (
            <div className="text-[11px] text-gray-500 truncate">
              Diagnostics folder:{' '}
              <span className="font-mono text-gray-600">{diagnosticsDir}</span>
            </div>
          )}
        </div>
        {truncated && (
          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
            Showing the latest 256 KiB
          </span>
        )}
        <button
          type="button"
          title="Refresh log"
          onClick={onRefresh}
          className="w-7 h-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center cursor-pointer"
        >
          <RefreshCw size={13} />
        </button>
        <button
          type="button"
          title="Copy log text"
          onClick={onCopy}
          disabled={!content}
          className={`w-7 h-7 rounded border border-gray-200 flex items-center justify-center ${
            content
              ? 'text-gray-600 hover:bg-gray-50 cursor-pointer'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          title="Open log folder"
          onClick={onOpenFolder}
          className="w-7 h-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center cursor-pointer"
        >
          <FolderOpen size={13} />
        </button>
      </div>
      {error && <div className="px-4 py-2 text-[11px] text-red-600 bg-red-50 border-b border-red-100">{error}</div>}
      {!loading && !content && !error ? (
        <div className="flex-1 p-3">
          <EmptyState
            compact
            icon={<TerminalSquare size={15} />}
            title="No runtime log yet"
            detail="Launch a playtest to create the first native log. Use Refresh after the runtime exits or while it is running."
          />
        </div>
      ) : (
        <pre className="flex-1 overflow-auto px-4 py-2 text-[11px] leading-5 text-gray-700 font-mono whitespace-pre-wrap bg-white">
          {loading && !content ? 'Loading runtime log...' : content || 'No runtime log output yet.'}
        </pre>
      )}
    </div>
  );
}
