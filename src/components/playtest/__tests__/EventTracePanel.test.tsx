import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { EventTracePanel, parseEventTraceRows } from '../EventTracePanel';

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

const sampleLog = [
  '[INFO] Runtime started',
  '[TRACE] {"sequence":1,"sourceType":"mapEvent","mapId":"town","eventId":"npc_1","commonEventId":"","commandPath":"0","commandType":"ifFlag","action":"branch","result":"then"}',
  '[TRACE] {"sequence":2,"sourceType":"commonEvent","mapId":"town","eventId":"","commonEventId":"intro","commandPath":"0","commandType":"showText","action":"start","result":"queued"}',
  '[TRACE] {"sequence":3,"sourceType":"mapEvent","mapId":"town","eventId":"npc_1","commonEventId":"","commandPath":"1","commandType":"pluginCommand","action":"warning","result":"unsupported"}',
].join('\n');

describe('EventTracePanel', () => {
  it('parses deterministic TRACE rows from runtime log text', () => {
    const rows = parseEventTraceRows(sampleLog);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      sequence: 1,
      sourceType: 'mapEvent',
      mapId: 'town',
      eventId: 'npc_1',
      commandType: 'ifFlag',
      action: 'branch',
      result: 'then',
    });
    expect(rows[1].commonEventId).toBe('intro');
  });

  it('renders source filters for map events common events warnings and branches', () => {
    const view = render(<EventTracePanel logText={sampleLog} />);

    expect(view.container.textContent).toContain('3 trace rows');
    expect(view.container.textContent).toContain('npc_1');
    expect(view.container.textContent).toContain('intro');

    const buttons = Array.from(view.container.querySelectorAll('button'));
    act(() => buttons.find(button => button.textContent === 'Warning')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.container.textContent).toContain('pluginCommand');
    expect(view.container.textContent).not.toContain('showText');

    act(() => buttons.find(button => button.textContent === 'Branch')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.container.textContent).toContain('ifFlag');
    expect(view.container.textContent).not.toContain('pluginCommand');

    act(() => buttons.find(button => button.textContent === 'Common')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.container.textContent).toContain('intro');
    expect(view.container.textContent).not.toContain('npc_1');

    view.unmount();
  });

  it('guides the first trace instead of leaving an unexplained blank table', () => {
    const view = render(<EventTracePanel logText="" />);

    expect(view.container.textContent).toContain('No event trace rows yet');
    expect(view.container.textContent).toContain('Launch the native runtime');
    expect(view.container.textContent).toContain('trigger a map event or common event');
    view.unmount();
  });
});
