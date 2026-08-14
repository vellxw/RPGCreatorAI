import type { RuntimeAssetManifest, RuntimeAssetManifestEntry } from '../types';
import type { GameBundleV1 } from '../../runtime-core';
import { isSafePortablePath, normalizePortablePath } from '../../utils/packageSecurity';

export interface PhaserAssetDescriptor {
  key: string;
  type: 'image' | 'spritesheet' | 'audio';
  url: string;
  frameWidth?: number;
  frameHeight?: number;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEntry(value: unknown): value is RuntimeAssetManifestEntry {
  if (!isRecord(value)) return false;
  return typeof value.runtimeKey === 'string'
    && typeof value.kind === 'string'
    && typeof value.runtimePath === 'string'
    && (value.sourcePath === undefined || typeof value.sourcePath === 'string');
}

export function parseRuntimeAssetManifest(value: unknown): RuntimeAssetManifest {
  if (!isRecord(value) || typeof value.schemaVersion !== 'number' || !Array.isArray(value.assets)) {
    throw new Error('Invalid runtime asset manifest: expected schemaVersion and assets.');
  }

  const assets = value.assets.filter(isEntry);
  if (assets.length !== value.assets.length) {
    throw new Error('Invalid runtime asset manifest: every asset needs runtimeKey, kind, and runtimePath.');
  }

  const keys = new Set<string>();
  for (const asset of assets) {
    if (keys.has(asset.runtimeKey)) {
      throw new Error(`Duplicate runtime asset key: ${asset.runtimeKey}`);
    }
    keys.add(asset.runtimeKey);
  }

  return { schemaVersion: value.schemaVersion, assets };
}

function normalizeAssetBaseUrl(value: string): string {
  const normalized = value.trim().replaceAll('\\', '/');
  if (normalized === '' || normalized === '.' || normalized === './') return './';
  if (normalized.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    throw new Error('Phaser asset base URL must stay on the current offline origin.');
  }
  const segments = normalized.replace(/^\//, '').split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error('Phaser asset base URL cannot contain dot path segments.');
  }
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

/** Resolves one portable catalog path without escaping the offline document origin. */
export function resolvePhaserAssetUrl(pathValue: string, baseUrl = './'): string {
  const path = normalizePortablePath(pathValue);
  if (!isSafePortablePath(path)) {
    throw new Error(`Invalid Phaser asset path: ${pathValue}`);
  }
  return `${normalizeAssetBaseUrl(baseUrl)}${path}`;
}

/** Converts the existing stable runtime keys into Phaser preload descriptors. */
export function adaptManifestForPhaser(
  manifestValue: unknown,
  assetBaseUrl = './',
): readonly PhaserAssetDescriptor[] {
  const manifest = parseRuntimeAssetManifest(manifestValue);
  return manifest.assets.map((asset) => {
    // Never infer a strip from arbitrary source dimensions: a 4x4 grid and a
    // horizontal strip can have the same frame count. The GameBundle compiler
    // supplies these dimensions from the canonical compiled clip database.
    const frameWidth = positiveInteger(asset.frameWidth);
    const frameHeight = positiveInteger(asset.frameHeight);
    const type = asset.kind === 'audio'
      ? 'audio'
      : asset.kind === 'spritesheet' && frameWidth && frameHeight
        ? 'spritesheet'
        : 'image';
    return {
      key: asset.runtimeKey,
      type,
      // Prefer the web/source export. A native BMP can remain an SDL detail.
      url: resolvePhaserAssetUrl(asset.sourcePath ?? asset.runtimePath, assetBaseUrl),
      frameWidth,
      frameHeight,
    };
  });
}

/** Converts an approved GameBundle catalog into the renderer manifest. */
export function createRuntimeAssetManifest(bundle: GameBundleV1): RuntimeAssetManifest {
  const clipByAsset = new Map<string, {
    frameWidth: number;
    frameHeight: number;
    frames: number;
  }>();
  for (const set of bundle.databases.animations?.sets ?? []) {
    for (const clip of set.clips) {
      // AnimationPackage compilation emits one horizontal strip per clip. If
      // malformed data reuses a key with conflicting metadata, the first
      // deterministic database occurrence wins and later validation can flag it.
      if (!clipByAsset.has(clip.asset)) {
        clipByAsset.set(clip.asset, {
          frameWidth: clip.frameSize.width,
          frameHeight: clip.frameSize.height,
          frames: clip.frameCount,
        });
      }
    }
  }
  return {
    schemaVersion: bundle.assets?.schemaVersion ?? bundle.schemaVersion,
    assets: (bundle.assets?.assets ?? []).map(asset => {
      const clip = clipByAsset.get(asset.id);
      return {
        runtimeKey: asset.id,
        kind: asset.kind,
        runtimePath: asset.path,
        sourcePath: asset.path,
        ...(asset.width !== undefined ? { width: asset.width } : {}),
        ...(asset.height !== undefined ? { height: asset.height } : {}),
        ...(asset.frameWidth !== undefined || clip
          ? { frameWidth: asset.frameWidth ?? clip?.frameWidth }
          : {}),
        ...(asset.frameHeight !== undefined || clip
          ? { frameHeight: asset.frameHeight ?? clip?.frameHeight }
          : {}),
        ...(asset.frames !== undefined || clip ? { frames: asset.frames ?? clip?.frames } : {}),
        ...(asset.durationMs !== undefined ? { durationMs: asset.durationMs } : {}),
      };
    }),
  };
}
