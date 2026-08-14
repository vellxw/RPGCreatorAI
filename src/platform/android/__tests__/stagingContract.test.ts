import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { resolvePhaserAssetUrl } from '../../../runtime-phaser';
import {
  ANDROID_GAME_BUNDLE_URL,
  ANDROID_RUNTIME_ASSET_BASE_URL,
  loadAndroidGameBundle,
  parseAndroidGameBundle,
} from '../gameBundleHost';
import { ANDROID_APP_ASSET_PREFIX } from '../offlineWrapper';

const fixture = {
  schemaVersion: 1,
  project: {
    schemaVersion: 1,
    title: 'Android fixture',
    startMapId: 'entry',
    startPosition: { x: 1, y: 1, direction: 'down' },
    maps: [],
    database: { items: 'data/items.json' },
  },
  maps: { entry: { id: 'entry' } },
  items: { items: [] },
  databases: {},
  assets: {
    schemaVersion: 1,
    assets: [{
      id: 'hero',
      name: 'Hero',
      kind: 'image',
      path: 'assets/generated/web/hero.png',
      source: 'generated',
      runtimeCompatible: true,
    }],
  },
} as const;

describe('Android staged runtime contract', () => {
  it('ships a dedicated relative-base runtime marker', () => {
    const contractPath = resolve(process.cwd(), 'src/platform/android/web/public/data/android-runtime-contract.v1.json');
    const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
    expect(contract).toEqual({
      schemaVersion: 1,
      runtimeId: 'rpgcreatorai-phaser-android',
      entryDocument: 'index.html',
      gameBundlePath: 'data/game-bundle.v1.json',
      viteBase: './',
      assetBaseUrl: '/assets/www/',
      assetPathMode: 'game-bundle-project-relative',
    });
  });

  it('keeps GameBundle paths canonical and resolves them below assets/www at render time', () => {
    const bundle = parseAndroidGameBundle(structuredClone(fixture));
    expect(bundle.assets?.assets[0]?.path).toBe('assets/generated/web/hero.png');
    expect(resolvePhaserAssetUrl(bundle.assets!.assets[0].path, ANDROID_APP_ASSET_PREFIX))
      .toBe('/assets/www/assets/generated/web/hero.png');
  });

  it('loads the exact packaged GameBundle with fail-closed fetch options', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => structuredClone(fixture),
    })) as unknown as typeof fetch;

    await expect(loadAndroidGameBundle(undefined, fetcher)).resolves.toMatchObject({ schemaVersion: 1 });
    expect(fetcher).toHaveBeenCalledWith(ANDROID_GAME_BUNDLE_URL, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    });
    expect(ANDROID_GAME_BUNDLE_URL).toBe('/assets/www/data/game-bundle.v1.json');
    expect(ANDROID_RUNTIME_ASSET_BASE_URL).toBe('/assets/www/');
  });

  it('rejects a remote or caller-selected GameBundle URL before fetch', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(loadAndroidGameBundle('https://example.invalid/game-bundle.json', fetcher))
      .rejects.toThrow('packaged offline path');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects incomplete bundles and missing start maps before Phaser mounts', () => {
    expect(() => parseAndroidGameBundle({ ...fixture, items: undefined })).toThrow('items');
    expect(() => parseAndroidGameBundle({
      ...fixture,
      project: { ...fixture.project, startMapId: 'missing' },
    })).toThrow('start map');
  });
});
