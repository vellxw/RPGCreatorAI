import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RuntimeMediaAccessibilityPanel,
  readSystemReducedMotion,
  type ReducedMotionHost,
} from '../RuntimeMediaAccessibilityPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mediaHost(initialMatches: boolean): {
  host: ReducedMotionHost;
  change: (matches: boolean) => void;
} {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    media: '(prefers-reduced-motion: reduce)',
    get matches() { return matches; },
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener as (event: MediaQueryListEvent) => void);
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.delete(listener as (event: MediaQueryListEvent) => void);
    },
    dispatchEvent: () => true,
    addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
  } as MediaQueryList;

  return {
    host: { matchMedia: () => query },
    change: next => {
      matches = next;
      listeners.forEach(listener => listener({ matches: next } as MediaQueryListEvent));
    },
  };
}

function renderPanel(host: ReducedMotionHost | null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<RuntimeMediaAccessibilityPanel storage={null} reducedMotionHost={host} />);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('RuntimeMediaAccessibilityPanel offline behavior', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders safe defaults when storage and matchMedia are unavailable', () => {
    const view = renderPanel(null);

    expect(readSystemReducedMotion(null)).toBe(false);
    expect(view.container.textContent).toContain('Session only');
    expect(view.container.textContent).toContain('Effective motion: full');
    expect(view.container.querySelector<HTMLInputElement>('#runtime-subtitles-enabled')?.checked).toBe(true);
    expect(view.container.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.textContent).toBe('System');

    const reducedMotion = Array.from(view.container.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent === 'Reduced');
    act(() => reducedMotion?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.container.textContent).toContain('Effective motion: reduced');
    expect(view.container.textContent).toContain('This explicit choice overrides the system preference for playtest.');

    view.unmount();
  });

  it('tracks the host reduced-motion preference without network access', () => {
    const motion = mediaHost(true);
    const view = renderPanel(motion.host);

    expect(readSystemReducedMotion(motion.host)).toBe(true);
    expect(view.container.textContent).toContain('Effective motion: reduced');
    expect(view.container.textContent).toContain('This device currently reports reduced motion.');

    act(() => motion.change(false));
    expect(view.container.textContent).toContain('Effective motion: full');
    expect(view.container.textContent).toContain('This device currently reports full motion.');

    view.unmount();
  });
});
