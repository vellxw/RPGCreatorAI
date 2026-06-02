import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { RuntimeStatePanel, parseRuntimeStateSnapshot } from '../RuntimeStatePanel';

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

const sampleSnapshot = JSON.stringify({
  frameNumber: 42,
  mapId: 'town',
  player: { x: 10, y: 12, direction: 'up' },
  gold: 125,
  party: ['hero', 'mage'],
  switches: { intro_done: true },
  variables: { visit_count: 3 },
  selfSwitches: { 'town:npc_1:A': true },
  inventory: { potion: 2 },
  active: { dialogue: true, menu: false, shop: true, battle: false },
  runningEventIds: ['map:town:npc_1', 'common:intro'],
});

describe('RuntimeStatePanel', () => {
  it('parses native runtime snapshot JSON', () => {
    const snapshot = parseRuntimeStateSnapshot(sampleSnapshot);

    expect(snapshot?.frameNumber).toBe(42);
    expect(snapshot?.mapId).toBe('town');
    expect(snapshot?.player.direction).toBe('up');
    expect(snapshot?.switches.intro_done).toBe(true);
    expect(snapshot?.runningEventIds).toContain('common:intro');
  });

  it('renders bounded native state details and honest unavailable state', () => {
    const view = render(
      <RuntimeStatePanel
        available
        snapshotText={sampleSnapshot}
        snapshotPath="C:\\runtime-logs\\runtime-state-snapshot.json"
      />,
    );

    expect(view.container.textContent).toContain('Native Runtime State');
    expect(view.container.textContent).toContain('Frame 42');
    expect(view.container.textContent).toContain('town');
    expect(view.container.textContent).toContain('10, 12');
    expect(view.container.textContent).toContain('intro_done');
    expect(view.container.textContent).toContain('map:town:npc_1');
    view.unmount();

    const unavailable = render(
      <RuntimeStatePanel
        available={false}
        unavailableReason="Native runtime snapshots are unavailable in browser mode."
        snapshotText={sampleSnapshot}
      />,
    );
    expect(unavailable.container.textContent).toContain('Native runtime state unavailable');
    expect(unavailable.container.textContent).toContain('browser mode');
    expect(unavailable.container.textContent).not.toContain('Frame 42');
    unavailable.unmount();
  });

  it('guides the first native state snapshot', () => {
    const view = render(<RuntimeStatePanel available snapshotText="" />);

    expect(view.container.textContent).toContain('No runtime state snapshot yet');
    expect(view.container.textContent).toContain('Launch the runtime');
    expect(view.container.textContent).toContain('Refresh after a playtest is running');
    view.unmount();
  });
});
