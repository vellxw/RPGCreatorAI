import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseList } from '../DatabaseList';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function projectState(): ProjectStoreState {
  return {
    ...initialProjectStoreState,
    items: {
      items: [
        { id: 'potion', name: 'Potion', description: '', type: 'consumable' },
      ],
    },
    databases: {
      ...initialProjectStoreState.databases,
      quests: [
        {
          id: 'quest_1',
          title: 'Quest 1',
          summary: 'Summary 1',
          objectives: [],
          rewards: { gold: 0, exp: 0, items: [] },
        },
      ],
    },
  };
}

function renderDatabaseList(state: ProjectStoreState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const projectDispatch = vi.fn<(action: ProjectAction) => void>();
  const selectMock = vi.fn<(id: string) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <ProjectContext.Provider value={{ state, dispatch: projectDispatch }}>
        <DatabaseList table="quests" entries={state.databases.quests as any} selectedId="" onSelect={selectMock} />
      </ProjectContext.Provider>
    );
  });

  return {
    container,
    projectDispatch,
    selectMock,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('Quest Generation UI Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('opens the AI quest draft generator, generates a draft, validates, and accepts insertion', async () => {
    const state = projectState();
    const view = renderDatabaseList(state);

    const genButton = view.container.querySelector<HTMLButtonElement>('button[aria-label="Generate quest draft"]');
    expect(genButton).not.toBeNull();

    // Open modal
    act(() => {
      genButton?.click();
    });

    // Check modal title is rendered
    expect(document.body.innerHTML).toContain('Generate Quest Draft');

    const generateSubmitButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Generate Draft"]');
    expect(generateSubmitButton).not.toBeNull();

    // Trigger generate quest (uses mock adapter internally)
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
    expect(document.body.innerHTML).not.toContain('Generate Quest Draft');

    // Assert projectDispatch called with correct ADD_DATABASE_ENTRY payload
    expect(view.projectDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADD_DATABASE_ENTRY',
      table: 'quests',
      entry: expect.objectContaining({
        id: expect.stringContaining('quest'),
        title: expect.stringContaining('Quest'),
        summary: expect.any(String),
        objectives: expect.any(Array),
        rewards: expect.any(Object),
      }),
    }));

    // Expect selecting the new quest
    expect(view.selectMock).toHaveBeenCalledWith(expect.stringContaining('quest'));

    view.unmount();
  });
});
