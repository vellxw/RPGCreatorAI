import { describe, expect, it } from 'vitest';
import {
  compileOfflineMediaManifestV1,
  isMediaCatalogV1,
  isSafeProjectRelativeMediaPath,
  mediaMimeMatchesPath,
  validateMediaCatalogV1,
  type MediaCatalogV1,
} from '..';

function catalogFixture(): MediaCatalogV1 {
  return {
    schemaVersion: 1,
    assets: [
      {
        id: 'music.promise',
        kind: 'audio',
        path: 'assets\\media\\audio\\promise.ogg',
        mimeType: 'audio/ogg',
        byteSize: 1_000,
        durationMs: 12_000,
      },
      {
        id: 'voice.damian.001',
        kind: 'voice',
        path: 'assets/media/voice/damian-001.opus',
        mimeType: 'audio/opus',
        byteSize: 2_000,
        durationMs: 3_000,
        locale: 'es-AR',
        speakerId: 'damian',
      },
      {
        id: 'video.opening',
        kind: 'video',
        path: 'assets/media/video/opening.mp4',
        mimeType: 'video/mp4',
        byteSize: 3_000,
        durationMs: 10_000,
        width: 960,
        height: 540,
      },
      {
        id: 'subtitle.opening.es',
        kind: 'subtitle',
        path: 'assets/media/subtitles/opening.es.vtt',
        mimeType: 'text/vtt',
        byteSize: 400,
        durationMs: 10_000,
        locale: 'es-AR',
      },
      {
        id: 'music.editor-only',
        kind: 'audio',
        path: 'assets/media/audio/editor-only.mp3',
        mimeType: 'audio/mpeg',
        byteSize: 500,
        durationMs: 2_000,
      },
    ],
    cinematics: [
      {
        id: 'cinematic.opening',
        durationMs: 10_000,
        skippable: true,
        tracks: [
          { assetId: 'video.opening', role: 'video', startMs: 0, endMs: 10_000 },
          { assetId: 'music.promise', role: 'audio', startMs: 0, endMs: 10_000, volume: 0.7 },
          { assetId: 'voice.damian.001', role: 'voice', startMs: 1_000, endMs: 4_000 },
          { assetId: 'subtitle.opening.es', role: 'subtitle', startMs: 0, endMs: 10_000, default: true },
        ],
      },
    ],
    offlineAllowlist: {
      assetIds: ['music.promise', 'voice.damian.001', 'video.opening', 'subtitle.opening.es'],
      cinematicIds: ['cinematic.opening'],
    },
  };
}

describe('MediaCatalog v1', () => {
  it('validates every media family and compiles only the explicit offline allowlist', () => {
    const catalog = catalogFixture();
    const report = validateMediaCatalogV1(catalog);

    expect(report.valid).toBe(true);
    expect(report.summary).toMatchObject({
      errors: 0,
      assetCount: 5,
      cinematicCount: 1,
      offlineAssetCount: 4,
      offlineCinematicCount: 1,
      offlineBytes: 6_400,
      assetsByKind: { audio: 2, voice: 1, video: 1, subtitle: 1 },
    });
    expect(isMediaCatalogV1(catalog)).toBe(true);

    const compiled = compileOfflineMediaManifestV1(catalog);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.manifest.assets.map(asset => asset.id)).not.toContain('music.editor-only');
    expect(compiled.manifest.assets[0].path).toBe('assets/media/audio/promise.ogg');
    expect(compiled.manifest.totalBytes).toBe(6_400);
    expect(compiled.manifest.cinematics).toHaveLength(1);
  });

  it('rejects traversal, URLs, roots outside media, and MIME/extension spoofing', () => {
    const catalog = catalogFixture();
    catalog.assets[0].path = '../outside.ogg';
    catalog.assets[1].path = 'https://example.test/voice.opus';
    catalog.assets[2].path = 'assets/private/opening.mp4';
    catalog.assets[3].mimeType = 'video/mp4';

    const codes = validateMediaCatalogV1(catalog).issues.map(item => item.code);
    expect(codes).toEqual(expect.arrayContaining([
      'unsafe-path',
      'path-outside-root',
      'unsupported-mime',
    ]));
    expect(isSafeProjectRelativeMediaPath('assets/media/audio/cue.wav')).toBe(true);
    expect(isSafeProjectRelativeMediaPath('assets/media/%2e%2e/secret.wav')).toBe(false);
    expect(mediaMimeMatchesPath('audio', 'audio/mpeg', 'assets/media/audio/fake.wav')).toBe(false);
  });

  it('enforces per-kind and aggregate offline byte budgets without reading files', () => {
    const catalog = catalogFixture();
    catalog.assets[0].byteSize = 1_001;

    const report = validateMediaCatalogV1(catalog, {
      sizeLimits: { audio: 1_000 },
      maxOfflineBytes: 6_000,
    });
    expect(report.valid).toBe(false);
    expect(report.issues.map(item => item.code)).toEqual(expect.arrayContaining([
      'size-limit-exceeded',
      'offline-budget-exceeded',
    ]));
  });

  it('fails closed for unknown, duplicate, and incomplete offline dependencies', () => {
    const catalog = catalogFixture();
    catalog.offlineAllowlist.assetIds = [
      'music.promise',
      'music.promise',
      'video.opening',
      'subtitle.opening.es',
      'missing.asset',
    ];
    catalog.offlineAllowlist.cinematicIds.push('missing.cinematic');

    const codes = validateMediaCatalogV1(catalog).issues.map(item => item.code);
    expect(codes).toEqual(expect.arrayContaining([
      'duplicate-allowlist-entry',
      'unknown-offline-entry',
      'asset-not-offline',
    ]));
    expect(compileOfflineMediaManifestV1(catalog).ok).toBe(false);
  });

  it('validates cinematic role, source bounds, timeline, and role-specific options', () => {
    const catalog = catalogFixture();
    catalog.cinematics[0].tracks = [
      { assetId: 'music.promise', role: 'video', startMs: 0, endMs: 11_000, volume: 2 },
      { assetId: 'voice.damian.001', role: 'voice', startMs: 8_000, endMs: 10_000, sourceStartMs: 2_500 },
      { assetId: 'subtitle.opening.es', role: 'subtitle', startMs: 0, endMs: 10_000, loop: true },
    ];

    const codes = validateMediaCatalogV1(catalog).issues.map(item => item.code);
    expect(codes).toEqual(expect.arrayContaining([
      'track-kind-mismatch',
      'invalid-timeline',
      'invalid-track',
    ]));
  });

  it('allows exact file aliases but rejects contradictory metadata for one packaged path', () => {
    const catalog = catalogFixture();
    catalog.assets.push({
      id: 'music.promise.alias',
      kind: 'audio',
      path: 'assets/media/audio/promise.ogg',
      mimeType: 'audio/ogg',
      byteSize: 1_000,
      durationMs: 12_000,
    });
    expect(validateMediaCatalogV1(catalog).valid).toBe(true);

    catalog.assets[catalog.assets.length - 1].byteSize = 999;
    expect(validateMediaCatalogV1(catalog).issues.map(item => item.code)).toContain('path-metadata-conflict');
  });
});
