import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomPanel } from '../../editor/BottomPanel';
import { Sidebar } from '../Sidebar';
import { AIToolsScreen } from '../../../screens/AIToolsScreen';
import {
  ProjectContext,
  initialProjectStoreState,
  type ProjectContextValue,
} from '../../../stores/projectStore';
import {
  EditorContext,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from '../../../stores/editorStore';

function render(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function renderWithProject(ui: React.ReactNode) {
  const value: ProjectContextValue = {
    state: initialProjectStoreState,
    dispatch: vi.fn(),
  };
  return render(<ProjectContext.Provider value={value}>{ui}</ProjectContext.Provider>);
}

function renderWithEditor(
  ui: React.ReactNode,
  dispatch: React.Dispatch<EditorAction> = vi.fn((_: EditorAction) => undefined),
) {
  const value: { state: EditorState; dispatch: React.Dispatch<EditorAction> } = {
    state: initialEditorState,
    dispatch,
  };
  return render(<EditorContext.Provider value={value}>{ui}</EditorContext.Provider>);
}

describe('MVP placeholder AI gating', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('keeps the editor bottom panel focused on real diagnostics instead of AI generation prompts', () => {
    const view = renderWithProject(<BottomPanel />);
    const text = view.container.textContent ?? '';

    expect(text).toContain('Validation');
    expect(text).toContain('Playtest Logs');
    expect(text).not.toMatch(/AI Suggestions|Generate NPC dialogue|Improve town layout|Create side quest/);

    view.unmount();
  });

  it('does not expose AI Tools navigation or dispatch the removed AI screen', () => {
    const dispatch = vi.fn((_: EditorAction) => undefined);
    const view = renderWithEditor(<Sidebar />, dispatch);

    expect(view.container.textContent).not.toContain('AI Tools');

    for (const button of Array.from(view.container.querySelectorAll('button'))) {
      act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    }

    expect(dispatch.mock.calls).not.toContainEqual([{ type: 'SET_SCREEN', screen: 'ai-tools' }]);

    view.unmount();
  });

  it('renders the AI workflow status surface as read-only if reached directly', () => {
    const view = render(<AIToolsScreen />);
    const text = view.container.textContent ?? '';
    const enabledButtons = Array.from(view.container.querySelectorAll('button')).filter(
      button => !button.disabled,
    );

    expect(text).toContain('Optional AI Editor Tooling');
    expect(text).toContain('Provider setup');
    expect(text).toContain('Cost & Budget');
    expect(text).toContain('Generation history');
    expect(text).toContain('Map drafts');
    expect(text).toContain('Image assets');
    expect(text).toContain('Runtime independent');
    expect(text).not.toContain('Future phase');
    expect(text).not.toContain('Unavailable in the MVP editor');
    expect(enabledButtons).toHaveLength(0);
    expect(text).not.toMatch(/Run provider|Run image generation|Connect|Test Connections|Live diagnostic/i);

    view.unmount();
  });
});
