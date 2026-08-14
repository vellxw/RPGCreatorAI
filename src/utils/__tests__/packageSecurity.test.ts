import { describe, expect, it } from 'vitest';
import {
  isExternalReference,
  isSafePortablePath,
  validatePortableArchiveEntries,
  validateRuntimeAssetMetadata,
} from '../packageSecurity';

describe('portable package security', () => {
  it('rejects traversal aliases, encoded paths, reserved names and external references', () => {
    expect(isSafePortablePath('assets/hero.png')).toBe(true);
    for (const path of [
      '../secret', 'assets/%2e%2e/secret', 'C:\\secret', '/etc/passwd',
      'assets/CON.png', 'assets/trailing. /hero.png', 'https://example.com/a.png',
    ]) expect(isSafePortablePath(path)).toBe(false);
    expect(isExternalReference('data:text/html,boom')).toBe(true);
    expect(isExternalReference('//cdn.example/a.png')).toBe(true);
  });

  it('blocks dangerous runtime asset metadata before export', () => {
    const issues = validateRuntimeAssetMetadata({
      id: 'hero', name: 'Hero', kind: 'spritesheet', source: 'generated',
      runtimeCompatible: true, path: 'assets/hero.svg', width: 100_000, height: 100_000,
      providerApiKey: 'must-not-leak', externalUrl: 'https://cdn.example/hero.png',
      linkTarget: '../../outside',
    });
    expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'secret-metadata', 'external-reference', 'unsafe-asset-metadata', 'unsafe-path',
    ]));
  });

  it('rejects ZIP slip, collisions, links and decompression bombs', () => {
    const issues = validatePortableArchiveEntries([
      { path: '../outside', kind: 'file', compressedSize: 1, uncompressedSize: 1, compressionMethod: 8 },
      { path: 'game/data.json', kind: 'file', compressedSize: 1, uncompressedSize: 1000, compressionMethod: 8 },
      { path: 'GAME/data.json', kind: 'file', compressedSize: 1, uncompressedSize: 1, compressionMethod: 8 },
      { path: 'game/link', kind: 'symlink', compressedSize: 0, uncompressedSize: 0, compressionMethod: 0, linkTarget: '../../secret' },
    ], { maxCompressionRatio: 50 });
    expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'unsafe-path', 'unsafe-archive-entry',
    ]));
    expect(issues.some(issue => issue.message.includes('collides'))).toBe(true);
    expect(issues.some(issue => issue.message.includes('compression-ratio'))).toBe(true);
    expect(issues.some(issue => issue.message.includes('Links'))).toBe(true);
  });
});
