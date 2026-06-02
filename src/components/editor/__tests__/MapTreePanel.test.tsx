import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorContext, initialEditorState, type EditorAction } from '../../../stores/editorStore';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';
import type { MapData, MapReference } from '../../../types/project';
import { MapTreePanel } from '../MapTreePanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mapData(id: string, name: string): MapData {
  return {
    schemaVersion: 1,
    id,
    name,
    width: 10,
    height: 8,
    tileSize: 32,
    layers: [{ name: 'ground', type: 'visual', tiles: new Array(80).fill(1) }],
    events: [],
  };
}

function projectState(refs: MapReference[]): ProjectStoreState {
  const names: Record<string, string> = {
    town: 'Town',
    forest: 'Forest',
    cave: 'Cave',
  };
  return {
    ...initialProjectStoreState,
    project: {
      schemaVersion: 1,
      title: 'Tree Test',
      startMapId: 'town',
      startPosition: { x: 0, y: 0, direction: 'down' },
      database: { items: 'data/database/items.json' },
      maps: refs,
    },
    maps: Object.fromEntries(refs.map(ref => [ref.id, mapData(ref.id, names[ref.id] ?? ref.id)])),
  };
}

function renderMapTree(state: ProjectStoreState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const projectDispatch = vi.fn<(action: ProjectAction) => void>();
  const editorDispatch = vi.fn<(action: EditorAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <EditorContext.Provider value={{ state: initialEditorState, dispatch: editorDispatch }}>
        <ProjectContext.Provider value={{ state, dispatch: projectDispatch }}>
          <MapTreePanel />
        </ProjectContext.Provider>
      </EditorContext.Provider>,
    );
  });

  return {
    container,
    projectDispatch,
    editorDispatch,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function iconButtonsWithoutAccessibleName(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter(button => {
    const text = button.textContent?.trim();
    return !text && !button.getAttribute('aria-label');
  });
}

describe('MapTreePanel workflow polish', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('expands a collapsed parent before creating a selected child map', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Forest Path');
    const view = renderMapTree(projectState([
      { id: 'town', path: 'data/maps/town.json', parentId: null, order: 0, expanded: false },
    ]));

    act(() => {
      view.container.querySelector<HTMLButtonElement>('button[aria-label="Create child map under Town"]')?.click();
    });

    expect(view.projectDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_MAP_REFERENCE',
      mapId: 'town',
      changes: { expanded: true },
    });
    expect(view.projectDispatch).toHaveBeenCalledWith({
      type: 'CREATE_MAP',
      mapId: 'forest_path',
      name: 'Forest Path',
      parentId: 'town',
      width: 20,
      height: 15,
    });
    expect(view.editorDispatch).toHaveBeenCalledWith({ type: 'SELECT_MAP', mapId: 'forest_path' });

    view.unmount();
  });

  it('prevents start-map deletion before asking for confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = renderMapTree(projectState([
      { id: 'town', path: 'data/maps/town.json', parentId: null, order: 0, expanded: true },
    ]));
    const deleteButton = view.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Start map Town cannot be deleted"]',
    );

    expect(deleteButton?.disabled).toBe(true);

    act(() => {
      deleteButton?.click();
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(view.projectDispatch).not.toHaveBeenCalledWith({ type: 'REMOVE_MAP', mapId: 'town' });

    view.unmount();
  });

  it('warns that child maps stay in the project when deleting a parent map', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = renderMapTree(projectState([
      { id: 'town', path: 'data/maps/town.json', parentId: null, order: 0, expanded: true },
      { id: 'forest', path: 'data/maps/forest.json', parentId: null, order: 1, expanded: true },
      { id: 'cave', path: 'data/maps/cave.json', parentId: 'forest', order: 0, expanded: true },
    ]));
    const deleteButton = view.container.querySelector<HTMLButtonElement>('button[aria-label="Delete map Forest"]');

    act(() => {
      deleteButton?.click();
    });

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 child map will stay in the project and move to root'));
    expect(view.projectDispatch).toHaveBeenCalledWith({ type: 'REMOVE_MAP', mapId: 'forest' });

    view.unmount();
  });

  it('gives every icon-only map-tree action an accessible name', () => {
    const view = renderMapTree(projectState([
      { id: 'town', path: 'data/maps/town.json', parentId: null, order: 0, expanded: true },
      { id: 'forest', path: 'data/maps/forest.json', parentId: null, order: 1, expanded: true },
    ]));

    expect(iconButtonsWithoutAccessibleName(view.container)).toHaveLength(0);

    view.unmount();
  });
});
