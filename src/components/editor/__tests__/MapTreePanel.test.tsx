import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeDatabases } from '../../../adapters/defaultDatabases';
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
    databases: mergeDatabases({
      tilesets: {
        tilesets: [
          {
            id: 'sample-town',
            name: 'Sample Town',
            tileSize: 32,
            tiles: [
              { id: 0, name: 'Transparent', asset: 'voidWarning', group: 'A', passability: 'blocked', priority: 0 },
              { id: 1, name: 'Grass', asset: 'grass', group: 'A', passability: 'passable', priority: 0 },
            ],
          },
        ],
      },
    }),
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

  it('keeps branch disclosure controls at stable icon-button dimensions', () => {
    const view = renderMapTree(projectState([
      { id: 'town', path: 'data/maps/town.json', parentId: null, order: 0, expanded: true },
      { id: 'forest', path: 'data/maps/forest.json', parentId: 'town', order: 0, expanded: true },
      { id: 'cave', path: 'data/maps/cave.json', parentId: 'forest', order: 0, expanded: true },
    ]));

    for (const name of ['Town', 'Forest', 'Cave']) {
      const control = view.container.querySelector<HTMLButtonElement>(
        `button[aria-label="Collapse map group ${name}"]`,
      );
      expect(control?.className).toContain('h-6');
      expect(control?.className).toContain('w-6');
    }

    view.unmount();
  });

  it('keeps selectable map rows at stable button height', () => {
    const view = renderMapTree(projectState([
      { id: 'town', path: 'data/maps/town.json', parentId: null, order: 0, expanded: true },
      { id: 'forest', path: 'data/maps/forest.json', parentId: 'town', order: 0, expanded: true },
    ]));

    for (const name of ['Town', 'Forest']) {
      const rowButton = view.container.querySelector<HTMLButtonElement>(`button[title="${name}"]`);
      expect(rowButton?.className).toContain('h-6');
    }

    view.unmount();
  });

  it('opens the AI map draft generator, drafts, validates, and accepts insertion', async () => {
    const state = projectState([
      { id: 'town', path: 'data/maps/town.json', parentId: null, order: 0, expanded: true },
    ]);
    const view = renderMapTree(state);

    const genButton = view.container.querySelector<HTMLButtonElement>('button[aria-label="Generate map draft"]');
    expect(genButton).toBeDefined();

    // Open modal
    act(() => {
      genButton?.click();
    });

    // Check modal title is rendered
    expect(document.body.innerHTML).toContain('Generate Map Draft');

    const generateSubmitButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Generate Draft"]');
    expect(generateSubmitButton).toBeDefined();

    // Trigger generate map (uses mock adapter internally)
    await act(async () => {
      generateSubmitButton?.click();
    });

    // Check candidate review is visible
    expect(document.body.innerHTML).toContain('Candidate Review Details');

    const acceptButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Accept and Insert"]');
    expect(acceptButton).not.toBeNull();

    // Trigger accept
    act(() => {
      acceptButton?.click();
    });

    // Modal should close
    expect(document.body.innerHTML).not.toContain('Generate Map Draft');

    // Assert projectDispatch called with correct payload
    expect(view.projectDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADD_GENERATED_MAP',
      map: expect.objectContaining({
        id: expect.stringContaining('draft_map'),
        name: expect.stringContaining('Draft Map'),
        width: 40,
        height: 23,
      }),
    }));
    expect(view.editorDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SELECT_MAP',
      mapId: expect.stringContaining('draft_map'),
    }));

    view.unmount();
  });
});
