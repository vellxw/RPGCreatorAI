import { describe, expect, it } from 'vitest';
import {
  computeCameraFrame,
  computeFitScale,
  computePreviewSceneBounds,
  getVisibleTileSpan,
  type PixelSize,
} from '../viewport';

describe('viewport helpers', () => {
  it('computes visible tile span from viewport pixels and tile size', () => {
    expect(getVisibleTileSpan({ width: 1280, height: 720 }, 32)).toEqual({
      columns: 40,
      rows: 23,
    });
    expect(getVisibleTileSpan({ width: 768, height: 768 }, 32)).toEqual({
      columns: 24,
      rows: 24,
    });
  });

  it('computes a fit scale that preserves scene aspect ratio', () => {
    const content: PixelSize = { width: 1280, height: 720 };
    const available: PixelSize = { width: 900, height: 600 };
    expect(computeFitScale(content, available)).toBeCloseTo(0.703125);
  });

  it('never returns a non-positive fit scale for invalid container sizes', () => {
    expect(computeFitScale({ width: 1280, height: 720 }, { width: 0, height: 0 })).toBe(1);
  });

  it('computes a clamped follow-player camera frame', () => {
    expect(
      computeCameraFrame({
        viewport: { width: 1280, height: 720 },
        map: { width: 1920, height: 1080 },
        focus: { x: 1824, y: 984 },
        cameraMode: 'follow-player',
      }),
    ).toEqual({
      x: 640,
      y: 360,
      width: 1280,
      height: 720,
    });
  });

  it('expands preview bounds to include a centered small-room viewport frame', () => {
    expect(
      computePreviewSceneBounds({
        map: { width: 320, height: 320 },
        frame: { x: -480, y: -200, width: 1280, height: 720 },
      }),
    ).toEqual({
      x: -480,
      y: -200,
      width: 1280,
      height: 720,
    });
  });
});
