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
});
