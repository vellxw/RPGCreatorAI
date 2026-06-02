import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { initialEditorState, EditorContext, type EditorAction } from '../../stores/editorStore';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../stores/projectStore';
import type { MapData } from '../../types/project';
import { EventEditorScreen } from '../EventEditorScreen';

const emptyTown: MapData = {
  schemaVersion: 1,
  id: 'town',
  name: 'Town',
  width: 10,
  height: 10,
  tileSize: 32,
  layers: [
    { name: 'ground', type: 'visual', tiles: new Array(100).fill(1) },
    { name: 'collision', type: 'collision', tiles: new Array(100).fill(0) },
  ],
  events: [],
};

function renderScreen(state: ProjectStoreState): string {
  return renderToStaticMarkup(
    <EditorContext.Provider value={{ state: { ...initialEditorState, selectedMapId: 'town' }, dispatch: vi.fn<(action: EditorAction) => void>() }}>
      <ProjectContext.Provider value={{ state, dispatch: vi.fn<(action: ProjectAction) => void>() }}>
        <EventEditorScreen />
      </ProjectContext.Provider>
    </EditorContext.Provider>,
  );
}

describe('EventEditorScreen empty state', () => {
  it('guides users when no map events exist yet', () => {
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      project: {
        ...initialProjectStoreState.project,
        startMapId: 'town',
        maps: [{ id: 'town', path: 'data/maps/town.json' }],
      },
      maps: { town: emptyTown },
    };

    const html = renderScreen(state);

    expect(html).toContain('No events in this project');
    expect(html).toContain('Use the Events layer in the main editor palette');
    expect(html).toContain('Place an NPC, chest, transfer, or trigger on a map');
  });
});
