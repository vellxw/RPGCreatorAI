import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetAdaptersForTest, getProjectDataAdapter } from '../../../adapters/adapterFactory';
import {
  EditorContext,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from '../../../stores/editorStore';
import {
  initialProjectStoreState,
  ProjectContext,
  projectReducer,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';
import { TopToolbar } from '../TopToolbar';

async function loadedProjectState() {
  const adapter = getProjectDataAdapter();
  return projectReducer(initialProjectStoreState, {
    type: 'LOAD_PROJECT',
    payload: await adapter.loadProject(),
  });
}

function renderToolbar(projectState: ProjectStoreState, editorState: EditorState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const projectDispatch = vi.fn<(action: ProjectAction) => void>();
  const editorDispatch = vi.fn<(action: EditorAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <EditorContext.Provider value={{ state: editorState, dispatch: editorDispatch }}>
        <ProjectContext.Provider value={{ state: projectState, dispatch: projectDispatch }}>
          <TopToolbar />
        </ProjectContext.Provider>
      </EditorContext.Provider>,
    );
  });

  return {
    container,
    editorDispatch,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('TopToolbar playtest modes', () => {
  beforeEach(() => {
    _resetAdaptersForTest();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    _resetAdaptersForTest();
    vi.restoreAllMocks();
  });

  it('disables Current Map when the selected map is not loaded', async () => {
    const projectState = await loadedProjectState();
    const editorState: EditorState = {
      ...initialEditorState,
      activeScreen: 'playtest',
      selectedMapId: 'missing_map',
    };
    const view = renderToolbar(projectState, editorState);
    const currentMap = Array.from(view.container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Current Map'),
    ) as HTMLButtonElement | undefined;

    expect(currentMap).toBeDefined();
    expect(currentMap?.disabled).toBe(true);
    act(() => {
      currentMap?.click();
    });
    expect(view.editorDispatch).not.toHaveBeenCalledWith({ type: 'SET_PLAYTEST_MODE', mode: 'currentMap' });

    view.unmount();
  });

  it('disables Selected Event when no event is selected', async () => {
    const projectState = await loadedProjectState();
    const editorState: EditorState = {
      ...initialEditorState,
      activeScreen: 'playtest',
      selectedEvent: null,
      selectedEventMapId: null,
    };
    const view = renderToolbar(projectState, editorState);
    const selectedEvent = Array.from(view.container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Selected Event'),
    ) as HTMLButtonElement | undefined;

    expect(selectedEvent).toBeDefined();
    expect(selectedEvent?.disabled).toBe(true);
    act(() => {
      selectedEvent?.click();
    });
    expect(view.editorDispatch).not.toHaveBeenCalledWith({ type: 'SET_PLAYTEST_MODE', mode: 'selectedEvent' });

    view.unmount();
  });
});
