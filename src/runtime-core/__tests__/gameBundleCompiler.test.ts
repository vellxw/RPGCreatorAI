import { describe, expect, it } from 'vitest';
import { createNewProjectState } from '../../adapters/projectTemplates';
import type { FullProjectState } from '../../adapters/types';
import {
  compileGameBundleV1,
  isSafeBundlePath,
  serializeGameBundleV1,
} from '../gameBundleCompiler';

function projectFixture(): FullProjectState {
  const state = createNewProjectState('Bundle fixture');
  state.assets = {
    schemaVersion: 1,
    assets: [
      {
        id: 'hero',
        name: 'Hero',
        kind: 'spritesheet',
        path: 'assets\\sprites\\hero.png',
        source: 'generated',
        runtimeCompatible: true,
        generated: {
          prompt: 'editor-only prompt',
          providerId: 'remote-provider',
          modelId: 'remote-model',
        },
      },
      {
        id: 'concept',
        name: 'Concept',
        kind: 'generated',
        path: 'assets/concepts/hero.png',
        source: 'generated',
        runtimeCompatible: false,
      },
    ],
  };
  return state;
}

describe('compileGameBundleV1', () => {
  it('creates an offline serializable DTO with only runtime-approved asset metadata', () => {
    const state = projectFixture();
    state.project.generationHistory = {
      schemaVersion: 1,
      maxRecords: 1,
      records: [],
    };
    (state.databases.system as unknown as Record<string, unknown>).apiKey = 'must-not-leak';
    (state.databases.system as unknown as Record<string, unknown>).providerApiKey = 'also-secret';
    (state.databases.system as unknown as Record<string, unknown>).clientSecret = 'also-secret';
    (state.databases.system as unknown as Record<string, unknown>).session_token = 'also-secret';

    const result = compileGameBundleV1(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.schemaVersion).toBe(1);
    expect(result.bundle.assets?.assets).toEqual([
      expect.objectContaining({ id: 'hero', path: 'assets/sprites/hero.png' }),
    ]);
    expect(result.bundle.assets?.assets[0]).not.toHaveProperty('generated');
    expect(result.bundle.project).not.toHaveProperty('generationHistory');
    expect(result.bundle.databases.system).not.toHaveProperty('apiKey');
    expect(result.bundle.databases.system).not.toHaveProperty('providerApiKey');
    expect(result.bundle.databases.system).not.toHaveProperty('clientSecret');
    expect(result.bundle.databases.system).not.toHaveProperty('session_token');
    expect(result.warnings.some(issue => issue.code === 'secret-redacted')).toBe(true);
    expect(JSON.parse(serializeGameBundleV1(result.bundle))).toEqual(result.bundle);
  });

  it('fails closed for traversal, absolute and non-allowlisted-root paths', () => {
    const traversal = projectFixture();
    traversal.project.maps[0].path = '../outside.json';
    expect(compileGameBundleV1(traversal).ok).toBe(false);

    const absolute = projectFixture();
    absolute.assets!.assets[0].path = 'C:\\private\\hero.png';
    expect(compileGameBundleV1(absolute).ok).toBe(false);

    const wrongRoot = projectFixture();
    wrongRoot.assets!.assets[0].path = 'data/private/hero.png';
    expect(compileGameBundleV1(wrongRoot).ok).toBe(false);
  });

  it('requires explicit allowlisted assets to exist and be runtime compatible', () => {
    const incompatible = compileGameBundleV1(projectFixture(), {
      assetAllowlist: ['concept', 'missing'],
    });

    expect(incompatible.ok).toBe(false);
    expect(incompatible.errors.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['asset-not-runtime-compatible', 'unknown-asset']),
    );
  });

  it('rejects active/external assets and dangerous package metadata', () => {
    const state = projectFixture();
    state.assets!.assets[0].path = 'assets/sprites/hero.svg';
    state.assets!.assets[0].width = 100_000;
    (state.assets!.assets[0] as unknown as Record<string, unknown>).externalUrl =
      'https://cdn.example/hero.png';
    (Object.values(state.maps)[0] as unknown as Record<string, unknown>).zipEntries = [
      { path: '../outside' },
    ];

    const result = compileGameBundleV1(state);

    expect(result.ok).toBe(false);
    expect(result.errors.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'external-reference', 'unsafe-asset-metadata', 'unsafe-metadata',
    ]));
  });
});

describe('isSafeBundlePath', () => {
  it('accepts portable relative paths only', () => {
    expect(isSafeBundlePath('assets/sprites/hero.png')).toBe(true);
    expect(isSafeBundlePath('../hero.png')).toBe(false);
    expect(isSafeBundlePath('/etc/passwd')).toBe(false);
    expect(isSafeBundlePath('https://example.com/hero.png')).toBe(false);
    expect(isSafeBundlePath('assets/hero.png:secret')).toBe(false);
    expect(isSafeBundlePath('assets/%2e%2e/hero.png')).toBe(false);
    expect(isSafeBundlePath('assets/CON.png')).toBe(false);
  });
});
