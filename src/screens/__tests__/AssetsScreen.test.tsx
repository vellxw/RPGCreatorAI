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
import type { AudioImportRunner } from '../../adapters/audioImport';
import type { ImageImportRunner } from '../../adapters/assetImport';

function renderAssetsScreen(
  projectState: ProjectStoreState,
  imageImporter?: ImageImportRunner,
  audioImporter?: AudioImportRunner,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const dispatch = vi.fn<(action: ProjectAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <ProjectContext.Provider value={{ state: projectState, dispatch }}>
        <AssetsScreen imageImporter={imageImporter} audioImporter={audioImporter} />
      </ProjectContext.Provider>,
    );
  });

  return {
    container,
    dispatch,
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

  it('imports an image asset and dispatches a catalog entry', async () => {
    const imageImporter: ImageImportRunner = vi.fn(async () => ({
      success: true,
      cancelled: false,
      asset: {
        id: 'castle_gate',
        name: 'Castle Gate',
        kind: 'image' as const,
        path: 'assets/imported/images/castle_gate.png',
        source: 'imported' as const,
        tags: ['imported'],
      },
    }));
    const view = renderAssetsScreen(initialProjectStoreState, imageImporter);

    const button = Array.from(view.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Import Image'),
    );
    expect(button).toBeDefined();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(imageImporter).toHaveBeenCalledWith([]);
    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'ADD_ASSET_CATALOG_ENTRY',
      asset: {
        id: 'castle_gate',
        name: 'Castle Gate',
        kind: 'image',
        path: 'assets/imported/images/castle_gate.png',
        source: 'imported',
        tags: ['imported'],
      },
    });
    expect(view.container.textContent).toContain('Imported Castle Gate');

    view.unmount();
  });

  it('imports audio into the asset catalog and system audio registry', async () => {
    const audioImporter: AudioImportRunner = vi.fn(async () => ({
      success: true,
      cancelled: false,
      asset: {
        id: 'town_loop',
        name: 'Town Loop',
        kind: 'audio' as const,
        path: 'assets/imported/audio/town-loop.wav',
        source: 'imported' as const,
        tags: ['imported', 'audio', 'bgm'],
      },
    }));
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      databases: {
        ...initialProjectStoreState.databases,
        system: {
          ...initialProjectStoreState.databases.system,
          audio: {
            door_open: 'assets/audio/door.wav',
          },
        },
      },
    };
    const view = renderAssetsScreen(state, undefined, audioImporter);

    const usage = view.container.querySelector('select[aria-label="Audio usage"]') as HTMLSelectElement;
    expect(usage).toBeDefined();
    act(() => {
      usage.value = 'bgm';
      usage.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const button = Array.from(view.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Import Audio'),
    );
    expect(button).toBeDefined();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(audioImporter).toHaveBeenCalledWith(expect.arrayContaining(['confirm', 'door_open']), { usage: 'bgm' });
    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'ADD_ASSET_CATALOG_ENTRY',
      asset: {
        id: 'town_loop',
        name: 'Town Loop',
        kind: 'audio',
        path: 'assets/imported/audio/town-loop.wav',
        source: 'imported',
        tags: ['imported', 'audio', 'bgm'],
      },
    });
    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SYSTEM_DATA',
      changes: {
        audio: {
          door_open: 'assets/audio/door.wav',
          town_loop: 'assets/imported/audio/town-loop.wav',
        },
      },
    });
    expect(view.container.textContent).toContain('Imported audio Town Loop');

    view.unmount();
  });

  it('shows image import failures without mutating the catalog', async () => {
    const imageImporter: ImageImportRunner = vi.fn(async () => ({
      success: false,
      cancelled: false,
      error: 'Unsupported image type ".txt".',
    }));
    const view = renderAssetsScreen(initialProjectStoreState, imageImporter);
    const button = Array.from(view.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Import Image'),
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(view.dispatch).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Unsupported image type ".txt".');

    view.unmount();
  });

  it('shows audio import failures without mutating the catalog', async () => {
    const audioImporter: AudioImportRunner = vi.fn(async () => ({
      success: false,
      cancelled: false,
      error: 'Unsupported audio type ".mp3".',
    }));
    const view = renderAssetsScreen(initialProjectStoreState, undefined, audioImporter);
    const button = Array.from(view.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Import Audio'),
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(view.dispatch).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Unsupported audio type ".mp3".');

    view.unmount();
  });
});
