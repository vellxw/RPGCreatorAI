import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BottomPanel } from '../BottomPanel';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';
import { mergeDatabases } from '../../../adapters/defaultDatabases';
import type { MapData } from '../../../types/project';

function renderPanel(state: ProjectStoreState): string {
  return renderToStaticMarkup(
    <ProjectContext.Provider value={{ state, dispatch: vi.fn<(action: ProjectAction) => void>() }}>
      <BottomPanel />
    </ProjectContext.Provider>,
  );
}

function renderInteractivePanel(
  state: ProjectStoreState,
  dispatch = vi.fn<(action: ProjectAction) => void>(),
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <ProjectContext.Provider value={{ state, dispatch }}>
      <BottomPanel />
    </ProjectContext.Provider>,
  ));
  return {
    container,
    dispatch,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function stateWithBrokenItemReference(): ProjectStoreState {
  const map: MapData = {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    width: 4,
    height: 4,
    tileSize: 32,
    layers: [
      { name: 'ground', type: 'visual', tiles: new Array(16).fill(1) },
      { name: 'collision', type: 'collision', tiles: new Array(16).fill(0) },
    ],
    events: [
      {
        id: 'chest',
        type: 'chest',
        x: 1,
        y: 1,
        solid: true,
        trigger: 'interact',
        commands: [{ type: 'addItem', itemId: 'missing_potion', amount: 1 }],
      },
    ],
  };
  return {
    ...initialProjectStoreState,
    project: {
      ...initialProjectStoreState.project,
      startMapId: 'town',
      maps: [{ id: 'town', path: 'data/maps/town.json' }],
    },
    maps: { town: map },
    items: { items: [{ id: 'potion', name: 'Potion', description: '', type: 'consumable' }] },
    databases: mergeDatabases(undefined),
    errors: [{ level: 'error', message: 'addItem references unknown item "missing_potion"', source: 'maps/town/events/chest/commands' }],
  };
}

describe('BottomPanel validation recovery copy', () => {
  it('explains that validation errors block Save and how to recover', () => {
    const html = renderPanel({
      ...initialProjectStoreState,
      errors: [{ level: 'error', message: 'Start map is missing', source: 'project.startMapId' }],
    });

    expect(html).toContain('Save is blocked');
    expect(html).toContain('Fix the blocking items');
    expect(html).toContain('Start map is missing');
    expect(html).toContain('project.startMapId');
  });

  it('explains that warnings do not block Save', () => {
    const html = renderPanel({
      ...initialProjectStoreState,
      warnings: [{ level: 'warning', message: 'Map has no encounters', source: 'maps/town' }],
    });

    expect(html).toContain('Save is allowed');
    expect(html).toContain('Warnings are review items');
    expect(html).toContain('Map has no encounters');
  });

  it('keeps the valid state explicit about the save gate', () => {
    const html = renderPanel(initialProjectStoreState);

    expect(html).toContain('Project passes validation');
    expect(html).toContain('Save will still re-check before writing');
  });

  it('shows repair affordances for broken references and dispatches explicit replacement', () => {
    const view = renderInteractivePanel(stateWithBrokenItemReference());

    expect(view.container.textContent).toContain('Reference repair');
    expect(view.container.textContent).toContain('missing_potion');
    expect(view.container.textContent).toContain('Potion (potion)');

    const button = view.container.querySelector(
      'button[aria-label="Apply repair for missing items reference missing_potion"]',
    );
    if (!(button instanceof HTMLButtonElement)) throw new Error('missing repair button');

    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(view.dispatch).toHaveBeenCalledWith({
      type: 'REPAIR_REFERENCE',
      repair: {
        table: 'items',
        source: 'maps/town/events/chest/commands',
        oldId: 'missing_potion',
        newId: 'potion',
      },
    });

    view.unmount();
  });
});
