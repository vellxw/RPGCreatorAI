import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TilesetEditor } from '../TilesetEditor';
import type { TilesetDatabaseData } from '../../../types/project';

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
});
