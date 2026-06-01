import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeLogPanel } from '../RuntimeLogPanel';

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

describe('RuntimeLogPanel', () => {
  it('shows an honest unavailable state without fabricated log output', () => {
    const view = render(
      <RuntimeLogPanel
        available={false}
        unavailableReason="Browser mode cannot read native runtime logs."
        content="[INFO] fake"
        onRefresh={vi.fn()}
        onCopy={vi.fn()}
        onOpenFolder={vi.fn()}
      />,
    );

    expect(view.container.textContent).toContain('Native runtime logs unavailable');
    expect(view.container.textContent).toContain('Browser mode cannot read native runtime logs.');
    expect(view.container.textContent).not.toContain('[INFO] fake');
    view.unmount();
  });

  it('renders bounded log content and wires refresh, copy, and folder actions', () => {
    const onRefresh = vi.fn();
    const onCopy = vi.fn();
    const onOpenFolder = vi.fn();
    const view = render(
      <RuntimeLogPanel
        available
        diagnosticsDir={'C:\\Users\\me\\AppData\\Roaming\\RPGCreatorAI\\runtime-logs'}
        logPath={'C:\\Users\\me\\AppData\\Roaming\\RPGCreatorAI\\runtime-logs\\runtime.log'}
        content="[INFO] Runtime started"
        truncated
        onRefresh={onRefresh}
        onCopy={onCopy}
        onOpenFolder={onOpenFolder}
      />,
    );

    expect(view.container.textContent).toContain('runtime.log');
    expect(view.container.textContent).toContain('C:\\Users\\me\\AppData\\Roaming\\RPGCreatorAI\\runtime-logs');
    expect(view.container.textContent).toContain('[INFO] Runtime started');
    expect(view.container.textContent).toContain('Showing the latest 256 KiB');

    const buttons = Array.from(view.container.querySelectorAll('button'));
    act(() => buttons.find(button => button.title === 'Refresh log')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => buttons.find(button => button.title === 'Copy log text')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => buttons.find(button => button.title === 'Open log folder')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onOpenFolder).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('shows a diagnostics folder before the first runtime log exists', () => {
    const view = render(
      <RuntimeLogPanel
        available
        diagnosticsDir={'C:\\Users\\me\\AppData\\Roaming\\RPGCreatorAI\\runtime-logs'}
        content=""
        error="no runtime log has been created yet"
        onRefresh={vi.fn()}
        onCopy={vi.fn()}
        onOpenFolder={vi.fn()}
      />,
    );

    expect(view.container.textContent).toContain('Diagnostics folder');
    expect(view.container.textContent).toContain('runtime-logs');
    expect(view.container.textContent).toContain('no runtime log has been created yet');
    view.unmount();
  });
});
