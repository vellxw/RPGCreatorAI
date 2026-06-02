import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetsScreen } from '../AssetsScreen';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../stores/projectStore';

function renderAssetsScreen(projectState: ProjectStoreState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const dispatch = vi.fn<(action: ProjectAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <ProjectContext.Provider value={{ state: projectState, dispatch }}>
        <AssetsScreen />
      </ProjectContext.Provider>,
    );
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('AssetsScreen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('lists, filters, and previews catalog assets', () => {
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      assets: {
        schemaVersion: 1,
        assets: [
          {
            id: 'player_adventurer_sheet',
            name: 'Player Adventurer Sheet',
            kind: 'spritesheet',
            path: 'assets/generated/web/player_adventurer.png',
            source: 'generated',
            tags: ['player', 'runtime'],
            width: 384,
            height: 64,
            frameWidth: 64,
            frameHeight: 64,
            frames: 6,
          },
          {
            id: 'town_theme',
            name: 'Town Theme',
            kind: 'audio',
            path: 'assets/audio/town.wav',
            source: 'local',
            tags: ['bgm'],
          },
        ],
      },
    };

    const view = renderAssetsScreen(state);

    expect(view.container.textContent).toContain('Assets');
    expect(view.container.textContent).toContain('Player Adventurer Sheet');
    expect(view.container.textContent).toContain('assets/generated/web/player_adventurer.png');
    expect(view.container.textContent).toContain('384 x 64');

    const filter = view.container.querySelector('input[aria-label="Filter assets"]') as HTMLInputElement;
    act(() => {
      filter.value = 'town';
      filter.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(view.container.textContent).toContain('Town Theme');
    expect(view.container.textContent).not.toContain('Player Adventurer Sheet');
    expect(view.container.textContent).toContain('assets/audio/town.wav');

    view.unmount();
  });
});
