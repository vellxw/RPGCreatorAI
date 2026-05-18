import { describe, expect, it } from 'vitest';
import { editorReducer, initialEditorState } from '../editorStore';

describe('editorStore viewport controls', () => {
  it('starts in fit-to-view mode for scene authoring', () => {
    expect(initialEditorState.zoomMode).toBe('fit');
  });

  it('switches between fit and manual zoom modes intentionally', () => {
    const fitted = editorReducer(initialEditorState, { type: 'FIT_TO_VIEW' });
    expect(fitted.zoomMode).toBe('fit');

    const manual = editorReducer(fitted, { type: 'SET_ZOOM', zoom: 125 });
    expect(manual.zoomMode).toBe('manual');
    expect(manual.zoom).toBe(125);

    const actual = editorReducer(manual, { type: 'SET_ACTUAL_SIZE' });
    expect(actual.zoomMode).toBe('manual');
    expect(actual.zoom).toBe(100);
  });

  it('tracks authoring layer, tool, and brush size explicitly', () => {
    const visualLayer = editorReducer(initialEditorState, { type: 'SET_ACTIVE_LAYER', layer: 'visual' });
    expect(visualLayer.activeLayer).toBe('visual');

    const fillTool = editorReducer(visualLayer, { type: 'SET_TOOL', tool: 'fill' });
    expect(fillTool.tool).toBe('fill');

    const largerBrush = editorReducer(fillTool, { type: 'SET_BRUSH_SIZE', brushSize: 3 });
    expect(largerBrush.brushSize).toBe(3);
  });
});
