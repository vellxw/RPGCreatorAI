import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { initialEditorState, EditorContext, type EditorAction, type EditorState } from '../../../stores/editorStore';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';
import { Inspector } from '../Inspector';
import { MapCanvas } from '../MapCanvas';
import { MapTreePanel } from '../MapTreePanel';
import { TilePalette } from '../TilePalette';

function renderEditorSurface(
  ui: React.ReactNode,
  projectState: ProjectStoreState,
  editorState: EditorState = initialEditorState,
): string {
  return renderToStaticMarkup(
    <EditorContext.Provider value={{ state: editorState, dispatch: vi.fn<(action: EditorAction) => void>() }}>
      <ProjectContext.Provider value={{ state: projectState, dispatch: vi.fn<(action: ProjectAction) => void>() }}>
        {ui}
      </ProjectContext.Provider>
    </EditorContext.Provider>,
  );
}

describe('editor empty states', () => {
  it('guides a project with no maps from the map tree', () => {
    const html = renderEditorSurface(<MapTreePanel />, initialProjectStoreState, {
      ...initialEditorState,
      selectedMapId: '',
    });

    expect(html).toContain('No maps in this project');
    expect(html).toContain('Create the first map');
    expect(html).toContain('A project needs at least one authored scene');
  });

  it('guides missing map selection across canvas inspector and palette', () => {
    const html = renderEditorSurface(
      <>
        <MapCanvas />
        <Inspector />
        <TilePalette embedded />
      </>,
      initialProjectStoreState,
      { ...initialEditorState, selectedMapId: 'missing_map' },
    );

    expect(html).toContain('No map selected');
    expect(html).toContain('Select or create a map in the Map Tree');
    expect(html).toContain('Tile palette unavailable');
    expect(html).toContain('Select a map before choosing layers, brushes, or templates');
  });
});
