import { lazy, Suspense, useEffect, useReducer, useState } from 'react';
import { TopToolbar } from './components/layout/TopToolbar';
import { Sidebar } from './components/layout/Sidebar';
import { MainEditorScreen } from './screens/MainEditorScreen';
import { EventEditorScreen } from './screens/EventEditorScreen';
import { DatabaseScreen } from './screens/DatabaseScreen';
import { AssetsScreen } from './screens/AssetsScreen';
import { PlaytestScreen } from './screens/PlaytestScreen';
import { AppSplashShell } from './components/project/AppSplashShell';
import { ProjectStartupScreen } from './components/project/ProjectStartupScreen';
import {
  ProjectContext,
  initialProjectStoreState,
  projectReducer,
} from './stores/projectStore';
import { EditorContext, editorReducer, initialEditorState } from './stores/editorStore';
import {
  getProjectDataAdapter,
  getRuntimeLaunchAdapter,
  isDesktopShell,
} from './adapters/adapterFactory';
import type { RuntimeAvailabilityInfo } from './adapters/types';
import { getStartupPhase, type StartupPhaseId } from './startup/startupPhases';
import {
  formatProjectFolderError,
  performCreateProject,
  performImport,
  performOpenRecent,
  performOpenProject,
} from './stores/saveActions';
import { findDuplicatePlacement, isEditableTarget } from './utils/eventEditing';

const ProviderSettingsBoundary = lazy(() => import('./screens/ProviderSettingsBoundary'));

export function startupFailure(label: 'Open' | 'Create' | 'Import', error?: string): string {
  return `${label} failed: ${error ?? 'No details were returned. Try again, or use the bundled sample while you inspect the project file.'}`;
}

export function recentProjectRestoreFailure(root: string | null, error?: string): string {
  const target = root ? ` for ${root}` : '';
  const detail = error ?? 'No details were returned.';
  return `Recent project restore failed${target}: ${detail} Open Project Folder, Create Project, and the bundled sample are still available.`;
}

export function runtimeStartupAvailabilityMessage(info: RuntimeAvailabilityInfo): string {
  if (info.available) {
    return 'Native runtime ready. Playtest can launch after you enter the editor. No runtime process has been started.';
  }
  const detail = info.error ?? 'No runtime executable was reported.';
  const normalized = detail.toLowerCase().includes('native runtime unavailable')
    ? detail
    : `Native runtime unavailable: ${detail}`;
  return `${normalized} You can keep editing; build or locate the runtime before launching native playtests.`;
}

