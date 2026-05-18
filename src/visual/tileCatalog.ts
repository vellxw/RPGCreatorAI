export const VISUAL_TILE_IDS = new Set([0, 1, 2, 3]);
export const COLLISION_TILE_IDS = new Set([0, 9]);

export function isSupportedVisualTile(tileId: number): boolean {
  return VISUAL_TILE_IDS.has(tileId);
}

export function isSupportedCollisionTile(tileId: number): boolean {
  return COLLISION_TILE_IDS.has(tileId);
}

export function isVoidVisualTile(tileId: number): boolean {
  return tileId === 0;
}
