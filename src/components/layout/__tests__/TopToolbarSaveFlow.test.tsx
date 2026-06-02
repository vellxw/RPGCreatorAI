import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProjectDataAdapter, _resetAdaptersForTest } from '../../../adapters/adapterFactory';
import { initialEditorState, EditorContext, type EditorAction } from '../../../stores/editorStore';
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

function renderToolbar(projectState: ProjectStoreState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const projectDispatch = vi.fn<(action: ProjectAction) => void>();
  const editorDispatch = vi.fn<(action: EditorAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <EditorContext.Provider value={{ state: initialEditorState, dispatch: editorDispatch }}>
        <ProjectContext.Provider value={{ state: projectState, dispatch: projectDispatch }}>
          <TopToolbar />
        </ProjectContext.Provider>
      </EditorContext.Provider>,
    );
  });

  return {
    container,
    projectDispatch,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(candidate =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Missing button ${label}`);
  act(() => {
    (button as HTMLButtonElement).click();
  });
}

describe('TopToolbar save flow feedback', () => {
  beforeEach(() => {
    _resetAdaptersForTest();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    _resetAdaptersForTest();
    vi.restoreAllMocks();
  });

  it('shows persistent validation-blocked feedback from Save', async () => {
    const invalidState = projectReducer(await loadedProjectState(), {
      type: 'UPDATE_PROJECT_META',
      changes: { startMapId: 'missing_map' },
    });
    const view = renderToolbar(invalidState);

    clickButton(view.container, 'Save');
    await act(async () => {
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain('Save blocked by');
    expect(view.container.textContent).toContain('Open Validation');
    expect(view.projectDispatch).toHaveBeenCalledWith({ type: 'VALIDATE' });

    view.unmount();
  });

  it('shows persistent adapter-failure feedback from Save without marking saved', async () => {
    const adapter = getProjectDataAdapter();
    vi.spyOn(adapter, 'saveAll').mockResolvedValueOnce({ success: false, error: 'disk full' });
    const dirtyState = projectReducer(await loadedProjectState(), {
      type: 'UPDATE_PROJECT_META',
      changes: { title: 'Dirty Project' },
    });
    const view = renderToolbar(dirtyState);

    clickButton(view.container, 'Save');
    await act(async () => {
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain('Save failed');
    expect(view.container.textContent).toContain('Disk full while writing project files');
    expect(view.projectDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'MARK_SAVED' }));

    view.unmount();
  });

  it('lets the editor toolbar run validation without saving', async () => {
    const dirtyState = projectReducer(await loadedProjectState(), {
      type: 'UPDATE_PROJECT_META',
      changes: { title: 'Validate Only' },
    });
    const view = renderToolbar(dirtyState);

    clickButton(view.container, 'Validate');
    await act(async () => {
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain('Validation passed');
    expect(view.container.textContent).toContain('Save will re-check before writing');
    expect(view.projectDispatch).toHaveBeenCalledWith({ type: 'VALIDATE' });
    expect(view.projectDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'MARK_SAVED' }));

    view.unmount();
  });

  it('includes the asset catalog when reporting validation feedback', async () => {
    const baseState = await loadedProjectState();
    const withGeneratedTilesetAsset = projectReducer(baseState, {
      type: 'ADD_ASSET_CATALOG_ENTRY',
      asset: {
        id: 'generated_toolbar_tiles',
        name: 'Generated Toolbar Tiles',
        kind: 'tileset',
        path: 'assets/generated/tilesets/generated_toolbar_tiles.png',
        source: 'generated',
        width: 32,
        height: 32,
        generated: {
          prompt: 'offline toolbar validation fixture',
          tool: 'ai-tileset-generation-workflow',
          createdAt: '2026-06-02T18:30:00.000Z',
          promptTemplateId: 'tileset-rpg-map-v1',
          promptTemplateVersion: 1,
          promptTemplateKind: 'tileset',
          providerId: 'local',
          modelId: 'offline-image-mock',
        },
      },
    });
    const dirtyState = projectReducer(withGeneratedTilesetAsset, {
      type: 'UPDATE_TILESET_DATABASE',
      tilesets: {
        tilesets: [
          ...withGeneratedTilesetAsset.databases.tilesets.tilesets,
          {
            id: 'generated-toolbar-tiles',
            name: 'Generated Toolbar Tiles',
            tileSize: 32,
            tiles: [
              {
                id: 0,
                name: 'Tile 0',
                asset: 'generated_toolbar_tiles',
                group: 'A',
                passability: 'passable',
                priority: 0,
              },
            ],
          },
        ],
      },
    });
    const view = renderToolbar(dirtyState);

    clickButton(view.container, 'Validate');
    await act(async () => {
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain('Validation passed');
    expect(view.container.textContent).not.toContain('blocking error');
    expect(view.projectDispatch).toHaveBeenCalledWith({ type: 'VALIDATE' });

    view.unmount();
  });
});