export default function App() {
  const [projectState, projectDispatch] = useReducer(projectReducer, initialProjectStoreState);
  const [editorState, editorDispatch] = useReducer(editorReducer, initialEditorState);
  const [loaded, setLoaded] = useState(false);
  const [startupPhase, setStartupPhase] = useState<StartupPhaseId>('app-shell');
  const [showStartup, setShowStartup] = useState(true);
  const [startupStatus, setStartupStatus] = useState<string | null>(null);
  const [runtimeStatusMessage, setRuntimeStatusMessage] = useState<string | null>(null);

  // Load project once via the active adapter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const adapter = getProjectDataAdapter();
        setStartupPhase('project-data');
        if (isDesktopShell() && window.rpgBridge) {
          let recentRoot: string | null = null;
          try {
            const recents = await window.rpgBridge.config.getRecents();
            if (cancelled) return;
            recentRoot = recents.find(root => root.trim().length > 0) ?? null;
          } catch (error) {
            if (cancelled) return;
            const message = error instanceof Error ? error.message : String(error);
            setStartupStatus(recentProjectRestoreFailure(null, formatProjectFolderError(message)));
          }

          if (recentRoot) {
            setStartupPhase('recent-project');
            const outcome = await performOpenRecent(recentRoot, projectDispatch);
            if (cancelled) return;
            if (outcome.success) {
              setStartupPhase('workspace-ready');
              setShowStartup(false);
              return;
            }
            setStartupStatus(recentProjectRestoreFailure(recentRoot, outcome.error));
          }
        }

        setStartupPhase('project-data');
        const data = await adapter.loadProject();
        if (cancelled) return;
        setStartupPhase('workspace-ready');
        projectDispatch({ type: 'LOAD_PROJECT', payload: data });
      } catch (error) {
        if (cancelled) return;
        setStartupPhase('workspace-ready');
        const message = error instanceof Error ? error.message : String(error);
        setStartupStatus(startupFailure('Open', message));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await getRuntimeLaunchAdapter().checkAvailability();
        if (!cancelled) setRuntimeStatusMessage(runtimeStartupAvailabilityMessage(info));
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setRuntimeStatusMessage(
          runtimeStartupAvailabilityMessage({
            available: false,
            status: 'unavailable',
            error: message,
          }),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Warn before unload when there are unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (projectState.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [projectState.dirty]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editorState.activeScreen !== 'editor' || isEditableTarget(e.target)) return;
      const modifier = e.ctrlKey || e.metaKey;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!modifier) return;
        e.preventDefault();
        projectDispatch({ type: 'UNDO' });
      } else if (
        e.key.toLowerCase() === 'y' ||
        (e.key.toLowerCase() === 'z' && e.shiftKey)
      ) {
        if (!modifier) return;
        e.preventDefault();
        projectDispatch({ type: 'REDO' });
      } else if (modifier && e.key.toLowerCase() === 'd') {
        const selected = editorState.selectedEvent;
        const mapId = editorState.selectedEventMapId;
        const map = mapId ? projectState.maps[mapId] : null;
        const freshEvent =
          selected && map ? map.events.find(event => event.id === selected.id) ?? null : null;
        if (!freshEvent || !map || !mapId) return;
        e.preventDefault();
        const { newId, x, y } = findDuplicatePlacement(map, freshEvent);
        projectDispatch({
          type: 'DUPLICATE_EVENT',
          mapId,
          eventId: freshEvent.id,
          newId,
          x,
          y,
        });
        editorDispatch({
          type: 'SELECT_EVENT',
          event: { ...freshEvent, id: newId, x, y },
          mapId,
        });
      } else if (e.key === 'Delete') {
        const selected = editorState.selectedEvent;
        const mapId = editorState.selectedEventMapId;
        const map = mapId ? projectState.maps[mapId] : null;
        const freshEvent =
          selected && map ? map.events.find(event => event.id === selected.id) ?? null : null;
        if (!freshEvent || !mapId) return;
        if (!window.confirm(`Delete event "${freshEvent.id}"?`)) return;
        e.preventDefault();
        projectDispatch({ type: 'REMOVE_EVENT', mapId, eventId: freshEvent.id });
        editorDispatch({ type: 'SELECT_EVENT', event: null, mapId: null });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorState, projectState.maps]);

  if (!loaded) {
    return <AppSplashShell phase={getStartupPhase(startupPhase)} />;
  }

  const desktop = isDesktopShell();

  const handleStartupOpen = async () => {
    const outcome = await performOpenProject(projectDispatch);
    if (outcome.cancelled) return;
    if (!outcome.success) {
      setStartupStatus(startupFailure('Open', outcome.error));
      return;
    }
    setShowStartup(false);
  };

  const handleStartupCreate = async (title: string) => {
    const outcome = await performCreateProject(projectDispatch, { title });
    if (outcome.cancelled) return;
    if (!outcome.success) {
      setStartupStatus(startupFailure('Create', outcome.error));
      return;
    }
    setShowStartup(false);
  };

  const handleStartupImport = async (file: File) => {
    const result = await performImport(file, projectDispatch);
    if (!result.success) {
      setStartupStatus(startupFailure('Import', result.error));
      return;
    }
    setShowStartup(false);
  };

  if (showStartup) {
    return (
      <ProjectContext.Provider value={{ state: projectState, dispatch: projectDispatch }}>
        <EditorContext.Provider value={{ state: editorState, dispatch: editorDispatch }}>
          <ProjectStartupScreen
            desktop={desktop}
            sampleTitle={projectState.project.title || 'bundled sample'}
            statusMessage={startupStatus}
            runtimeStatusMessage={runtimeStatusMessage}
            onUseSample={() => setShowStartup(false)}
            onOpenProject={handleStartupOpen}
            onCreateProject={handleStartupCreate}
            onImportProject={handleStartupImport}
          />
        </EditorContext.Provider>
      </ProjectContext.Provider>
    );
  }

  const screens: Record<typeof editorState.activeScreen, React.ReactNode> = {
    editor: <MainEditorScreen />,
    events: <EventEditorScreen />,
    database: <DatabaseScreen />,
    assets: <AssetsScreen />,
    playtest: <PlaytestScreen />,
    settings: (
      <Suspense
        fallback={
          <div className="flex-1 bg-[#f5f5f7] px-6 py-5 text-[13px] text-gray-600">
            Loading provider settings...
          </div>
        }
      >
        <ProviderSettingsBoundary />
      </Suspense>
    ),
  };

  return (
    <ProjectContext.Provider value={{ state: projectState, dispatch: projectDispatch }}>
      <EditorContext.Provider value={{ state: editorState, dispatch: editorDispatch }}>
        <div className="flex flex-col h-screen w-full bg-[#f5f5f7] overflow-hidden">
          <TopToolbar />
          <div className="flex-1 flex overflow-hidden">
            <Sidebar />
            {screens[editorState.activeScreen]}
          </div>
        </div>
      </EditorContext.Provider>
    </ProjectContext.Provider>
  );
}
