import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandStackEditor } from '../CommandStackEditor';
import type { EventCommand } from '../../../types/project';

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

function selectByLabel(container: HTMLElement, label: string): HTMLSelectElement {
  const found = Array.from(container.querySelectorAll('select')).find(select =>
    Array.from(select.options).some(option => option.textContent === label),
  );
  if (!(found instanceof HTMLSelectElement)) throw new Error(`Missing select with option: ${label}`);
  return found;
}

function checkboxByDescription(container: HTMLElement, text: string): HTMLInputElement {
  const found = Array.from(container.querySelectorAll('input[type="checkbox"]')).find(input =>
    input.getAttribute('aria-label')?.includes(text),
  );
  if (!(found instanceof HTMLInputElement)) throw new Error(`Missing command checkbox: ${text}`);
  return found;
}

function click(element: Element, init: MouseEventInit = {}) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
  });
}

function changeSelect(element: HTMLSelectElement, value: string) {
  act(() => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function changeTextarea(element: HTMLTextAreaElement, value: string) {
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

describe('CommandStackEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('adds a command to an empty common event stack', () => {
    const onCommandsChange = vi.fn();
    const view = render(
      <CommandStackEditor
        commands={[]}
        mapIds={['town']}
        itemIds={['potion']}
        onCommandsChange={onCommandsChange}
      />,
    );

    changeSelect(selectByLabel(view.container, 'Show Text'), 'showText');

    expect(onCommandsChange).toHaveBeenLastCalledWith([{ type: 'showText', text: 'New dialogue' }]);
  });

  it('adds a deterministic plugin command placeholder', () => {
    const onCommandsChange = vi.fn();
    const view = render(
      <CommandStackEditor
        commands={[]}
        mapIds={['town']}
        itemIds={['potion']}
        onCommandsChange={onCommandsChange}
      />,
    );

    changeSelect(selectByLabel(view.container, 'Plugin Command'), 'pluginCommand');

    expect(onCommandsChange).toHaveBeenLastCalledWith([
      {
        type: 'pluginCommand',
        pluginId: 'debug',
        command: 'log',
        args: { message: 'New plugin command' },
      },
    ]);
  });

  it('edits nested branch commands without mutating the source command list', () => {
    const commands: EventCommand[] = [
      {
        type: 'ifSwitch',
        switchId: 'story_ready',
        equals: true,
        then: [{ type: 'showText', text: 'Nested old' }],
        else: [],
      },
    ];
    const onCommandsChange = vi.fn();
    const view = render(
      <CommandStackEditor
        commands={commands}
        mapIds={['town']}
        itemIds={['potion']}
        onCommandsChange={onCommandsChange}
      />,
    );

    click(checkboxByDescription(view.container, 'Nested old'));
    const textarea = view.container.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('Missing selected command textarea');
    changeTextarea(textarea, 'Nested new');

    expect(onCommandsChange).toHaveBeenLastCalledWith([
      {
        type: 'ifSwitch',
        switchId: 'story_ready',
        equals: true,
        then: [{ type: 'showText', text: 'Nested new' }],
        else: [],
      },
    ]);
    expect(commands[0]).toEqual({
      type: 'ifSwitch',
      switchId: 'story_ready',
      equals: true,
      then: [{ type: 'showText', text: 'Nested old' }],
      else: [],
    });
  });

  it('range-deletes contiguous commands from the same branch', () => {
    const commands: EventCommand[] = [
      { type: 'showText', text: 'Keep' },
      { type: 'showText', text: 'Drop A' },
      { type: 'showText', text: 'Drop B' },
      { type: 'showText', text: 'Tail' },
    ];
    const onCommandsChange = vi.fn();
    const view = render(
      <CommandStackEditor
        commands={commands}
        mapIds={['town']}
        itemIds={['potion']}
        onCommandsChange={onCommandsChange}
      />,
    );

    click(checkboxByDescription(view.container, 'Drop A'));
    click(checkboxByDescription(view.container, 'Drop B'), { shiftKey: true });
    const deleteButton = view.container.querySelector('button[title="Delete"]');
    if (!(deleteButton instanceof HTMLButtonElement)) throw new Error('Missing delete button');
    click(deleteButton);

    expect(onCommandsChange).toHaveBeenLastCalledWith([
      { type: 'showText', text: 'Keep' },
      { type: 'showText', text: 'Tail' },
    ]);
  });

  it('edits movement route wait steps with named controls while preserving step order', () => {
    const commands: EventCommand[] = [
      {
        type: 'setMovementRoute',
        target: 'player',
        repeat: false,
        skippable: true,
        wait: true,
        steps: [{ type: 'moveDown' }, { type: 'wait', ms: 250 }],
      },
    ];
    const onCommandsChange = vi.fn();
    const view = render(
      <CommandStackEditor
        commands={commands}
        mapIds={['town']}
        itemIds={['potion']}
        onCommandsChange={onCommandsChange}
      />,
    );

    click(checkboxByDescription(view.container, '2 steps'));
    const waitInput = view.container.querySelector<HTMLInputElement>('input[aria-label="Route step 2 wait ms"]');
    if (!(waitInput instanceof HTMLInputElement)) throw new Error('Missing route wait input');
    changeInput(waitInput, '500');

    expect(onCommandsChange).toHaveBeenLastCalledWith([
      {
        type: 'setMovementRoute',
        target: 'player',
        repeat: false,
        skippable: true,
        wait: true,
        steps: [{ type: 'moveDown' }, { type: 'wait', ms: 500 }],
      },
    ]);
  });
});
