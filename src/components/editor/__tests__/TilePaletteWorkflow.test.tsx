import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeDatabases } from '../../../adapters/defaultDatabases';
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
import type { MapData } from '../../../types/project';
import { TilePalette } from '../TilePalette';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mapData(overrides: Partial<MapData> = {}): MapData {
  const width = overrides.width ?? 8;
  const height = overrides.height ?? 6;
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
    layers: [
      { name: 'ground', type: 'visual', role: 'ground', visible: true, locked: false, tiles: new Array(width * height).fill(1) },
      { name: 'decoration', type: 'visual', role: 'decoration', visible: true, locked: false, tiles: new Array(width * height).fill(0) },
      { name: 'foreground', type: 'visual', role: 'foreground', visible: true, locked: false, tiles: new Array(width * height).fill(0) },
      { name: 'collision', type: 'collision', role: 'collision', visible: true, locked: false, tiles: new Array(width * height).fill(0) },
      { name: 'region', type: 'region', role: 'region', visible: true, locked: false, tiles: new Array(width * height).fill(0) },
    ],
    events: [],
    ...overrides,
  };
}

function projectState(map: MapData = mapData()): ProjectStoreState {
  return {
    ...initialProjectStoreState,
    project: {
      schemaVersion: 1,
      title: 'Palette Test',
      startMapId: map.id,
      startPosition: { x: 1, y: 1, direction: 'down' },
      database: { items: 'data/database/items.json', tilesets: 'data/database/tilesets.json' },
      maps: [{ id: map.id, path: `data/maps/${map.id}.json`, parentId: null, order: 0, expanded: true }],
    },
    maps: { [map.id]: map },
    databases: mergeDatabases(undefined),
  };
}

function renderPalette(state = projectState(), editorState: EditorState = initialEditorState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const editorDispatch = vi.fn<(action: EditorAction) => void>();
  const projectDispatch = vi.fn<(action: ProjectAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <EditorContext.Provider value={{ state: editorState, dispatch: editorDispatch }}>
        <ProjectContext.Provider value={{ state, dispatch: projectDispatch }}>
          <TilePalette embedded />
        </ProjectContext.Provider>
      </EditorContext.Provider>,
    );
  });

  return {
    container,
    editorDispatch,
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

describe('Tile palette workflow polish', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('exposes distinct brush controls and a labelled search field', () => {
    const view = renderPalette();

    expect(view.container.querySelector<HTMLInputElement>('input[aria-label="Search tile palette"]')).not.toBeNull();
    expect(view.container.querySelectorAll<HTMLButtonElement>('button[aria-label="Brush"]')).toHaveLength(1);
    expect(view.container.querySelector<HTMLButtonElement>('button[aria-label="Fill"]')).not.toBeNull();
    expect(view.container.querySelector<HTMLButtonElement>('button[aria-label="Rectangle"]')).not.toBeNull();
    expect(view.container.querySelector<HTMLButtonElement>('button[aria-label="Erase"]')).not.toBeNull();
    expect(view.container.querySelector<HTMLButtonElement>('button[aria-label="Select / move events"]')).not.toBeNull();
    expect(view.container.textContent).not.toContain('Pick tile from canvas');

    view.unmount();
  });

  it('surfaces missing tileset metadata instead of showing an empty visual palette silently', () => {
    const view = renderPalette(projectState(mapData({ tilesetId: 'missing-tileset' })));

    expect(view.container.textContent).toContain('Missing tileset: missing-tileset');
    expect(view.container.textContent).toContain('Visual tile brushes are unavailable until a valid tileset is selected');

    view.unmount();
  });

  it('filters tile buttons and dispatches the selected brush by accessible name', () => {
    const view = renderPalette();
    const search = view.container.querySelector<HTMLInputElement>('input[aria-label="Search tile palette"]');

    expect(search).not.toBeNull();
    changeInput(search!, 'water');

    const water = view.container.querySelector<HTMLButtonElement>('button[aria-label="Select tile Water"]');
    expect(water).not.toBeNull();
    act(() => {
      water?.click();
    });

    expect(view.editorDispatch).toHaveBeenCalledWith({
      type: 'SET_BRUSH',
      brush: { kind: 'tile', tileId: 3, label: 'Water' },
    });

    view.unmount();
  });

  it('explains when the active layer is locked before the creator paints', () => {
    const lockedGround = mapData({
      layers: mapData().layers.map(layer =>
        layer.name === 'ground' ? { ...layer, locked: true } : layer,
      ),
    });
    const view = renderPalette(projectState(lockedGround), {
      ...initialEditorState,
      activeLayer: 'ground',
    });

    expect(view.container.textContent).toContain('Ground layer is locked');
    expect(view.container.textContent).toContain('Unlock it before painting on this layer');

    view.unmount();
  });
});
