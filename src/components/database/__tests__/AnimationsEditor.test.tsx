import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationsEditor } from '../AnimationsEditor';
import type { AnimationDatabaseData } from '../../../types/project';

function render(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
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

function click(container: HTMLElement, label: string) {
  const found = container.querySelector(`button[aria-label="${label}"]`);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  act(() => found.dispatchEvent(new MouseEvent('click', { bubbles: true })));
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

const database: AnimationDatabaseData = {
  sets: [
    {
      id: 'player_adventurer',
      display: { heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 },
      clips: [
        {
          action: 'idle',
          direction: 'down',
          asset: 'player_adventurer_idle_down',
          frameSize: { width: 64, height: 64 },
          frameCount: 4,
          fps: 4,
          loop: true,
          anchor: { x: 32, y: 54 },
        },
      ],
    },
  ],
};

describe('AnimationsEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('edits display metadata and clip frame data while rendering a clipped sheet preview', () => {
    const onChange = vi.fn();
    const view = render(<AnimationsEditor value={database} onChange={onChange} />);

    expect(view.container.querySelector('svg[aria-label="Animation preview"]')).not.toBeNull();
    const previewImage = view.container.querySelector('image');
    expect(previewImage?.getAttribute('href')).toContain('player_adventurer_idle_down');

    changeText(input(view.container, 'Display height tiles'), '2');
    expect(onChange).toHaveBeenLastCalledWith({
      sets: [
        {
          ...database.sets[0],
          display: { heightTiles: 2, widthTiles: 1, yOffsetPx: 0 },
        },
      ],
    });

    changeText(input(view.container, 'Frame count 1'), '6');
    expect(onChange).toHaveBeenLastCalledWith({
      sets: [
        {
          ...database.sets[0],
          clips: [{ ...database.sets[0].clips[0], frameCount: 6 }],
        },
      ],
    });

    changeSelect(select(view.container, 'Clip asset 1'), 'player_adventurer_walk_down');
    expect(onChange).toHaveBeenLastCalledWith({
      sets: [
        {
          ...database.sets[0],
          clips: [{ ...database.sets[0].clips[0], asset: 'player_adventurer_walk_down' }],
        },
      ],
    });
  });

  it('adds, duplicates, renames, and deletes animation sets without JSON editing', () => {
    const onChange = vi.fn();
    const view = render(<AnimationsEditor value={database} onChange={onChange} />);

    click(view.container, 'Add animation set');
    expect(onChange.mock.lastCall?.[0].sets).toHaveLength(2);

    click(view.container, 'Duplicate animation set player_adventurer');
    expect(onChange.mock.lastCall?.[0].sets.at(-1).id).toBe('player_adventurer_copy');

    changeText(input(view.container, 'Animation set ID'), 'hero');
    expect(onChange.mock.lastCall?.[0].sets[0].id).toBe('hero');

    click(view.container, 'Delete animation set player_adventurer');
    expect(onChange).toHaveBeenLastCalledWith({ sets: [] });
  });

  it('filters animation sets and keeps hidden selection understandable', () => {
    const value: AnimationDatabaseData = {
      sets: Array.from({ length: 24 }, (_, index) => ({
        ...database.sets[0],
        id: `animation_${String(index + 1).padStart(2, '0')}`,
      })),
    };
    const view = render(<AnimationsEditor value={value} onChange={vi.fn()} />);

    expect(view.container.textContent).toContain('Showing 24 of 24 animation sets');

    changeText(input(view.container, 'Search animation sets'), 'animation_21');

    expect(view.container.textContent).toContain('Showing 1 of 24 animation sets');
    const clearSearch = view.container.querySelector<HTMLButtonElement>('button[aria-label="Clear animation set search"]');
    expect(clearSearch?.className).toContain('h-6');
    expect(view.container.textContent).toContain('Selected animation_01 is hidden by this filter.');
    click(view.container, 'Select animation set animation_21');
    expect(view.container.textContent).toContain('animation_21');

    changeText(input(view.container, 'Search animation sets'), 'missing');
    expect(view.container.textContent).toContain('No animation sets match "missing"');

    view.unmount();
  });

  it('blocks animation set deletes when references are present', () => {
    const onChange = vi.fn();
    const view = render(
      <AnimationsEditor
        value={database}
        referenceSources={{ player_adventurer: ['database/system/playerAnimationSet'] }}
        onChange={onChange}
      />,
    );

    expect(view.container.textContent).toContain('1 ref');

    click(view.container, 'Delete animation set player_adventurer blocked by 1 reference');

    expect(alert).toHaveBeenCalledWith(expect.stringContaining('database/system/playerAnimationSet'));
    expect(onChange).not.toHaveBeenCalled();

    view.unmount();
  });
});
