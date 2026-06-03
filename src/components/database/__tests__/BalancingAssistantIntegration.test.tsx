import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseScreen } from '../../../screens/DatabaseScreen';
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
        { id: 'potion', name: 'Potion', description: '', type: 'consumable', price: 10 },
      ],
    },
    databases: {
      ...initialProjectStoreState.databases,
      actors: [
        {
          id: 'hero',
          name: 'Hero',
          classId: '',
          level: 1,
          hp: 100,
          mp: 10,
          baseStats: {
            maxHp: 100,
            maxMp: 10,
            attack: 10,
            defense: 10,
            magicAttack: 5,
            magicDefense: 5,
            agility: 5,
            luck: 5,
          },
          equipment: { weapon: null, armor: null, accessory: null },
          skills: [],
        },
      ],
      enemies: [
        {
          id: 'slime',
          name: 'Slime',
          stats: {
            maxHp: 50,
            maxMp: 0,
            attack: 5,
            defense: 5,
            magicAttack: 0,
            magicDefense: 2,
            agility: 3,
            luck: 1,
          },
          exp: 5,
          gold: 2,
          drops: [],
        },
      ],
    },
  };
}

function renderDatabaseScreen(state: ProjectStoreState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const projectDispatch = vi.fn<(action: ProjectAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <ProjectContext.Provider value={{ state, dispatch: projectDispatch }}>
        <DatabaseScreen />
      </ProjectContext.Provider>
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

describe('AI Balancing Assistant UI Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('opens the balancing assistant modal, generates balancing adjustments, and applies adjustments to store', async () => {
    const state = projectState();
    const view = renderDatabaseScreen(state);

    const balanceBtn = view.container.querySelector<HTMLButtonElement>('button[aria-label="Balance database"]');
    expect(balanceBtn).not.toBeNull();

    // Click balance database button to open modal
    act(() => {
      balanceBtn?.click();
    });

    expect(document.body.innerHTML).toContain('AI Balancing Assistant');

    const generateBtn = document.body.querySelector<HTMLButtonElement>('button[aria-label="Generate Adjustments"]');
    expect(generateBtn).not.toBeNull();

    // Click generate adjustments
    await act(async () => {
      generateBtn?.click();
    });

    expect(document.body.innerHTML).toContain('Proposed Adjustments Review');

    // Confirm that proposed changes lists actors, enemies, items
    expect(document.body.innerHTML).toContain('Actors (1)');
    expect(document.body.innerHTML).toContain('Enemies (1)');
    expect(document.body.innerHTML).toContain('Items (1)');

    const acceptBtn = document.body.querySelector<HTMLButtonElement>('button[aria-label="Accept and Apply"]');
    expect(acceptBtn).not.toBeNull();

    // Click accept to dispatch updates
    act(() => {
      acceptBtn?.click();
    });

    // Verify UPDATE_DATABASE_ENTRY / UPDATE_ITEM_DATABASE actions are dispatched
    expect(view.projectDispatch).toHaveBeenCalled();
    const actions = view.projectDispatch.mock.calls.map(call => call[0]);
    
    // Check Actor update action
    const actorUpdate = actions.find(a => a.type === 'UPDATE_DATABASE_ENTRY' && a.table === 'actors');
    expect(actorUpdate).toBeDefined();
    expect(actorUpdate).toMatchObject({
      id: 'hero',
      changes: {
        hp: 500,
        mp: 30,
      },
    });

    // Check Enemy update action
    const enemyUpdate = actions.find(a => a.type === 'UPDATE_DATABASE_ENTRY' && a.table === 'enemies');
    expect(enemyUpdate).toBeDefined();
    expect(enemyUpdate).toMatchObject({
      id: 'slime',
      changes: {
        exp: 15,
        gold: 25,
      },
    });

    // Check Item update action
    const itemUpdate = actions.find(a => a.type === 'UPDATE_ITEM_DATABASE');
    expect(itemUpdate).toBeDefined();
    expect((itemUpdate as any).items.items[0].price).toBe(60);

    view.unmount();
  });
});
