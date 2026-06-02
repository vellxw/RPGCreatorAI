import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EditorContext,
  initialEditorState,
  type EditorAction,
} from '../../stores/editorStore';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../stores/projectStore';
import type { EventPage, GameEvent, MapData } from '../../types/project';
import { EventEditorScreen } from '../EventEditorScreen';

function page(id: string, index: number, overrides: Partial<EventPage> = {}): EventPage {
  return {
    id,
    name: `Page ${index}`,
    conditions: {},
    graphic: {},
    movement: { type: 'fixed', speed: 'normal' },
    options: { walking: true, stepping: false, directionFix: false, through: false },
    priority: 'sameAsCharacters',
    trigger: 'interact',
    commands: [{ type: 'showText', text: `Page ${index} text` }],
    ...overrides,
  };
}

function event(): GameEvent {
  const first = page('page_1', 1, {
    graphic: { sprite: 'npc_old_man' },
    commands: [{ type: 'showText', text: 'Page one' }],
  });
  const second = page('page_2', 2, {
    name: 'Page 2',
    conditions: {
      selfSwitches: { A: true },
      switches: { story_ready: true },
      variables: [{ variableId: 'score', op: 'gte', value: 10 }],
    },
    graphic: {
      sprite: 'chest_closed',
      animationSet: 'npc_old_man',
      displayHeightTiles: 1.5,
    },
    movement: { type: 'random', speed: 'half' },
    options: { walking: false, stepping: true, directionFix: false, through: true },
    priority: 'aboveCharacters',
    trigger: 'touch',
    commands: [{ type: 'showText', text: 'Page two' }],
  });
  return {
    id: 'npc_1',
    type: 'npc',
    x: 3,
    y: 4,
    solid: true,
    sprite: 'npc_old_man',
    trigger: 'interact',
    commands: first.commands,
    pages: [first, second],
  };
}

function mapData(gameEvent: GameEvent = event()): MapData {
  return {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    width: 10,
    height: 8,
    tileSize: 32,
    tilesetId: 'sample-town',
    layers: [
      { name: 'ground', type: 'visual', role: 'ground', tiles: new Array(80).fill(1) },
      { name: 'collision', type: 'collision', role: 'collision', tiles: new Array(80).fill(0) },
      { name: 'region', type: 'region', role: 'region', tiles: new Array(80).fill(0) },
    ],
    events: [gameEvent],
  };
}

function projectState(gameEvent: GameEvent = event()): ProjectStoreState {
  return {
    ...initialProjectStoreState,
    project: {
      ...initialProjectStoreState.project,
      startMapId: 'town',
      maps: [{ id: 'town', path: 'data/maps/town.json', parentId: null, order: 0, expanded: true }],
    },
    maps: { town: mapData(gameEvent) },
    databases: {
      ...initialProjectStoreState.databases,
      switches: [{ id: 'story_ready', name: 'Story Ready', initial: false }],
      variables: [{ id: 'score', name: 'Score', initial: 0 }],
    },
  };
}

function renderScreen() {
  const projectDispatch = vi.fn<(action: ProjectAction) => void>();
  const editorDispatch = vi.fn<(action: EditorAction) => void>();
  const selected = event();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <EditorContext.Provider
        value={{
          state: {
            ...initialEditorState,
            activeScreen: 'events',
            selectedMapId: 'town',
            selectedEvent: selected,
            selectedEventMapId: 'town',
          },
          dispatch: editorDispatch,
        }}
      >
        <ProjectContext.Provider value={{ state: projectState(selected), dispatch: projectDispatch }}>
          <EventEditorScreen />
        </ProjectContext.Provider>
      </EditorContext.Provider>,
    );
  });
  return {
    container,
    projectDispatch,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function click(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function changeSelect(element: HTMLSelectElement, value: string) {
  act(() => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function controlByLabel<T extends HTMLInputElement | HTMLSelectElement>(
  container: HTMLElement,
  label: string,
): T {
  const labelNode = Array.from(container.querySelectorAll('label')).find(node =>
    node.textContent?.trim() === label,
  );
  if (!labelNode?.htmlFor) throw new Error(`Missing label: ${label}`);
  const control = container.ownerDocument.getElementById(labelNode.htmlFor);
  if (!control) throw new Error(`Missing control for label: ${label}`);
  return control as T;
}

function selectPageTwo(container: HTMLElement) {
  const pageTwo = Array.from(container.querySelectorAll('button')).find(button =>
    button.textContent?.trim() === 'Page 2',
  );
  if (!pageTwo) throw new Error('Missing Page 2 tab');
  click(pageTwo);
}

describe('EventEditorScreen surface polish', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('edits selected page graphics instead of legacy event graphics', () => {
    const view = renderScreen();
    selectPageTwo(view.container);

    changeSelect(controlByLabel<HTMLSelectElement>(view.container, 'Page sprite'), 'npc_placeholder');

    expect(view.projectDispatch).toHaveBeenLastCalledWith({
      type: 'UPDATE_EVENT_PAGE',
      mapId: 'town',
      eventId: 'npc_1',
      pageId: 'page_2',
      changes: {
        graphic: {
          sprite: 'npc_placeholder',
          animationSet: 'npc_old_man',
          displayHeightTiles: 1.5,
        },
      },
    });
  });

  it('exposes page condition, movement, and option controls without JSON editing', () => {
    const view = renderScreen();
    selectPageTwo(view.container);

    expect(view.container.textContent).toContain('Page Conditions');
    expect(view.container.textContent).toContain('Switch Conditions');
    expect(view.container.textContent).toContain('Variable Conditions');
    expect(controlByLabel<HTMLSelectElement>(view.container, 'Movement Type')).not.toBeNull();
    expect(controlByLabel<HTMLSelectElement>(view.container, 'Movement Speed')).not.toBeNull();
    expect(view.container.textContent).toContain('Walking animation');
    expect(view.container.textContent).toContain('Through');
  });

  it('adds switch conditions through page-level changes', () => {
    const view = renderScreen();
    selectPageTwo(view.container);
    const addSwitch = Array.from(view.container.querySelectorAll('button')).find(button =>
      button.textContent?.trim() === 'Add switch condition',
    );
    if (!addSwitch) throw new Error('Missing add switch condition button');

    click(addSwitch);

    expect(view.projectDispatch).toHaveBeenLastCalledWith({
      type: 'UPDATE_EVENT_PAGE',
      mapId: 'town',
      eventId: 'npc_1',
      pageId: 'page_2',
      changes: {
        conditions: {
          selfSwitches: { A: true },
          switches: { story_ready: true, switch_2: true },
          variables: [{ variableId: 'score', op: 'gte', value: 10 }],
        },
      },
    });
  });

  it('keeps command edits scoped to the selected page id', () => {
    const view = renderScreen();
    selectPageTwo(view.container);
    const command = Array.from(view.container.querySelectorAll('input[type="checkbox"]')).find(input =>
      input.getAttribute('aria-label')?.includes('Page two'),
    );
    if (!(command instanceof HTMLInputElement)) throw new Error('Missing Page two command checkbox');
    click(command);
    const textarea = view.container.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('Missing selected command textarea');

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea), 'value')?.set;
      setter?.call(textarea, 'Page two updated');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(view.projectDispatch).toHaveBeenLastCalledWith({
      type: 'UPDATE_PAGE_COMMAND',
      mapId: 'town',
      eventId: 'npc_1',
      pageId: 'page_2',
      path: [0],
      command: { type: 'showText', text: 'Page two updated' },
    });
  });
});
