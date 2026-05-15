import { useReducer } from 'react';
import { TopToolbar } from './components/layout/TopToolbar';
import { Sidebar } from './components/layout/Sidebar';
import { MainEditorScreen } from './screens/MainEditorScreen';
import { EventEditorScreen } from './screens/EventEditorScreen';
import { AIToolsScreen } from './screens/AIToolsScreen';
import { PlaytestScreen } from './screens/PlaytestScreen';
import { ProjectContext, loadProjectData } from './stores/projectStore';
import { EditorContext, editorReducer, initialEditorState } from './stores/editorStore';

export default function App() {
  const projectData = loadProjectData();
  const [editorState, dispatch] = useReducer(editorReducer, initialEditorState);

  const screens = {
    editor: <MainEditorScreen />,
    events: <EventEditorScreen />,
    'ai-tools': <AIToolsScreen />,
    playtest: <PlaytestScreen />,
  };

  return (
    <ProjectContext.Provider value={projectData}>
      <EditorContext.Provider value={{ state: editorState, dispatch }}>
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
