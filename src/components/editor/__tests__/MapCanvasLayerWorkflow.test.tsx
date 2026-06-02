import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
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
import type { GameEvent, MapData } from '../../../types/project';
import { MapCanvas } from '../MapCanvas';

function mapData(overrides: Partial<MapData> = {}): MapData {
  const width = overrides.width ?? 4;
  const height = overrides.height ?? 4;
  const foreground = new Array(width * height).fill(0);
  foreground[5] = 5;
  const ground = new Array(width * height).fill(1);
  ground[6] = 5;
  const collision = new Array(width * height).fill(0);
  collision[6] = 9;
  const region = new Array(width * height).fill(0);
  region[10] = 3;
  const event: GameEvent = {
    id: 'npc_1',
    type: 'npc',
    x: 1,
    y: 1,
    solid: true,
    trigger: 'interact',
    commands: [],
  };

  return {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    displayName: 'Town',
    tilesetId: 'sample-town',
    width,
    height,
    tileSize: 32,
    layers: [
      { name: 'ground', type: 'visual', role: 'ground', visible: true, locked: false, tiles: ground },
      { name: 'decoration', type: 'visual', role: 'decoration', visible: true, locked: false, tiles: new Array(width * height).fill(0) },
      { name: 'foreground', type: 'visual', role: 'foreground', visible: true, locked: false, tiles: foreground },
      { name: 'collision', type: 'collision', role: 'collision', visible: true, locked: false, tiles: collision },
      { name: 'region', type: 'region', role: 'region', visible: true, locked: false, tiles: region },
    ],
    events: [event],
    ...overrides,
  };
}

function projectState(map: MapData = mapData()): ProjectStoreState {
  return {
    ...initialProjectStoreState,
    project: {
      schemaVersion: 1,
      title: 'Layer Workflow Test',
      startMapId: map.id,
      startPosition: { x: 0, y: 0, direction: 'down' },
      database: { items: 'data/database/items.json', tilesets: 'data/database/tilesets.json' },
      maps: [{ id: map.id, path: `data/maps/${map.id}.json`, parentId: null, order: 0, expanded: true }],
    },
    maps: { [map.id]: map },
  };
}

function renderCanvas(state = projectState(), editorState: EditorState = initialEditorState): string {
  return renderToStaticMarkup(
    <EditorContext.Provider value={{ state: editorState, dispatch: vi.fn<(action: EditorAction) => void>() }}>
      <ProjectContext.Provider value={{ state, dispatch: vi.fn<(action: ProjectAction) => void>() }}>
        <MapCanvas />
      </ProjectContext.Provider>
    </EditorContext.Provider>,
  );
}

describe('Map canvas layer workflow polish', () => {
  it('renders foreground role layers after entities to match runtime occlusion order', () => {
    const html = renderCanvas();

    expect(html.indexOf('data-event-id="npc_1"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-layer-role="foreground"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-layer-role="foreground"')).toBeGreaterThan(html.indexOf('data-event-id="npc_1"'));
  });

  it('labels collision and region editor overlays separately from authored visuals', () => {
    const collisionHtml = renderCanvas(projectState(), {
      ...initialEditorState,
      activeLayer: 'collision',
    });
    const regionHtml = renderCanvas(projectState(), {
      ...initialEditorState,
      activeLayer: 'region',
    });

    expect(collisionHtml).toContain('data-layer-overlay="collision-passability"');
    expect(collisionHtml).toContain('data-layer-overlay="collision-manual"');
    expect(regionHtml).toContain('data-layer-overlay="region"');
  });

  it('shows blocked active-layer status in the canvas chrome', () => {
    const lockedMap = mapData({
      layers: mapData().layers.map(layer =>
        layer.name === 'ground' ? { ...layer, locked: true } : layer,
      ),
    });
    const html = renderCanvas(projectState(lockedMap), {
      ...initialEditorState,
      activeLayer: 'ground',
    });

    expect(html).toContain('Ground layer locked');
    expect(html).not.toContain('Brush ground');
  });
});
