import { useEffect, useRef, useState } from 'react';
import {
  Save,
  Play,
  Download,
  Undo2,
  Redo2,
  CheckCircle2,
  Upload,
  FolderOpen,
  Clock,
  PackageCheck,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useEditor } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import {
  performSave,
  performExport,
  performRuntimeBundleExport,
  performImport,
  performOpenProject,
  performOpenRecent,
} from '../../stores/saveActions';
import { isDesktopShell } from '../../adapters/adapterFactory';
import { SaveIndicator } from './SaveIndicator';
import { decideSaveAndPlaytest } from '../../firstRun/saveAndPlaytest';
import type { Screen } from '../../types/project';
import type { PlaytestSessionMode } from '../../adapters/types';
import { uiAssets } from '../../assets/generated/assetCatalog';
import { validateProject } from '../../validation/validateProject';

type SaveFeedback = {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  detail: string;
};

export function TopToolbar() {
  const { state, dispatch } = useEditor();
  const { state: projectState, dispatch: projectDispatch } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
    if (isSaving) return;
    setStatusMessage(null);
    setIsSaving(true);
    try {
      const outcome = await performSave(projectState, projectDispatch, { exportAfterSave: false });
      if (!outcome.success && outcome.blockedByValidation) {
        setSaveFeedback({
          tone: 'danger',
          title: `Save blocked by ${outcome.validationErrorCount} validation error${outcome.validationErrorCount === 1 ? '' : 's'}`,
          detail: `${outcome.errors[0] ?? 'Fix the validation error.'} ${outcome.recovery}`,
        });
        return;
      }
      if (!outcome.success) {
        setSaveFeedback({
          tone: 'danger',
          title: 'Save failed',
          detail: `${outcome.errors[0] ?? 'Unknown write error'}. ${outcome.recovery}`,
        });
        return;
      }
      setSaveFeedback({
        tone: outcome.validationWarningCount > 0 ? 'warning' : 'success',
        title: outcome.exported
          ? 'Saved in memory and exported'
          : `Saved via ${outcome.adapterName}`,
        detail: outcome.recovery,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndPlaytest = async () => {
    if (isSaving) return;
    setStatusMessage(null);
    setIsSaving(true);
    try {
      const outcome = await performSave(projectState, projectDispatch, { exportAfterSave: false });
      const decision = decideSaveAndPlaytest({
        dirty: outcome.success ? false : projectState.dirty,
        errorCount: outcome.validationErrorCount,
        warningCount: outcome.validationWarningCount,
        runtimeAvailable: desktop,
      });

      if (!outcome.success && outcome.blockedByValidation) {
        setSaveFeedback({
          tone: 'danger',
          title: decision.message,
          detail: `${outcome.errors[0] ?? ''} ${outcome.recovery}`.trim(),
        });
        return;
      }
      if (!outcome.success) {
        setSaveFeedback({
          tone: 'danger',
          title: 'Save failed before playtest',
          detail: `${outcome.errors[0] ?? 'Unknown write error'}. ${outcome.recovery}`,
        });
        return;
      }

      setSaveFeedback({
        tone: decision.warningCount > 0 ? 'warning' : 'success',
        title: decision.message,
        detail:
          decision.kind === 'saved-and-routed'
            ? 'In-editor playtest view is now open.'
            : decision.kind === 'saved-and-playtested'
              ? 'The native runtime received the project and the playtest view is open.'
              : outcome.recovery,
      });
      dispatch({ type: 'SET_SCREEN', screen: 'playtest' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = () => {
    const report = validateProject({
      project: projectState.project,
      maps: projectState.maps,
      items: projectState.items,
      databases: projectState.databases,
      assets: projectState.assets,
    });
    projectDispatch({ type: 'VALIDATE' });
    setStatusMessage(null);
    if (report.errors.length > 0) {
      setSaveFeedback({
        tone: 'danger',
        title: `Validation found ${report.errors.length} blocking error${report.errors.length === 1 ? '' : 's'}`,
        detail: 'Fix the blocking items in Validation, then Save again.',
      });
      return;
    }
    if (report.warnings.length > 0) {
      setSaveFeedback({
        tone: 'warning',
        title: `Validation found ${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}`,
        detail: 'Warnings are review items and do not block Save.',
      });
      return;
    }
    setSaveFeedback({
      tone: 'success',
      title: 'Validation passed',
      detail: 'Save will re-check before writing project files.',
    });
  };

  const handleExport = async () => {
    await performExport(projectState);
    showStatus('Exported project bundle');
  };

  const handleRuntimeBundleExport = () => {
    const result = performRuntimeBundleExport(projectState);
    if (!result.ok) {
      setSaveFeedback({
        tone: 'danger',
        title: `Runtime export blocked by ${result.errors.length} compiler error${result.errors.length === 1 ? '' : 's'}`,
        detail: result.errors[0]?.message ?? 'Review the project and asset paths before exporting.',
      });
      return;
    }
    setSaveFeedback({
      tone: result.warnings.length > 0 ? 'warning' : 'success',
      title: 'GameBundle v1 exported',
      detail: result.warnings.length > 0
        ? `${result.warnings.length} runtime warning${result.warnings.length === 1 ? '' : 's'} should be reviewed.`
        : 'The renderer-neutral runtime payload is ready for Phaser or another runtime host.',
    });
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
        <button
          type="button"
          onClick={() => projectDispatch({ type: 'UNDO' })}
          disabled={!projectState.canUndo}
          title="Undo"
          className={`p-1 rounded ${
            projectState.canUndo
              ? 'text-gray-600 hover:bg-gray-100 cursor-pointer'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => projectDispatch({ type: 'REDO' })}
          disabled={!projectState.canRedo}
          title="Redo"
          className={`p-1 rounded ${
            projectState.canRedo
              ? 'text-gray-600 hover:bg-gray-100 cursor-pointer'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <Redo2 size={16} />
        </button>
      </div>
      <SaveIndicator
        dirty={projectState.dirty}
        errorCount={projectState.errors.length}
        warningCount={projectState.warnings.length}
        saving={isSaving}
      />
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
        <Button
          icon={<Save size={14} />}
          onClick={handleSave}
          disabled={isSaving}
          title={isSaving ? 'Save is already writing project data' : 'Validate and save project data'}
        >
          Save
        </Button>
        <Button
          icon={<Play size={14} />}
          onClick={handleSaveAndPlaytest}
          disabled={isSaving}
          data-testid="save-and-playtest"
          title={
            isSaving
              ? 'Save is already writing project data'
              : 'Save the project, then open the playtest view'
          }
        >
          Save & Playtest
        </Button>
        <Button icon={<CheckCircle2 size={14} />} onClick={handleValidate}>
          Validate
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
        <Button icon={<PackageCheck size={14} />} onClick={handleRuntimeBundleExport}>
          GameBundle
        </Button>
        <Button icon={<Upload size={14} />} onClick={handleImportClick}>
          Import
        </Button>
      </div>
    </>
  );

  const renderEventToolbar = () => {
    const mapId = state.selectedEventMapId ?? state.selectedMapId;
    const map = projectState.maps[mapId];
    const mapLabel = map?.displayName ?? map?.name ?? mapId;

    return (
      <>
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'editor' })}
          className="inline-flex h-6 items-center rounded px-1 text-gray-500 hover:text-indigo-600 cursor-pointer"
        >
          Maps
        </button>
        <span>/</span>
        <span>{mapLabel}</span>
        <span>/</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'events' })}
          className="inline-flex h-6 items-center rounded px-1 text-gray-500 hover:text-indigo-600 cursor-pointer"
        >
          Events
        </button>
        <span>/</span>
        <span className="text-gray-800 font-medium">{state.selectedEvent?.id || 'Select event'}</span>
      </div>
      <SaveIndicator
        dirty={projectState.dirty}
        errorCount={projectState.errors.length}
        warningCount={projectState.warnings.length}
        saving={isSaving}
      />
      <div className="flex items-center gap-2">
        <Button
          icon={<Save size={14} />}
          onClick={handleSave}
          disabled={isSaving}
          title={isSaving ? 'Save is already writing project data' : 'Validate and save project data'}
        >
          Save
        </Button>
        <Button
          variant="primary"
          icon={<CheckCircle2 size={14} />}
          onClick={handleValidate}
        >
          Validate
        </Button>
      </div>
      </>
    );
  };

  const renderPlaytestToolbar = () => {
    const playtestModes: Array<{ mode: PlaytestSessionMode; label: string; disabled?: boolean }> = [
      { mode: 'projectStart', label: 'Project Start' },
      { mode: 'currentMap', label: 'Current Map', disabled: !projectState.maps[state.selectedMapId] },
      {
        mode: 'selectedEvent',
        label: 'Selected Event',
        disabled: !state.selectedEvent,
      },
    ];
    return (
      <>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-gray-800 font-medium">Playtest: &quot;{projectState.project.title}&quot;</span>
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
      <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5">
        {playtestModes.map(option => (
          <button
            key={option.mode}
            type="button"
            disabled={option.disabled}
            onClick={() => dispatch({ type: 'SET_PLAYTEST_MODE', mode: option.mode })}
            className={`h-7 px-2.5 text-[11px] rounded cursor-pointer ${
              state.playtestMode === option.mode
                ? 'bg-white text-indigo-600 shadow-sm'
                : option.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      </>
    );
  };

  const renderDatabaseToolbar = () => (
    <>
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <span>Project</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">Database</span>
      </div>
      <SaveIndicator
        dirty={projectState.dirty}
        errorCount={projectState.errors.length}
        warningCount={projectState.warnings.length}
        saving={isSaving}
      />
      <div className="flex items-center gap-2">
        <Button
          icon={<Save size={14} />}
          onClick={handleSave}
          disabled={isSaving}
          title={isSaving ? 'Save is already writing project data' : 'Validate and save project data'}
        >
          Save
        </Button>
        <Button
          variant="primary"
          icon={<CheckCircle2 size={14} />}
          onClick={handleValidate}
        >
          Validate
        </Button>
      </div>
    </>
  );

  const renderAssetsToolbar = () => (
    <>
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <span>Project</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">Assets</span>
      </div>
      <SaveIndicator
        dirty={projectState.dirty}
        errorCount={projectState.errors.length}
        warningCount={projectState.warnings.length}
        saving={isSaving}
      />
      <div className="flex items-center gap-2">
        <Button
          icon={<Save size={14} />}
          onClick={handleSave}
          disabled={isSaving}
          title={isSaving ? 'Save is already writing project data' : 'Validate and save project data'}
        >
          Save
        </Button>
        <Button
          variant="primary"
          icon={<CheckCircle2 size={14} />}
          onClick={handleValidate}
        >
          Validate
        </Button>
      </div>
    </>
  );

  const renderSettingsToolbar = () => (
    <>
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <span>Project</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">Settings</span>
      </div>
      <SaveIndicator
        dirty={projectState.dirty}
        errorCount={projectState.errors.length}
        warningCount={projectState.warnings.length}
        saving={isSaving}
      />
      <div className="flex items-center gap-2">
        <Button
          icon={<Save size={14} />}
          onClick={handleSave}
          disabled={isSaving}
          title={isSaving ? 'Save is already writing project data' : 'Validate and save project data'}
        >
          Save
        </Button>
        <Button
          variant="primary"
          icon={<CheckCircle2 size={14} />}
          onClick={handleValidate}
        >
          Validate
        </Button>
      </div>
    </>
  );

  const renderAIStudioToolbar = () => (
    <div className="flex items-center gap-2" data-testid="ai-studio-toolbar">
      <span className="text-[12px] text-gray-500">AI Studio</span>
    </div>
  );

  const toolbarContent: Record<Screen, () => React.ReactNode> = {
    editor: renderEditorToolbar,
    events: renderEventToolbar,
    database: renderDatabaseToolbar,
    'ai-studio': renderAIStudioToolbar,
    assets: renderAssetsToolbar,
    playtest: renderPlaytestToolbar,
    settings: renderSettingsToolbar,
  };

  return (
    <header className="h-12 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-50 relative">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <img src={uiAssets.battle} alt="" className="w-5 h-5" />
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
      {saveFeedback && (
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[min(680px,calc(100vw-32px))] rounded-md border px-3 py-2 text-[12px] shadow-lg z-50 ${
            saveFeedback.tone === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : saveFeedback.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <p className="font-semibold">{saveFeedback.title}</p>
          <p>{saveFeedback.detail}</p>
        </div>
      )}
    </header>
  );
}
