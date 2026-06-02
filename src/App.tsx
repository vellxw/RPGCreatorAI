import { useEffect, useReducer, useState } from 'react';
import { TopToolbar } from './components/layout/TopToolbar';
import { Sidebar } from './components/layout/Sidebar';
import { MainEditorScreen } from './screens/MainEditorScreen';
import { EventEditorScreen } from './screens/EventEditorScreen';
import { DatabaseScreen } from './screens/DatabaseScreen';
import { PlaytestScreen } from './screens/PlaytestScreen';
import { ProjectStartupScreen } from './components/project/ProjectStartupScreen';
import {
  ProjectContext,
  initialProjectStoreState,
  projectReducer,
} from './stores/projectStore';
import { EditorContext, editorReducer, initialEditorState } from './stores/editorStore';
import { getProjectDataAdapter, isDesktopShell } from './adapters/adapterFactory';
import {
  performCreateProject,
  performImport,
  performOpenProject,
} from './stores/saveActions';
import { findDuplicatePlacement, isEditableTarget } from './utils/eventEditing';

export default function App() {
  const [projectState, projectDispatch] = useReducer(projectReducer, initialProjectStoreState);
  const [editorState, editorDispatch] = useReducer(editorReducer, initialEditorState);
  const [loaded, setLoaded] = useState(false);
  const [showStartup, setShowStartup] = useState(true);
  const [startupStatus, setStartupStatus] = useState<string | null>(null);

  // Load project once via the active adapter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const adapter = getProjectDataAdapter();
      const data = await adapter.loadProject();
      if (cancelled) return;
      projectDispatch({ type: 'LOAD_PROJECT', payload: data });
      setLoaded(true);
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
    return (
      <div className="flex items-center justify-center h-screen text-gray-500 text-sm">
        Loading project…
      </div>
    );
  }

  const desktop = isDesktopShell();

  const handleStartupOpen = async () => {
    const outcome = await performOpenProject(projectDispatch);
    if (outcome.cancelled) return;
    if (!outcome.success) {
      setStartupStatus(`Open failed: ${outcome.error ?? 'unknown error'}`);
      return;
    }
    setShowStartup(false);
  };

  const handleStartupCreate = async (title: string) => {
    const outcome = await performCreateProject(projectDispatch, { title });
    if (outcome.cancelled) return;
    if (!outcome.success) {
      setStartupStatus(`Create failed: ${outcome.error ?? 'unknown error'}`);
      return;
    }
    setShowStartup(false);
  };

  const handleStartupImport = async (file: File) => {
    const result = await performImport(file, projectDispatch);
    if (!result.success) {
      setStartupStatus(`Import failed: ${result.error ?? 'unknown error'}`);
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
    playtest: <PlaytestScreen />,
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
