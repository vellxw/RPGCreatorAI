import { getFileSystemAdapter, isDesktopShell } from './adapterFactory';
import type { SpritesheetImportMetadata, SpritesheetImportResult } from './types';

export type SpritesheetImportRunner = (
  existingAssetIds: string[],
  metadata: SpritesheetImportMetadata,
) => Promise<SpritesheetImportResult>;

export const importSpritesheetAsset: SpritesheetImportRunner = async (existingAssetIds, metadata) => {
  if (!isDesktopShell() || !window.rpgBridge) {
    return {
      success: false,
      cancelled: false,
      error: 'Spritesheet import is available after opening a desktop project folder.',
    };
  }

  const root = getFileSystemAdapter()?.getProjectRoot();
  if (!root) {
    return {
      success: false,
      cancelled: false,
      error: 'Open or create a desktop project before importing spritesheets.',
    };
  }

  return window.rpgBridge.fs.importSpritesheetAsset(root, existingAssetIds, metadata);
};
