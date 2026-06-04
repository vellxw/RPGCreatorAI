import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomPanel } from '../../editor/BottomPanel';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';

function stateWithValidationErrors(): ProjectStoreState {
  return {
    ...initialProjectStoreState,
    errors: [
      {
        level: 'error',
        message: 'Map "missing_map" does not exist in project',
        source: 'project.startMapId',
      },
      {
        level: 'error',
        message: 'Actor HP must be a non-negative number',
        source: 'actors.hero',
      },
    ],
    warnings: [
      {
        level: 'warning',
        message: 'Empty drop list for enemy "slime"',
        source: 'enemies.slime',
      },
    ],
  };
}

function renderBottomPanel(state: ProjectStoreState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const dispatch = vi.fn<(action: ProjectAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <ProjectContext.Provider value={{ state, dispatch }}>
        <BottomPanel />
      </ProjectContext.Provider>,
    );
  });

  return {
    container,
    dispatch,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('AI Validation Repair Assistant UI Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('opens from validation errors and generates reviewed offline suggestions', async () => {
    const view = renderBottomPanel(stateWithValidationErrors());

    const openButton = view.container.querySelector<HTMLButtonElement>(
      'button[aria-label="AI Repair Assistant"]',
    );
    expect(openButton).not.toBeNull();
    await click(openButton!);

    expect(document.body.textContent).toContain('AI Repair Assistant');
    expect(document.body.textContent).toContain('2 errors and 1 warning detected');
    expect(document.body.textContent).toContain('no automatic project changes are made');

    const generateButton = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Generate AI repair suggestions"]',
    );
    expect(generateButton).not.toBeNull();
    await click(generateButton!);

    expect(document.body.textContent).toContain('Generated 3 repair suggestions');
    expect(document.body.textContent).toContain('Reference Repair');
    expect(document.body.textContent).toContain('Data Fix');
    expect(document.body.textContent).toContain('Provider: local/offline-mock');
    expect(view.dispatch).not.toHaveBeenCalled();

    const acknowledgeButton = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Acknowledge AI repair suggestions"]',
    );
    expect(acknowledgeButton).not.toBeNull();
    await click(acknowledgeButton!);

    expect(document.body.textContent).toContain('Acknowledged');
    expect(view.dispatch).not.toHaveBeenCalled();

    view.unmount();
  });
});
