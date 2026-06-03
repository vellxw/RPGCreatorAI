import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandStackEditor } from '../CommandStackEditor';
import type { EventCommand } from '../../../types/project';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderCommandStackEditor(props: {
  commands: EventCommand[];
  mapIds: string[];
  itemIds: string[];
  onCommandsChange?: (cmds: EventCommand[]) => void;
  operations?: any;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;

  act(() => {
    root = createRoot(container);
    root.render(
      <CommandStackEditor
        commands={props.commands}
        mapIds={props.mapIds}
        itemIds={props.itemIds}
        onCommandsChange={props.onCommandsChange}
        operations={props.operations}
      />
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

describe('Event Command Generation UI Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('opens the AI event command generator, generates commands, validates, and inserts via operations', async () => {
    const onCommandsChangeMock = vi.fn();
    const insertMock = vi.fn();
    const operations = {
      insert: insertMock,
    };

    const view = renderCommandStackEditor({
      commands: [],
      mapIds: ['map_town'],
      itemIds: ['potion'],
      onCommandsChange: onCommandsChangeMock,
      operations,
    });

    const sparklesButton = view.container.querySelector<HTMLButtonElement>('button[aria-label="Generate event commands"]');
    expect(sparklesButton).not.toBeNull();

    // Open modal
    act(() => {
      sparklesButton?.click();
    });

    expect(document.body.innerHTML).toContain('Generate Event Commands');

    const generateButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Generate Draft"]');
    expect(generateButton).not.toBeNull();

    // Generate commands (uses mock adapter internally)
    await act(async () => {
      generateButton?.click();
    });

    expect(document.body.innerHTML).toContain('Candidate Review Details');
    expect(document.body.innerHTML).toContain('[showText]');
    expect(document.body.innerHTML).toContain('[addItem]');

    const acceptButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Accept and Insert"]');
    expect(acceptButton).not.toBeNull();

    // Accept and insert
    act(() => {
      acceptButton?.click();
    });

    // Modal should close
    expect(document.body.innerHTML).not.toContain('Generate Event Commands');

    // Verify operations.insert was called for each generated command
    expect(insertMock).toHaveBeenCalledTimes(3);
    expect(insertMock).toHaveBeenNthCalledWith(1, expect.any(Array), 'append', expect.objectContaining({ type: 'showText' }));
    expect(insertMock).toHaveBeenNthCalledWith(2, expect.any(Array), 'append', expect.objectContaining({ type: 'addItem' }));
    expect(insertMock).toHaveBeenNthCalledWith(3, expect.any(Array), 'append', expect.objectContaining({ type: 'controlSelfSwitch' }));

    view.unmount();
  });

  it('opens the AI event command generator, generates commands, validates, and inserts after selected command via operations', async () => {
    const onCommandsChangeMock = vi.fn();
    const insertMock = vi.fn();
    const operations = {
      insert: insertMock,
    };

    const initialCommands: EventCommand[] = [
      { type: 'comment', text: 'initial comment' },
    ];

    const view = renderCommandStackEditor({
      commands: initialCommands,
      mapIds: ['map_town'],
      itemIds: ['potion'],
      onCommandsChange: onCommandsChangeMock,
      operations,
    });

    // Select the first command
    const firstCheckbox = view.container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(firstCheckbox).not.toBeNull();
    act(() => {
      firstCheckbox?.click();
    });

    const sparklesButton = view.container.querySelector<HTMLButtonElement>('button[aria-label="Generate event commands"]');
    expect(sparklesButton).not.toBeNull();

    // Open modal
    act(() => {
      sparklesButton?.click();
    });

    const generateButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Generate Draft"]');
    expect(generateButton).not.toBeNull();

    await act(async () => {
      generateButton?.click();
    });

    const acceptButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Accept and Insert"]');
    expect(acceptButton).not.toBeNull();

    // Accept and insert
    act(() => {
      acceptButton?.click();
    });

    // Verify operations.insert was called with 'after'
    expect(insertMock).toHaveBeenCalledTimes(3);
    expect(insertMock).toHaveBeenNthCalledWith(1, [0], 'after', expect.objectContaining({ type: 'showText' }));
    expect(insertMock).toHaveBeenNthCalledWith(2, [1], 'after', expect.objectContaining({ type: 'addItem' }));
    expect(insertMock).toHaveBeenNthCalledWith(3, [2], 'after', expect.objectContaining({ type: 'controlSelfSwitch' }));

    view.unmount();
  });

  it('opens the AI event command generator, generates commands, validates, and inserts via onCommandsChange when operations is not provided', async () => {
    const onCommandsChangeMock = vi.fn();

    const view = renderCommandStackEditor({
      commands: [],
      mapIds: ['map_town'],
      itemIds: ['potion'],
      onCommandsChange: onCommandsChangeMock,
    });

    const sparklesButton = view.container.querySelector<HTMLButtonElement>('button[aria-label="Generate event commands"]');
    expect(sparklesButton).not.toBeNull();

    // Open modal
    act(() => {
      sparklesButton?.click();
    });

    const generateButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Generate Draft"]');
    expect(generateButton).not.toBeNull();

    await act(async () => {
      generateButton?.click();
    });

    const acceptButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Accept and Insert"]');
    expect(acceptButton).not.toBeNull();

    // Accept and insert
    act(() => {
      acceptButton?.click();
    });

    // Verify onCommandsChange was called with the full list of next commands
    expect(onCommandsChangeMock).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'showText' }),
      expect.objectContaining({ type: 'addItem' }),
      expect.objectContaining({ type: 'controlSelfSwitch' }),
    ]);

    view.unmount();
  });
});
