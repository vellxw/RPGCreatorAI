import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { RuntimeLaunchFeedback, type RuntimeLaunchFeedbackState } from '../RuntimeLaunchFeedback';

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

describe('RuntimeLaunchFeedback', () => {
  it('shows a clear desktop-unavailable state without fake launch data', () => {
    const feedback: RuntimeLaunchFeedbackState = {
      tone: 'warning',
      title: 'Native runtime launch unavailable',
      detail: 'Run inside the Tauri desktop shell to launch Project Start.',
    };
    const view = render(<RuntimeLaunchFeedback feedback={feedback} />);

    expect(view.container.textContent).toContain('Native runtime launch unavailable');
    expect(view.container.textContent).toContain('Run inside the Tauri desktop shell');
    expect(view.container.textContent).not.toContain('pid');
    expect(view.container.textContent).not.toContain('session-');
    view.unmount();
  });

  it('renders project-start launch progress while the temp session is being built', () => {
    const feedback: RuntimeLaunchFeedbackState = {
      tone: 'loading',
      title: 'Preparing Project Start playtest',
      detail: 'Validating project data and writing a temporary session.',
    };
    const view = render(<RuntimeLaunchFeedback feedback={feedback} />);

    expect(view.container.textContent).toContain('Preparing Project Start playtest');
    expect(view.container.textContent).toContain('temporary session');
    view.unmount();
  });

  it('renders success with session root and diagnostics guidance', () => {
    const feedback: RuntimeLaunchFeedbackState = {
      tone: 'success',
      title: 'Project Start runtime launched',
      detail: 'PID 4242 is running from a temporary playtest session.',
      sessionRoot: 'C:\\Users\\me\\AppData\\Roaming\\RPGCreatorAI\\playtest-sessions\\session-1',
      diagnosticsHint: 'Use Runtime Log, Event Trace, and Runtime State for launch output.',
    };
    const view = render(<RuntimeLaunchFeedback feedback={feedback} />);

    expect(view.container.textContent).toContain('Project Start runtime launched');
    expect(view.container.textContent).toContain('session-1');
    expect(view.container.textContent).toContain('Runtime Log, Event Trace, and Runtime State');
    view.unmount();
  });

  it('renders launch failures with recovery context', () => {
    const feedback: RuntimeLaunchFeedbackState = {
      tone: 'error',
      title: 'Project Start launch failed',
      detail: 'runtime executable not found',
      sessionRoot: 'C:\\Users\\me\\AppData\\Roaming\\RPGCreatorAI\\playtest-sessions\\session-failed',
      diagnosticsHint: 'Failed process starts are reported here.',
    };
    const view = render(<RuntimeLaunchFeedback feedback={feedback} />);

    expect(view.container.textContent).toContain('Project Start launch failed');
    expect(view.container.textContent).toContain('runtime executable not found');
    expect(view.container.textContent).toContain('session-failed');
    expect(view.container.textContent).toContain('Failed process starts are reported here.');
    view.unmount();
  });
});
