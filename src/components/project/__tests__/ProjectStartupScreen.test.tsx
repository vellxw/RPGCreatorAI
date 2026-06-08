import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectStartupScreen } from '../ProjectStartupScreen';

function render(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find(
    candidate => candidate.textContent?.includes(label),
  );
  if (!match) throw new Error(`Missing button ${label}`);
  return match;
}

function changeText(el: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
    const prototype = Object.getPrototypeOf(el);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(el, value);
    } else {
      valueSetter?.call(el, value);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ProjectStartupScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('shows desktop open and create actions without hiding the bundled sample', () => {
    const view = render(
      <ProjectStartupScreen
        desktop
        sampleTitle="My First RPG"
        onUseSample={vi.fn()}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onImportProject={vi.fn()}
      />,
    );

    const text = view.container.textContent ?? '';
    expect(text).toContain('Start a project');
    expect(text).toContain('My First RPG');
    expect(text).toContain('Open Project Folder');
    expect(text).toContain('Create Project');
    expect(text).toContain('Import Project Bundle');
    expect(text).not.toContain('Browser mode cannot open folders');

    view.unmount();
  });

  it('keeps browser mode honest while still allowing an in-memory new project', () => {
    const create = vi.fn();
    const view = render(
      <ProjectStartupScreen
        desktop={false}
        sampleTitle="My First RPG"
        onUseSample={vi.fn()}
        onOpenProject={vi.fn()}
        onCreateProject={create}
        onImportProject={vi.fn()}
      />,
    );

    const input = view.container.querySelector('input[type="text"]') as HTMLInputElement;
    changeText(input, 'Browser Sketch');
    act(() => button(view.container, 'Create Browser Project').click());

    const text = view.container.textContent ?? '';
    expect(text).toContain('Browser mode cannot open folders');
    expect(text).toContain('saved to browser memory until you export');
    expect(create).toHaveBeenCalledWith('Browser Sketch');

    view.unmount();
  });

  it('starts keyboard focus on the first available startup action', () => {
    const desktopView = render(
      <ProjectStartupScreen
        desktop
        sampleTitle="My First RPG"
        onUseSample={vi.fn()}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onImportProject={vi.fn()}
      />,
    );

    expect(document.activeElement?.tagName).toBe('BUTTON');
    expect(document.activeElement?.textContent).toContain('Open Project Folder');
    desktopView.unmount();

    const browserView = render(
      <ProjectStartupScreen
        desktop={false}
        sampleTitle="My First RPG"
        onUseSample={vi.fn()}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onImportProject={vi.fn()}
      />,
    );

    expect(document.activeElement?.tagName).toBe('BUTTON');
    expect(document.activeElement?.textContent).toContain('Import Project Bundle');
    browserView.unmount();
  });

  it('associates the project-name input and announces startup status messages', () => {
    const view = render(
      <ProjectStartupScreen
        desktop
        sampleTitle="My First RPG"
        statusMessage="Open failed with a recoverable status."
        runtimeStatusMessage="Native runtime unavailable but editing is available."
        onUseSample={vi.fn()}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onImportProject={vi.fn()}
      />,
    );

    const label = Array.from(view.container.querySelectorAll('label')).find(
      candidate => candidate.textContent === 'New project name',
    );
    const input = view.container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(label?.getAttribute('for')).toBe(input.id);

    const statuses = Array.from(view.container.querySelectorAll('[role="status"]'));
    expect(statuses.map(status => status.textContent).join(' ')).toContain(
      'Open failed with a recoverable status.',
    );
    expect(statuses.map(status => status.textContent).join(' ')).toContain(
      'Native runtime unavailable but editing is available.',
    );

    view.unmount();
  });

  it('renders recovery guidance without hiding startup actions', () => {
    const view = render(
      <ProjectStartupScreen
        desktop
        sampleTitle="My First RPG"
        recoveryState={{
          title: 'Open project failed',
          detail:
            'This folder does not look like an RPGCreatorAI project. Choose a folder containing data/project.json.',
          options: [
            'Open Project Folder',
            'Create Project',
            'Import Project Bundle',
            'Use bundled sample',
          ],
        }}
        onUseSample={vi.fn()}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onImportProject={vi.fn()}
      />,
    );

    const text = view.container.textContent ?? '';
    expect(text).toContain('Open project failed');
    expect(text).toContain('Recovery options');
    expect(text).toContain('data/project.json');
    expect(text).toContain('Open Project Folder');
    expect(text).toContain('Create Project');
    expect(text).toContain('Import Project Bundle');
    expect(text).toContain('Use My First RPG');

    view.unmount();
  });
});
