import { describe, expect, it } from 'vitest';
import {
  createRuntimeAccessibilityPreferences,
  resolveGoreVariant,
  resolveMotionPolicy,
  validateGoreVariantSet,
  validateRuntimeAccessibilityPreferences,
  type GoreVariantSetV1,
} from '../accessibilityContracts';

describe('runtime accessibility contracts', () => {
  it('defaults to subtitles, system motion, and reduced gore', () => {
    const preferences = createRuntimeAccessibilityPreferences();
    expect(preferences).toMatchObject({
      subtitles: { enabled: true, speakerLabels: true, soundCues: true },
      motion: { preference: 'system' },
      gore: { mode: 'reduced' },
    });
    expect(validateRuntimeAccessibilityPreferences(preferences)).toEqual({ valid: true, issues: [] });
  });

  it('rejects unsafe or non-finite preference values', () => {
    const preferences = createRuntimeAccessibilityPreferences();
    const report = validateRuntimeAccessibilityPreferences({
      ...preferences,
      subtitles: { ...preferences.subtitles, textScale: Number.NaN, maxLines: 10 },
      motion: { preference: 'lots' },
      gore: { mode: true },
    });
    expect(report.valid).toBe(false);
    expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'invalid-subtitles',
      'invalid-motion',
      'invalid-gore',
    ]));
  });

  it('resolves system reduced-motion into static alternatives', () => {
    expect(resolveMotionPolicy('system', true)).toEqual({
      reduced: true,
      cameraShake: false,
      parallax: false,
      decorativeLoops: false,
      transitionDurationScale: 0.2,
      preserveEssentialStateChanges: true,
    });
    expect(resolveMotionPolicy('full', true).reduced).toBe(false);
  });
});

describe('gore variants', () => {
  const variants: GoreVariantSetV1 = {
    schemaVersion: 1,
    id: 'reveal.archive-body',
    gameplayCritical: true,
    accessibleDescription: 'A marked cabinet opens and reveals the clue location.',
    variants: {
      full: 'art/reveal-full',
      reduced: 'art/reveal-silhouette',
    },
  };

  it('accepts a textual no-image fallback for gore-off gameplay', () => {
    expect(validateGoreVariantSet(variants).valid).toBe(true);
    expect(resolveGoreVariant(variants, 'off')).toEqual({
      requestedMode: 'off',
      sourceMode: null,
      assetId: undefined,
      accessibleDescription: variants.accessibleDescription,
      suppressed: true,
    });
  });

  it('falls down in intensity but never escalates reduced or off modes', () => {
    expect(resolveGoreVariant(variants, 'full')).toMatchObject({
      sourceMode: 'full',
      assetId: 'art/reveal-full',
    });
    expect(resolveGoreVariant(variants, 'reduced')).toMatchObject({
      sourceMode: 'reduced',
      assetId: 'art/reveal-silhouette',
    });
    expect(resolveGoreVariant({ ...variants, variants: { full: 'art/full-only' } }, 'reduced')).toMatchObject({
      sourceMode: null,
      suppressed: true,
    });
  });

  it('rejects a critical reveal without a non-graphic description', () => {
    const report = validateGoreVariantSet({ ...variants, accessibleDescription: '' });
    expect(report.valid).toBe(false);
    expect(report.issues.map(issue => issue.code)).toContain('invalid-description');
  });
});
