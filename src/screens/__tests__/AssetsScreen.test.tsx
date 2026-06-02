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
import type { ImageEditVariationRunner } from '../../providers/imageEditVariationWorkflow';

function renderAssetsScreen(
  projectState: ProjectStoreState,
  imageImporter?: ImageImportRunner,
  audioImporter?: AudioImportRunner,
  imageEditRunner?: ImageEditVariationRunner,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const dispatch = vi.fn<(action: ProjectAction) => void>();

  act(() => {
    root = createRoot(container);
    root.render(
      <ProjectContext.Provider value={{ state: projectState, dispatch }}>
        <AssetsScreen imageImporter={imageImporter} audioImporter={audioImporter} imageEditRunner={imageEditRunner} />
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

  it('edits mutable asset metadata while keeping referenced IDs locked', () => {
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      assets: {
        schemaVersion: 1,
        assets: [
          {
            id: 'hero_run_sheet',
            name: 'Hero Run Sheet',
            kind: 'spritesheet',
            path: 'assets/imported/spritesheets/hero-run-sheet.png',
            source: 'imported',
            tags: ['hero', 'runtime'],
            width: 384,
            height: 64,
            frameWidth: 64,
            frameHeight: 64,
            frames: 6,
            provenance: 'Local import',
            runtimeCompatible: true,
            runtimeNotes: 'Used by hero animation set',
            notes: 'Original run cycle.',
            protected: true,
          },
        ],
      },
      databases: {
        ...initialProjectStoreState.databases,
        animations: {
          sets: [
            {
              id: 'hero',
              clips: [
                {
                  action: 'run',
                  direction: 'down',
                  asset: 'hero_run_sheet',
                  frameSize: { width: 64, height: 64 },
                  frameCount: 6,
                  fps: 10,
                  loop: true,
                  anchor: { x: 32, y: 54 },
                },
              ],
            },
          ],
        },
      },
    };
    const view = renderAssetsScreen(state);

    const id = view.container.querySelector<HTMLInputElement>('input[aria-label="Asset ID"]');
    expect(id?.value).toBe('hero_run_sheet');
    expect(id?.disabled).toBe(true);
    expect(view.container.textContent).toContain('Imported');
    expect(view.container.textContent).toContain('Protected');
    expect(view.container.textContent).toContain('Referenced by 1 source');
    expect(view.container.textContent).toContain('database/animations/hero/clips/1/asset');

    const name = view.container.querySelector<HTMLInputElement>('input[aria-label="Asset display name"]');
    act(() => {
      name!.value = 'Hero Run Revised';
      name!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ASSET_CATALOG_METADATA',
      id: 'hero_run_sheet',
      changes: { name: 'Hero Run Revised' },
    });

    const tags = view.container.querySelector<HTMLInputElement>('input[aria-label="Asset tags"]');
    act(() => {
      tags!.value = 'hero, runtime, imported';
      tags!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ASSET_CATALOG_METADATA',
      id: 'hero_run_sheet',
      changes: { tags: ['hero', 'runtime', 'imported'] },
    });

    const source = view.container.querySelector<HTMLSelectElement>('select[aria-label="Asset source"]');
    act(() => {
      source!.value = 'local';
      source!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ASSET_CATALOG_METADATA',
      id: 'hero_run_sheet',
      changes: { source: 'local' },
    });

    const width = view.container.querySelector<HTMLInputElement>('input[aria-label="Asset width"]');
    act(() => {
      width!.value = '256';
      width!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ASSET_CATALOG_METADATA',
      id: 'hero_run_sheet',
      changes: { width: 256 },
    });

    const compatibility = view.container.querySelector<HTMLSelectElement>('select[aria-label="Runtime compatibility"]');
    act(() => {
      compatibility!.value = 'false';
      compatibility!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ASSET_CATALOG_METADATA',
      id: 'hero_run_sheet',
      changes: { runtimeCompatible: false },
    });

    const notes = view.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Asset notes"]');
    act(() => {
      notes!.value = 'Reviewed for runtime export.';
      notes!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ASSET_CATALOG_METADATA',
      id: 'hero_run_sheet',
      changes: { notes: 'Reviewed for runtime export.' },
    });

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

  it('runs image variation candidates without mutating the source asset until accepted', async () => {
    const sourceAsset = {
      id: 'forest_concept',
      name: 'Forest Concept',
      kind: 'image' as const,
      path: 'assets/imported/images/forest_concept.png',
      source: 'imported' as const,
      tags: ['concept'],
      width: 1536,
      height: 1024,
    };
    const generatedAsset = {
      id: 'forest_concept_variation',
      name: 'Forest Concept Variation',
      kind: 'image' as const,
      path: 'assets/generated/edits/forest_concept_variation.png',
      source: 'generated' as const,
      tags: ['generated', 'image-edit', 'variation', 'reviewed'],
      width: 1536,
      height: 1024,
      generated: {
        promptTemplateId: 'asset-edit-v1',
        promptTemplateVersion: 1,
        promptTemplateKind: 'edit',
        providerId: 'local',
        modelId: 'offline-image-edit-mock',
        operation: 'image.edit',
        sourceAssetId: 'forest_concept',
        sourceAssetPath: 'assets/imported/images/forest_concept.png',
        editMode: 'variation' as const,
      },
    };
    const imageEditRunner: ImageEditVariationRunner = vi.fn(async () => ({
      success: true,
      cancelled: false,
      candidate: {
        id: 'edit-run-1',
        reviewState: 'pending' as const,
        sourceAsset,
        asset: generatedAsset,
        qaPreview: {
          assetRef: 'mock://generated/edit-run-1.png',
          width: 1536,
          height: 1024,
          providerFixture: 'offline-image-edit',
        },
      },
    }));
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      assets: {
        schemaVersion: 1,
        assets: [sourceAsset],
      },
    };
    const view = renderAssetsScreen(state, undefined, undefined, imageEditRunner);

    expect(view.container.textContent).toContain('Image edit and variation');
    const instruction = view.container.querySelector<HTMLInputElement>('input[aria-label="Image edit instruction"]');
    act(() => {
      instruction!.value = 'Create a dusk lighting variation.';
      instruction!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const run = Array.from(view.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Run image variation'),
    );
    expect(run).toBeDefined();
    await act(async () => {
      run?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(imageEditRunner).toHaveBeenCalledWith(['forest_concept'], expect.objectContaining({
      mode: 'variation',
      sourceAsset,
      promptInputs: expect.objectContaining({
        instruction: 'Create a dusk lighting variation.',
      }),
    }));
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Generated image variation review');
    expect(view.container.textContent).toContain('forest_concept_variation');
    expect(view.container.textContent).toContain('Visual QA checklist');
    expect(view.container.textContent).toContain('Unresolved QA warnings');

    const qaNotes = view.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Visual QA notes"]');
    act(() => {
      qaNotes!.value = 'Manual preview confirms readability.';
      qaNotes!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const qaTags = view.container.querySelector<HTMLInputElement>('input[aria-label="Visual QA tags"]');
    act(() => {
      qaTags!.value = 'manual-pass, qa-reviewed';
      qaTags!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const accept = Array.from(view.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Accept'),
    );
    await act(async () => {
      accept?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'ADD_ASSET_CATALOG_ENTRY',
      asset: expect.objectContaining({
        id: 'forest_concept_variation',
        generated: expect.objectContaining({
          sourceAssetId: 'forest_concept',
          operation: 'image.edit',
          visualQa: expect.objectContaining({
            status: 'accepted',
            notes: 'Manual preview confirms readability.',
            tags: ['manual-pass', 'qa-reviewed'],
          }),
        }),
      }),
    });
    expect(view.container.textContent).toContain('Accepted Forest Concept Variation');

    view.unmount();
  });

  it('rejects generated image candidates with QA reasons without catalog mutation', async () => {
    const sourceAsset = {
      id: 'forest_concept',
      name: 'Forest Concept',
      kind: 'image' as const,
      path: 'assets/imported/images/forest_concept.png',
      source: 'imported' as const,
      width: 1536,
      height: 1024,
    };
    const imageEditRunner: ImageEditVariationRunner = vi.fn(async () => ({
      success: true,
      cancelled: false,
      candidate: {
        id: 'edit-run-reject',
        reviewState: 'pending' as const,
        sourceAsset,
        asset: {
          id: 'forest_concept_variation',
          name: 'Forest Concept Variation',
          kind: 'image' as const,
          path: 'assets/generated/edits/forest_concept_variation.png',
          source: 'generated' as const,
          width: 1536,
          height: 1024,
          generated: {
            promptTemplateId: 'asset-edit-v1',
            operation: 'image.edit',
            sourceAssetId: 'forest_concept',
            editMode: 'variation' as const,
          },
        },
        qaPreview: {
          assetRef: 'mock://generated/edit-run-reject.png',
          width: 1536,
          height: 1024,
        },
      },
    }));
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      assets: {
        schemaVersion: 1,
        assets: [sourceAsset],
      },
    };
    const view = renderAssetsScreen(state, undefined, undefined, imageEditRunner);
    const run = Array.from(view.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Run image variation'),
    );

    await act(async () => {
      run?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const reason = view.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Visual QA rejection reason"]');
    act(() => {
      reason!.value = 'Composition is too noisy for the asset library.';
      reason!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const reject = Array.from(view.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Reject'),
    );
    await act(async () => {
      reject?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(view.dispatch).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Rejected Forest Concept Variation');
    expect(view.container.textContent).toContain('Composition is too noisy for the asset library.');

    view.unmount();
  });

  it('shows image edit cancellation and capability/source gates without catalog mutation', async () => {
    const imageEditRunner: ImageEditVariationRunner = vi.fn(async () => ({
      success: false,
      cancelled: true,
      error: 'Image edit cancelled.',
    }));
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      assets: {
        schemaVersion: 1,
        assets: [
          {
            id: 'town_theme',
            name: 'Town Theme',
            kind: 'audio' as const,
            path: 'assets/audio/town.wav',
            source: 'local' as const,
          },
        ],
      },
    };
    const view = renderAssetsScreen(state, undefined, undefined, imageEditRunner);

    expect(view.container.textContent).toContain('Select an image, generated image, tileset, or spritesheet asset to edit.');
    const run = Array.from(view.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Run image variation'),
    ) as HTMLButtonElement | undefined;
    expect(run?.disabled).toBe(true);

    view.unmount();

    const imageState: ProjectStoreState = {
      ...initialProjectStoreState,
      assets: {
        schemaVersion: 1,
        assets: [
          {
            id: 'forest_concept',
            name: 'Forest Concept',
            kind: 'image' as const,
            path: 'assets/imported/images/forest_concept.png',
            source: 'imported' as const,
          },
        ],
      },
    };
    const cancelView = renderAssetsScreen(imageState, undefined, undefined, imageEditRunner);
    const cancelRun = Array.from(cancelView.container.querySelectorAll('button')).find(element =>
      element.textContent?.includes('Run image variation'),
    );

    await act(async () => {
      cancelRun?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(cancelView.dispatch).not.toHaveBeenCalled();
    expect(cancelView.container.textContent).toContain('Image edit cancelled.');

    cancelView.unmount();
  });
});
