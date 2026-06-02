import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseList } from '../DatabaseList';
import {
  initialProjectStoreState,
  ProjectContext,
  type DatabaseRecord,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';
import type { ActorData } from '../../../types/project';

function actor(id: string, name: string): ActorData {
  return {
    id,
    name,
    classId: '',
    level: 1,
    hp: 10,
    mp: 0,
    baseStats: {
      maxHp: 10,
      maxMp: 0,
      attack: 1,
      defense: 1,
      magicAttack: 1,
      magicDefense: 1,
      agility: 1,
      luck: 1,
    },
    equipment: { weapon: null, armor: null, accessory: null },
    skills: [],
  };
}

function makeActors(count: number): ActorData[] {
  return Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return actor(`actor_${n}`, `Actor ${n}`);
  });
}

function makeState(actors: ActorData[], startingParty: string[] = []): ProjectStoreState {
  return {
    ...initialProjectStoreState,
    databases: {
      ...initialProjectStoreState.databases,
      actors,
      system: {
        ...initialProjectStoreState.databases.system,
        startingParty,
      },
    },
  };
}

function renderList(
  entries: DatabaseRecord[],
  state: ProjectStoreState,
  selectedId = entries[0]?.id ?? '',
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const dispatch = vi.fn<(action: ProjectAction) => void>();
  const onSelect = vi.fn();

  act(() => {
    root.render(
      <ProjectContext.Provider value={{ state, dispatch }}>
        <DatabaseList table="actors" entries={entries} selectedId={selectedId} onSelect={onSelect} />
      </ProjectContext.Provider>,
    );
  });

  return {
    container,
    dispatch,
    onSelect,
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

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector(`button[aria-label="${label}"]`);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return found;
}

function changeInput(element: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else {
      valueSetter?.call(element, value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('DatabaseList workflow', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('filters large lists while keeping selection state understandable', () => {
    const actors = makeActors(35);
    const view = renderList(actors as unknown as DatabaseRecord[], makeState(actors), 'actor_05');

    expect(view.container.textContent).toContain('Showing 35 of 35 actors');

    changeInput(input(view.container, 'Search actors'), 'Actor 29');

    expect(view.container.textContent).toContain('Showing 1 of 35 actors');
    expect(button(view.container, 'Select actor actor_29')).toBeTruthy();
    expect(view.container.textContent).toContain('Selected actor_05 is hidden by this filter.');

    act(() => {
      button(view.container, 'Select actor actor_29').click();
    });
    expect(view.onSelect).toHaveBeenLastCalledWith('actor_29');

    changeInput(input(view.container, 'Search actors'), 'missing');

    expect(view.container.textContent).toContain('No actors match "missing"');

    act(() => {
      button(view.container, 'Clear actor search').click();
    });
    expect(view.container.textContent).toContain('Showing 35 of 35 actors');

    view.unmount();
  });

  it('surfaces reference impact before blocking destructive deletes', () => {
    const actors = makeActors(8);
    const view = renderList(
      actors as unknown as DatabaseRecord[],
      makeState(actors, ['actor_05']),
      'actor_05',
    );

    expect(view.container.textContent).toContain('1 ref');

    act(() => {
      button(view.container, 'Delete actor actor_05 blocked by 1 reference').click();
    });

    expect(alert).toHaveBeenCalledWith(expect.stringContaining('database/system/startingParty/actor_05'));
    expect(view.dispatch).not.toHaveBeenCalled();

    view.unmount();
  });
});
