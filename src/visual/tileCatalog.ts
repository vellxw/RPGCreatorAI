import tilesetsJson from '../../data/database/tilesets.json';
import { gameAssets } from '../assets/generated/assetCatalog';
import type { TilePassability, TilesetData, TilesetTileMetadata } from '../types/project';

const tilesetDatabase = tilesetsJson as { tilesets: TilesetData[] };

export const VISUAL_TILE_IDS = new Set(
  tilesetDatabase.tilesets.flatMap(tileset => tileset.tiles.map(tile => tile.id)).sort((a, b) => a - b),
);
export const COLLISION_TILE_IDS = new Set([0, 9]);
export const REGION_TILE_IDS = new Set(Array.from({ length: 256 }, (_, i) => i));

export function getTileset(tilesetId: string | undefined): TilesetData | undefined {
  return tilesetDatabase.tilesets.find(tileset => tileset.id === (tilesetId || 'sample-town'));
}

export function listTilesetTiles(tilesetId: string | undefined): TilesetTileMetadata[] {
  return getTileset(tilesetId)?.tiles ?? [];
}

export function getTileMetadata(
  tilesetId: string | undefined,
  tileId: number,
): TilesetTileMetadata | undefined {
  return getTileset(tilesetId)?.tiles.find(tile => tile.id === tileId);
}

export function tilePassabilityForId(
  tilesetId: string | undefined,
  tileId: number,
): TilePassability {
  return getTileMetadata(tilesetId, tileId)?.passability ?? 'blocked';
}

export function tileAssetForId(tilesetId: string | undefined, tileId: number): string {
  const assetKey = getTileMetadata(tilesetId, tileId)?.asset ?? 'grass';
  return (gameAssets as Record<string, string>)[assetKey] ?? gameAssets.grass;
}

export function isSupportedVisualTile(tileId: number, tilesetId = 'sample-town'): boolean {
  return Boolean(getTileMetadata(tilesetId, tileId));
}

export function isSupportedCollisionTile(tileId: number): boolean {
  return COLLISION_TILE_IDS.has(tileId);
}

export function isSupportedRegionTile(tileId: number): boolean {
  return REGION_TILE_IDS.has(tileId);
}

export function isVoidVisualTile(tileId: number): boolean {
  return tileId === 0;
}
