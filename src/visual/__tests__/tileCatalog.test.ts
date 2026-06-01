import { describe, expect, it } from 'vitest';
import {
  VISUAL_TILE_IDS,
  getTileMetadata,
  getTileset,
  isSupportedVisualTile,
  listTilesetTiles,
  tileAssetForKey,
  tilePassabilityForId,
} from '../tileCatalog';
import { gameAssets } from '../../assets/generated/assetCatalog';

describe('tile catalog', () => {
  it('accepts the expanded authored-scene visual tile vocabulary', () => {
    expect([...VISUAL_TILE_IDS]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const tileId of [1, 2, 3, 4, 5, 6, 7]) {
      expect(isSupportedVisualTile(tileId)).toBe(true);
    }
  });

  it('loads tiles from the project-owned tileset database', () => {
    const tileset = getTileset('sample-town');
    expect(tileset?.name).toBe('Sample Town');
    expect(listTilesetTiles('sample-town').map(tile => tile.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(getTileMetadata('sample-town', 5)).toMatchObject({
      id: 5,
      asset: 'tree',
      passability: 'blocked',
      terrainTag: 'forest',
    });
  });

  it('answers passability from tileset metadata', () => {
    expect(tilePassabilityForId('sample-town', 1)).toBe('passable');
    expect(tilePassabilityForId('sample-town', 5)).toBe('blocked');
    expect(tilePassabilityForId('missing', 5)).toBe('blocked');
  });

  it('falls back to the void warning swatch for unknown tile assets', () => {
    expect(tileAssetForKey('grass')).toBe(gameAssets.grass);
    expect(tileAssetForKey('missingAsset')).toBe(gameAssets.voidWarning);
  });
});
