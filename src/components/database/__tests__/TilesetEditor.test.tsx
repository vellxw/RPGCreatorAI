import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TilesetEditor } from '../TilesetEditor';
import type { AssetCatalogEntry, TilesetDatabaseData } from '../../../types/project';
import type { TilesetImportRunner } from '../../../adapters/tilesetImport';
import type {
  TilesetGenerationCandidate,
  TilesetGenerationRunner,
} from '../../../providers/tilesetGenerationWorkflow';

function makeDatabase(): TilesetDatabaseData {
  return {
    tilesets: [
      {
        id: 'sample-town',
        name: 'Sample Town',
        tileSize: 32,
        tiles: [
          {
            id: 1,
            name: 'Grass',
            asset: 'grass',
            group: 'A',
            passability: 'passable',
            terrainTag: 'field',
            priority: 0,
          },
          {
            id: 5,
            name: 'Tree',
            asset: 'tree',
            group: 'B',
            passability: 'blocked',
            terrainTag: 'forest',
            bush: true,
            priority: 1,
          },
        ],
      },
    ],
  };
}

function render(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function input(container: HTMLElement, label: string): HTMLInputElement {
  const found = container.querySelector(`input[aria-label="${label}"]`);
  if (!(found instanceof HTMLInputElement)) throw new Error(`Missing input: ${label}`);
  return found;
}

function select(container: HTMLElement, label: string): HTMLSelectElement {
  const found = container.querySelector(`select[aria-label="${label}"]`);
  if (!(found instanceof HTMLSelectElement)) throw new Error(`Missing select: ${label}`);
  return found;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector(`button[aria-label="${label}"]`);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return found;
}

async function clickAsync(container: HTMLElement, label: string) {
  const found = button(container, label);
  await act(async () => {
    found.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function changeText(el: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(el, value);
    } else {
      valueSetter?.call(el, value);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function changeSelect(el: HTMLSelectElement, value: string) {
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('TilesetEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('edits tileset and tile metadata through grouped tile rows', () => {
    const onChange = vi.fn();
    const view = render(
      <TilesetEditor
        value={makeDatabase()}
        mapUsage={{ 'sample-town': ['town'] }}
        onChange={onChange}
      />,
    );

    for (const group of ['A', 'B', 'C', 'D', 'E', 'Region', 'Collision']) {
      expect(button(view.container, `Show ${group} tiles`)).toBeTruthy();
    }
    expect(view.container.textContent).toContain('Referenced by 1 map');

    changeText(input(view.container, 'Tileset name'), 'Town Revised');
    expect(onChange).toHaveBeenLastCalledWith({
      tilesets: [
        expect.objectContaining({
          id: 'sample-town',
          name: 'Town Revised',
        }),
      ],
    });

    changeText(input(view.container, 'Tile size'), '48');
    expect(onChange).toHaveBeenLastCalledWith({
      tilesets: [
        expect.objectContaining({
          tileSize: 48,
        }),
      ],
    });

    changeText(input(view.container, 'Tile 1 asset'), 'missingAsset');
    expect(onChange).toHaveBeenLastCalledWith({
      tilesets: [
        expect.objectContaining({
          tiles: [
            expect.objectContaining({ id: 1, asset: 'missingAsset' }),
            expect.any(Object),
          ],
        }),
      ],
    });

    changeSelect(select(view.container, 'Tile 1 passability'), 'blocked');
    expect(onChange).toHaveBeenLastCalledWith({
      tilesets: [
        expect.objectContaining({
          tiles: [
            expect.objectContaining({ id: 1, passability: 'blocked' }),
            expect.any(Object),
          ],
        }),
      ],
    });

    act(() => input(view.container, 'Tile 1 bush').click());
    expect(onChange).toHaveBeenLastCalledWith({
      tilesets: [
        expect.objectContaining({
          tiles: [
            expect.objectContaining({ id: 1, bush: true }),
            expect.any(Object),
          ],
        }),
      ],
    });

    view.unmount();
  });

  it('creates, duplicates, and deletes tilesets with reference warnings', () => {
    const onChange = vi.fn();
    const view = render(
      <TilesetEditor
        value={makeDatabase()}
        mapUsage={{ 'sample-town': ['town', 'house'] }}
        onChange={onChange}
      />,
    );

    expect(view.container.textContent).toContain('Referenced by 2 maps');

    act(() => button(view.container, 'Add tileset').click());
    expect(onChange).toHaveBeenLastCalledWith({
      tilesets: [
        expect.any(Object),
        expect.objectContaining({ id: 'tileset_2', tileSize: 32 }),
      ],
    });

    act(() => button(view.container, 'Duplicate tileset sample-town').click());
    expect(onChange).toHaveBeenLastCalledWith({
      tilesets: [
        expect.any(Object),
        expect.objectContaining({ id: 'sample-town_copy', name: 'Sample Town Copy' }),
      ],
    });

    act(() => button(view.container, 'Delete tileset sample-town').click());
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('sample-town'),
    );
    expect(onChange).toHaveBeenLastCalledWith({ tilesets: [] });

    view.unmount();
  });

  it('imports a tileset asset and generates role metadata before use', async () => {
    const importedAsset: AssetCatalogEntry = {
      id: 'forest_pack',
      name: 'Forest Pack',
      kind: 'tileset',
      path: 'assets/imported/tilesets/forest-pack.png',
      source: 'imported',
      tags: ['imported', 'tileset'],
      width: 256,
      height: 256,
    };
    const tilesetImporter: TilesetImportRunner = vi.fn(async () => ({
      success: true,
      cancelled: false,
      asset: importedAsset,
    }));
    const onAssetImported = vi.fn();
    const onChange = vi.fn();
    const view = render(
      <TilesetEditor
        value={{ tilesets: [] }}
        assets={[]}
        tilesetImporter={tilesetImporter}
        onAssetImported={onAssetImported}
        onChange={onChange}
      />,
    );

    act(() => button(view.container, 'Import tileset').click());
    expect(view.container.querySelector('[aria-label="Tileset metadata preview"]')).not.toBeNull();

    changeText(input(view.container, 'Tileset import ID'), 'forest_tiles');
    changeText(input(view.container, 'Tileset import name'), 'Forest Pack');
    changeText(input(view.container, 'Tileset import tile size'), '16');
    changeText(input(view.container, 'Tileset import columns'), '8');
    changeText(input(view.container, 'Tileset import tile count'), '12');
    changeSelect(select(view.container, 'Tileset import default passability'), 'blocked');
    changeText(input(view.container, 'Tileset import foreground start tile'), '8');
    changeText(input(view.container, 'Tileset import region marker count'), '2');

    await clickAsync(view.container, 'Accept tileset import');

    expect(tilesetImporter).toHaveBeenCalledWith([], {
      idBase: 'forest_pack',
      name: 'Forest Pack',
      tileSize: 16,
      columns: 8,
      tileCount: 12,
    });
    expect(onAssetImported).toHaveBeenCalledWith(importedAsset);
    expect(onChange).toHaveBeenLastCalledWith({
      tilesets: [
        expect.objectContaining({
          id: 'forest_tiles',
          name: 'Forest Pack',
          tileSize: 16,
          tiles: expect.arrayContaining([
            expect.objectContaining({ id: 0, name: 'Tile 0', asset: 'forest_pack', group: 'A', passability: 'blocked', priority: 0 }),
            expect.objectContaining({ id: 7, group: 'A', priority: 0 }),
            expect.objectContaining({ id: 8, group: 'B', priority: 1 }),
            expect.objectContaining({ id: 11, group: 'B', priority: 1 }),
            expect.objectContaining({ id: 1000, name: 'Region 1', group: 'Region', passability: 'passable', terrainTag: 'region_1' }),
            expect.objectContaining({ id: 1001, name: 'Region 2', group: 'Region', passability: 'passable', terrainTag: 'region_2' }),
            expect.objectContaining({ id: 2000, name: 'Collision Block', group: 'Collision', passability: 'blocked', terrainTag: 'collision' }),
          ]),
        }),
      ],
    });
    expect(view.container.textContent).toContain('Imported Forest Pack');

    view.unmount();
  });

  it('validates tileset import metadata before opening the file picker', async () => {
    const tilesetImporter: TilesetImportRunner = vi.fn();
    const view = render(
      <TilesetEditor
        value={makeDatabase()}
        assets={[]}
        tilesetImporter={tilesetImporter}
        onAssetImported={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    act(() => button(view.container, 'Import tileset').click());
    changeText(input(view.container, 'Tileset import tile count'), '0');

    await clickAsync(view.container, 'Accept tileset import');

    expect(tilesetImporter).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Tile count must be a positive integer.');

    view.unmount();
  });

  it('generates a tileset draft and requires review before adding it to project data', async () => {
    const generatedAsset: AssetCatalogEntry = {
      id: 'forest_draft',
      name: 'Forest Draft',
      kind: 'tileset',
      path: 'assets/generated/tilesets/forest_draft.png',
      source: 'generated',
      tags: ['generated', 'tileset', 'ai-draft', 'pending-review'],
      width: 256,
      height: 256,
      generated: {
        prompt: 'offline tileset prompt',
        tool: 'ai-tileset-generation-workflow',
        createdAt: '2026-06-02T18:16:00.000Z',
        promptTemplateId: 'tileset-rpg-map-v1',
        promptTemplateVersion: 1,
        promptTemplateKind: 'tileset',
        providerId: 'local',
        modelId: 'offline-image-mock',
      },
    };
    const generatedCandidate: TilesetGenerationCandidate = {
      id: 'tileset-gen-ui',
      reviewState: 'pending',
      asset: generatedAsset,
      tileset: {
        id: 'forest_tiles',
        name: 'Forest Draft',
        tileSize: 32,
        tiles: [
          { id: 0, name: 'Tile 0', asset: 'forest_draft', group: 'A', passability: 'passable', priority: 0 },
          { id: 2000, name: 'Collision Block', asset: 'forest_draft', group: 'Collision', passability: 'blocked', terrainTag: 'collision', priority: 0 },
        ],
      },
      qaPreview: {
        assetRef: 'mock://generated/tileset-gen-ui.png',
        width: 256,
        height: 256,
        tileSize: 32,
        columns: 8,
        rows: 8,
        tileCount: 64,
        providerFixture: 'offline-image',
      },
    };
    const tilesetGenerator: TilesetGenerationRunner = vi.fn(async () => ({
      success: true,
      candidate: generatedCandidate,
    }));
    const onAssetImported = vi.fn();
    const onChange = vi.fn();
    const view = render(
      <TilesetEditor
        value={{ tilesets: [] }}
        assets={[]}
        tilesetGenerator={tilesetGenerator}
        onAssetImported={onAssetImported}
        onChange={onChange}
      />,
    );

    act(() => button(view.container, 'Generate draft tileset').click());
    expect(view.container.querySelector('[aria-label="Tileset generation metadata preview"]')).not.toBeNull();

    changeText(input(view.container, 'Tileset generation ID'), 'forest_tiles');
    changeText(input(view.container, 'Tileset generation name'), 'Forest Draft');
    changeText(input(view.container, 'Tileset generation subject'), 'moss forest floor and canopy');

    await clickAsync(view.container, 'Run tileset generation');

    expect(tilesetGenerator).toHaveBeenCalledWith([], [], expect.objectContaining({
      tilesetId: 'forest_tiles',
      name: 'Forest Draft',
      promptInputs: expect.objectContaining({
        subject: 'moss forest floor and canopy',
      }),
    }));
    expect(view.container.querySelector('[aria-label="Generated tileset draft review"]')).not.toBeNull();
    expect(onAssetImported).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    await clickAsync(view.container, 'Accept generated tileset');

    expect(onAssetImported).toHaveBeenCalledWith(expect.objectContaining({
      id: 'forest_draft',
      source: 'generated',
      tags: expect.arrayContaining(['reviewed']),
    }));
    expect(onChange).toHaveBeenLastCalledWith({
      tilesets: [
        expect.objectContaining({
          id: 'forest_tiles',
          tiles: expect.arrayContaining([
            expect.objectContaining({ asset: 'forest_draft' }),
          ]),
        }),
      ],
    });

    view.unmount();
  });
});
