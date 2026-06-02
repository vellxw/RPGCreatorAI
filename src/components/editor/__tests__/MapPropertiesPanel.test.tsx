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
import { mergeDatabases } from '../../../adapters/defaultDatabases';
import type { MapData } from '../../../types/project';
import { Inspector } from '../Inspector';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mapData(overrides: Partial<MapData> = {}): MapData {
  const width = overrides.width ?? 10;
  const height = overrides.height ?? 8;
  return {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    displayName: 'Town',
    tilesetId: 'sample-town',
    scrollType: 'none',
    battleback: '',
    encounterSteps: 30,
    encounters: [],
    parallax: {},
    width,
    height,
    tileSize: 32,
    layers: [{ name: 'ground', type: 'visual', role: 'ground', tiles: new Array(width * height).fill(1) }],
    events: [],
    ...overrides,
  };
}

function projectState(maps: Record<string, MapData>): ProjectStoreState {
  return {
    ...initialProjectStoreState,
    project: {
      schemaVersion: 1,
      title: 'Map Properties Test',
      startMapId: 'town',
      startPosition: { x: 9, y: 7, direction: 'down' },
      database: { items: 'data/database/items.json', tilesets: 'data/database/tilesets.json' },
      maps: Object.keys(maps).map((id, order) => ({
        id,
        path: `data/maps/${id}.json`,
        parentId: null,
        order,
        expanded: true,
      })),
    },
    maps,
    databases: mergeDatabases({
      tilesets: {
        tilesets: [
          {
            id: 'sample-town',
            name: 'Sample Town',
            tileSize: 32,
            tiles: [],
          },
        ],
      },
    }),
  };
}

function renderInspector(state: ProjectStoreState, selectedMapId = 'town') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const projectDispatch = vi.fn<(action: ProjectAction) => void>();
  const editorDispatch = vi.fn<(action: EditorAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <EditorContext.Provider value={{ state: { ...initialEditorState, selectedMapId }, dispatch: editorDispatch }}>
        <ProjectContext.Provider value={{ state, dispatch: projectDispatch }}>
          <Inspector />
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

function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Map properties panel polish', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('explains missing tileset references and exposes metadata controls', () => {
    const view = renderInspector(projectState({
      town: mapData({ tilesetId: 'missing-tileset' }),
    }));

    expect(view.container.textContent).toContain('Missing tileset: missing-tileset');
    expect(view.container.querySelector<HTMLInputElement>('input[aria-label="Parallax image"]')).not.toBeNull();
    expect(view.container.querySelector<HTMLInputElement>('input[aria-label="Start X"]')).not.toBeNull();
    expect(view.container.querySelector<HTMLSelectElement>('select[aria-label="Start direction"]')).not.toBeNull();

    view.unmount();
  });

  it('dispatches parallax edits without JSON editing', () => {
    const view = renderInspector(projectState({
      town: mapData({ parallax: { image: 'mist', loopX: false, loopY: false, scrollX: 0, scrollY: 0 } }),
    }));
    const image = view.container.querySelector<HTMLInputElement>('input[aria-label="Parallax image"]');

    expect(image).not.toBeNull();
    changeInput(image!, 'clouds');

    expect(view.projectDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_MAP_PROPERTIES',
      mapId: 'town',
      changes: {
        parallax: {
          image: 'clouds',
          loopX: false,
          loopY: false,
          scrollX: 0,
          scrollY: 0,
        },
      },
    });

    view.unmount();
  });

  it('sets a safe start position when changing the start map', () => {
    const house = mapData({
      id: 'house',
      name: 'House',
      displayName: 'House',
      width: 5,
      height: 4,
      tilesetId: 'sample-town',
    });
    const view = renderInspector(projectState({
      town: mapData(),
      house,
    }), 'house');
    const setStart = Array.from(view.container.querySelectorAll('button')).find(button =>
      button.textContent?.trim() === 'Set as start map',
    );

    expect(setStart).toBeDefined();
    act(() => {
      setStart?.click();
    });

    expect(view.projectDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_PROJECT_META',
      changes: {
        startMapId: 'house',
        startPosition: { x: 4, y: 3, direction: 'down' },
      },
    });

    view.unmount();
  });
});
