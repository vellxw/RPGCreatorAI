import { useEffect, useRef, useState } from 'react';
import {
  Save,
  Play,
  Download,
  Sparkles,
  Undo2,
  Redo2,
  CheckCircle2,
  Square,
  RotateCcw,
  Upload,
  ExternalLink,
  Settings,
  FolderOpen,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useEditor } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import {
  performSave,
  performExport,
  performImport,
  performOpenProject,
  performOpenRecent,
} from '../../stores/saveActions';
import { isDesktopShell } from '../../adapters/adapterFactory';
import { SaveIndicator } from './SaveIndicator';
import type { Screen } from '../../types/project';

export function TopToolbar() {
  const { state, dispatch } = useEditor();
  const { state: projectState, dispatch: projectDispatch } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const desktop = isDesktopShell();

  useEffect(() => {
    if (!desktop || !window.rpgBridge) return;
    window.rpgBridge.config.getRecents().then(setRecents).catch(() => undefined);
  }, [desktop]);

  const showStatus = (text: string) => {
    setStatusMessage(text);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleOpen = async () => {
    const outcome = await performOpenProject(projectDispatch);
    if (outcome.cancelled) return;
    if (!outcome.success) {
      showStatus(`Open failed: ${outcome.error ?? 'unknown error'}`);
      return;
    }
    showStatus(`Opened ${outcome.root}`);
    if (window.rpgBridge) {
      window.rpgBridge.config.getRecents().then(setRecents).catch(() => undefined);
    }
  };

  const handleOpenRecent = async (root: string) => {
    setRecentsOpen(false);
    const outcome = await performOpenRecent(root, projectDispatch);
    if (!outcome.success) {
      showStatus(`Open failed: ${outcome.error ?? 'unknown error'}`);
      return;
    }
    showStatus(`Opened ${root}`);
  };

  const handleSave = async () => {
    const outcome = await performSave(projectState, projectDispatch, { exportAfterSave: false });
    if (!outcome.success) {
      showStatus(`Save blocked: ${outcome.errors[0] ?? 'validation error'}`);
      return;
    }
    showStatus(
      outcome.exported
        ? 'Saved (in-memory) and exported to file'
        : `Saved via ${outcome.adapterName}`,
    );
  };

  const handleExport = async () => {
    await performExport(projectState);
    showStatus('Exported project bundle');
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await performImport(file, projectDispatch);
    if (result.success) {
      showStatus(`Imported ${file.name}`);
    } else {
      showStatus(`Import failed: ${result.error}`);
    }
    e.target.value = '';
  };

  const renderEditorToolbar = () => (
    <>
      <div className="flex items-center gap-2">
        <Undo2 size={16} className="text-gray-400 cursor-not-allowed" />
        <Redo2 size={16} className="text-gray-400 cursor-not-allowed" />
      </div>
      <SaveIndicator dirty={projectState.dirty} errorCount={projectState.errors.length} />
      <div className="flex items-center gap-2">
        {desktop && (
          <>
            <Button icon={<FolderOpen size={14} />} onClick={handleOpen}>
              Open
            </Button>
            <div className="relative">
              <Button
                icon={<Clock size={14} />}
                onClick={() => setRecentsOpen(o => !o)}
              >
                Recent
              </Button>
              {recentsOpen && recents.length > 0 && (
                <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {recents.map(r => (
                    <button
                      key={r}
                      onClick={() => handleOpenRecent(r)}
                      className="w-full text-left px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 truncate cursor-pointer"
                      title={r}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
              {recentsOpen && recents.length === 0 && (
                <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50 px-3 py-2 text-[12px] text-gray-500">
                  No recent projects.
                </div>
              )}
            </div>
          </>
        )}
        <Button icon={<Save size={14} />} onClick={handleSave}>
          Save
        </Button>
        <Button
          icon={<Play size={14} />}
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'playtest' })}
        >
          Playtest
        </Button>
        <Button variant="primary" icon={<Download size={14} />} onClick={handleExport}>
          Export
        </Button>
        <Button icon={<Upload size={14} />} onClick={handleImportClick}>
          Import
        </Button>
        <Button icon={<Sparkles size={14} />}>AI Assist</Button>
      </div>
    </>
  );

  const renderEventToolbar = () => (
    <>
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <span className="hover:text-indigo-600 cursor-pointer">Maps</span>
        <span>/</span>
        <span className="hover:text-indigo-600 cursor-pointer">Town</span>
        <span>/</span>
        <span className="hover:text-indigo-600 cursor-pointer">Events</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">{state.selectedEvent?.id || 'Select event'}</span>
      </div>
      <SaveIndicator dirty={projectState.dirty} errorCount={projectState.errors.length} />
      <div className="flex items-center gap-2">
        <Button icon={<Save size={14} />} onClick={handleSave}>
          Save
        </Button>
        <Button icon={<Play size={14} />}>Playtest Event</Button>
        <Button
          variant="primary"
          icon={<CheckCircle2 size={14} />}
          onClick={() => projectDispatch({ type: 'VALIDATE' })}
        >
          Validate
        </Button>
        <Button icon={<Sparkles size={14} />}>AI Assist</Button>
      </div>
    </>
  );

  const renderAIToolbar = () => (
    <>
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <span>Settings</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">AI Tools</span>
      </div>
      <div className="flex items-center gap-2">
        <Button icon={<Save size={14} />}>Save</Button>
        <Button icon={<Play size={14} />}>Test Connections</Button>
        <Button icon={<Settings size={14} />}>Usage Limits</Button>
        <Button icon={<ExternalLink size={14} />}>Documentation</Button>
      </div>
    </>
  );

  const renderPlaytestToolbar = () => (
    <>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-gray-800 font-medium">Playtest: &quot;{projectState.project.title}&quot;</span>
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="danger" icon={<Square size={12} />}>
          Stop
        </Button>
        <Button icon={<RotateCcw size={14} />}>Restart</Button>
        <Button icon={<Save size={14} />}>Save State</Button>
        <Button icon={<Upload size={14} />}>Load State</Button>
        <Button icon={<ExternalLink size={14} />}>Open in Runtime</Button>
        <Button variant="primary" icon={<Sparkles size={14} />}>
          AI Debug Assist
        </Button>
      </div>
    </>
  );

  const renderDatabaseToolbar = () => (
    <>
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <span>Project</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">Database</span>
      </div>
      <SaveIndicator dirty={projectState.dirty} errorCount={projectState.errors.length} />
      <div className="flex items-center gap-2">
        <Button icon={<Save size={14} />} onClick={handleSave}>
          Save
        </Button>
        <Button
          variant="primary"
          icon={<CheckCircle2 size={14} />}
          onClick={() => projectDispatch({ type: 'VALIDATE' })}
        >
          Validate
        </Button>
      </div>
    </>
  );

  const toolbarContent: Record<Screen, () => React.ReactNode> = {
    editor: renderEditorToolbar,
    events: renderEventToolbar,
    database: renderDatabaseToolbar,
    'ai-tools': renderAIToolbar,
    playtest: renderPlaytestToolbar,
  };

  return (
    <header className="h-12 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-50 relative">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <span className="text-white text-[12px] font-bold">⚔</span>
          </div>
          <span className="font-semibold text-[14px] text-gray-800">RPGCreatorAI</span>
        </div>
        {state.activeScreen === 'editor' && (
          <div className="flex items-center gap-1 text-[13px] text-gray-600 border-l border-gray-200 pl-4">
            <span>{projectState.project.title || 'Untitled Project'}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-400">
              <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">{toolbarContent[state.activeScreen]()}</div>
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200">
        <Settings size={14} className="text-gray-500" />
      </div>

      {/* hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* transient status toast */}
      {statusMessage && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 bg-gray-900 text-white text-[12px] rounded-md shadow-lg z-50">
          {statusMessage}
        </div>
      )}
    </header>
  );
}
