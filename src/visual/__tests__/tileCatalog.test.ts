import { describe, expect, it } from 'vitest';
import { VISUAL_TILE_IDS, isSupportedVisualTile } from '../tileCatalog';

describe('tile catalog', () => {
  it('accepts the expanded authored-scene visual tile vocabulary', () => {
    expect([...VISUAL_TILE_IDS]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const tileId of [1, 2, 3, 4, 5, 6, 7]) {
      expect(isSupportedVisualTile(tileId)).toBe(true);
    }
  });
});
