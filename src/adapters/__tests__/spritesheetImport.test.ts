import { describe, expect, it } from 'vitest';
import { validateSpritesheetImportMetadata } from '../spritesheetImport';

describe('spritesheet import metadata', () => {
  const metadata = {
    idBase: 'hero_walk_down',
    name: 'Hero walk down',
    frameWidth: 64,
    frameHeight: 96,
    frameCount: 4,
  };

  it('accepts a strip with matching dimensions', () => {
    expect(validateSpritesheetImportMetadata(metadata, { width: 256, height: 96 })).toBeNull();
  });

  it('rejects a strip whose physical dimensions disagree with metadata', () => {
    expect(validateSpritesheetImportMetadata(metadata, { width: 255, height: 96 })).toMatch(/dimensions are 255x96/);
    expect(validateSpritesheetImportMetadata(metadata, { width: 256, height: 95 })).toMatch(/dimensions are 256x95/);
  });
});

