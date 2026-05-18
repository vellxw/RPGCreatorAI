import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VISUAL_PROFILE,
  normalizeVisualProfile,
  type VisualProfileInput,
} from '../visualProfile';

describe('visualProfile', () => {
  it('provides a modern 16:9 default profile', () => {
    expect(DEFAULT_VISUAL_PROFILE).toEqual({
      aspectRatio: '16:9',
      baseResolution: { width: 1280, height: 720 },
      tileSize: 32,
      cameraMode: 'follow-player',
      mapPresentation: 'full-scene',
      zoom: 1,
      integerScale: true,
    });
  });

  it('normalizes missing legacy fields without mutating callers', () => {
    const input: VisualProfileInput = {};
    const normalized = normalizeVisualProfile(input);

    expect(normalized).toEqual(DEFAULT_VISUAL_PROFILE);
    expect(input).toEqual({});
  });

  it('accepts square and custom authored profiles while preserving safe defaults', () => {
    expect(
      normalizeVisualProfile({
        aspectRatio: '1:1',
        baseResolution: { width: 768, height: 768 },
        cameraMode: 'fixed-room',
        mapPresentation: 'compact-room',
        integerScale: false,
      }),
    ).toEqual({
      aspectRatio: '1:1',
      baseResolution: { width: 768, height: 768 },
      tileSize: 32,
      cameraMode: 'fixed-room',
      mapPresentation: 'compact-room',
      zoom: 1,
      integerScale: false,
    });

    expect(
      normalizeVisualProfile({
        aspectRatio: 'custom',
        baseResolution: { width: 960, height: 540 },
        tileSize: 24,
        zoom: 2,
      }),
    ).toMatchObject({
      aspectRatio: 'custom',
      baseResolution: { width: 960, height: 540 },
      tileSize: 24,
      zoom: 2,
    });
  });
});
