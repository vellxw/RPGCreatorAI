import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EditorContext,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from '../../../stores/editorStore';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';
import { Sidebar } from '../Sidebar';
import { TopToolbar } from '../TopToolbar';

function renderWithEditor(ui: React.ReactNode, editorState: EditorState = initialEditorState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const editorDispatch = vi.fn<(action: EditorAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <EditorContext.Provider value={{ state: editorState, dispatch: editorDispatch }}>
        {ui}
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

function renderToolbar(editorState: EditorState, projectState: ProjectStoreState = initialProjectStoreState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const editorDispatch = vi.fn<(action: EditorAction) => void>();
  const projectDispatch = vi.fn<(action: ProjectAction) => void>();

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

describe('Primary navigation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('shows only implemented primary workspaces in the sidebar', () => {
    const view = renderWithEditor(<Sidebar />);
    const buttons = Array.from(view.container.querySelectorAll('button'));
    const labels = buttons.map(button => button.textContent?.trim()).filter(Boolean);

    expect(labels).toEqual(['Maps', 'Events', 'Database', 'Assets', 'Playtest', 'Settings']);
    expect(view.container.textContent).not.toContain('Project');
    expect(view.container.textContent).not.toContain('Dialogue');

    act(() => {
      buttons.find(button => button.textContent?.includes('Assets'))?.click();
    });
    expect(view.editorDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', screen: 'assets' });

    act(() => {
      buttons.find(button => button.textContent?.includes('Playtest'))?.click();
    });
    expect(view.editorDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', screen: 'playtest' });

    act(() => {
      buttons.find(button => button.textContent?.includes('Settings'))?.click();
    });
    expect(view.editorDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', screen: 'settings' });

    view.unmount();
  });

  it('uses real navigation controls for event breadcrumbs and no inert settings action', () => {
    const view = renderToolbar({ ...initialEditorState, activeScreen: 'events' });
    const buttons = Array.from(view.container.querySelectorAll('button'));
    const mapsCrumb = buttons.find(button =>
      button.textContent?.trim() === 'Maps',
    );
    const unlabeledButtons = buttons.filter(button => {
      const text = button.textContent?.trim();
      return !text && !button.getAttribute('aria-label') && !button.getAttribute('title');
    });

    expect(mapsCrumb).toBeDefined();
    expect(mapsCrumb?.className).toContain('h-6');
    expect(buttons.find(button => button.textContent?.trim() === 'Events')?.className).toContain('h-6');
    expect(unlabeledButtons).toHaveLength(0);

    act(() => {
      mapsCrumb?.click();
    });
    expect(view.editorDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', screen: 'editor' });

    view.unmount();
  });
});
