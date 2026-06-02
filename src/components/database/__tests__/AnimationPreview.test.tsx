import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationPreview } from '../AnimationPreview';

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

describe('AnimationPreview', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders imported spritesheets when a preview URL is supplied', () => {
    const view = render(
      <AnimationPreview
        clip={{
          action: 'run',
          direction: 'right',
          asset: 'hero_run_sheet',
          frameSize: { width: 48, height: 48 },
          frameCount: 3,
          fps: 6,
          loop: true,
          anchor: { x: 24, y: 42 },
        }}
        display={{ heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 }}
        assetPreviewUrls={{ hero_run_sheet: 'data:image/png;base64,preview' }}
      />,
    );

    const preview = view.container.querySelector('svg[aria-label="Animation preview"]');
    const image = view.container.querySelector('image');
    expect(preview).not.toBeNull();
    expect(image?.getAttribute('href')).toBe('data:image/png;base64,preview');
    expect(view.container.textContent).toContain('run/right');

    view.unmount();
  });
});
