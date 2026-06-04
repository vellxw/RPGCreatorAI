import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type AssetEntry = {
  id: string;
  kind: string;
  path: string;
  width?: number;
  height?: number;
  frameWidth?: number;
  frameHeight?: number;
  frames?: number;
};

type RuntimeAssetEntry = {
  id: string;
  runtimeFormat: string;
  runtimePath: string;
  width?: number;
  height?: number;
  frameWidth?: number;
  frameHeight?: number;
  frames?: number;
};

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8')) as T;
}

function fileSize(relativePath: string): number {
  return statSync(resolve(root, relativePath)).size;
}

function pngDimensions(relativePath: string): { width: number; height: number } {
  const bytes = readFileSync(resolve(root, relativePath));
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function bmpDimensions(relativePath: string): { width: number; height: number } {
  const bytes = readFileSync(resolve(root, relativePath));
  return {
    width: bytes.readInt32LE(18),
    height: Math.abs(bytes.readInt32LE(22)),
  };
}

function dimensionsFor(relativePath: string): { width: number; height: number } | null {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith('.png')) return pngDimensions(relativePath);
  if (lower.endsWith('.bmp')) return bmpDimensions(relativePath);
  return null;
}

function assertSpritesheetMetadata(entry: AssetEntry | RuntimeAssetEntry) {
  if (entry.frameWidth === undefined || entry.frameHeight === undefined || entry.frames === undefined) return;
  expect(entry.width, `${entry.id} width must equal frameWidth * frames`).toBe(entry.frameWidth * entry.frames);
  expect(entry.height, `${entry.id} height must equal frameHeight`).toBe(entry.frameHeight);
}

describe('asset manifest file integrity', () => {
  it('keeps catalog metadata aligned with source files on disk', () => {
    const catalog = readJson<{ assets: AssetEntry[] }>('data/assets/catalog.json');

    expect(catalog.assets).toHaveLength(5);
    for (const asset of catalog.assets) {
      expect(existsSync(resolve(root, asset.path)), `${asset.id} source path exists`).toBe(true);
      expect(fileSize(asset.path), `${asset.id} source path is non-empty`).toBeGreaterThan(0);
      const dimensions = dimensionsFor(asset.path);
      if (dimensions && asset.width !== undefined && asset.height !== undefined) {
        expect(`${asset.width}x${asset.height}`, `${asset.id} declared dimensions match source file`).toBe(
          `${dimensions.width}x${dimensions.height}`,
        );
      }
      if (asset.kind === 'spritesheet') {
        assertSpritesheetMetadata(asset);
      }
    }
  });

  it('keeps runtime manifest metadata aligned with runtime files on disk', () => {
    const manifest = readJson<{ assets: RuntimeAssetEntry[] }>('data/assets/runtime-manifest.json');

    expect(manifest.assets).toHaveLength(6);
    for (const asset of manifest.assets) {
      expect(existsSync(resolve(root, asset.runtimePath)), `${asset.id} runtime path exists`).toBe(true);
      expect(fileSize(asset.runtimePath), `${asset.id} runtime path is non-empty`).toBeGreaterThan(0);
      const dimensions = dimensionsFor(asset.runtimePath);
      if (dimensions && asset.width !== undefined && asset.height !== undefined) {
        expect(`${asset.width}x${asset.height}`, `${asset.id} declared dimensions match runtime file`).toBe(
          `${dimensions.width}x${dimensions.height}`,
        );
      }
      if (asset.runtimeFormat === 'bmp') {
        assertSpritesheetMetadata(asset);
      }
    }
  });
});
