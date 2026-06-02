import { getFileSystemAdapter, isDesktopShell } from './adapterFactory';
import type { TilesetImportMetadata, TilesetImportResult } from './types';

export type TilesetImportRunner = (
  existingAssetIds: string[],
  metadata: TilesetImportMetadata,
) => Promise<TilesetImportResult>;

export const importTilesetAsset: TilesetImportRunner = async (existingAssetIds, metadata) => {
  if (!isDesktopShell() || !window.rpgBridge) {
    return {
      success: false,
      cancelled: false,
      error: 'Tileset import is available after opening a desktop project folder.',
    };
  }

  const root = getFileSystemAdapter()?.getProjectRoot();
  if (!root) {
    return {
      success: false,
      cancelled: false,
      error: 'Open or create a desktop project before importing tilesets.',
    };
  }

  return window.rpgBridge.fs.importTilesetAsset(root, existingAssetIds, metadata);
};
