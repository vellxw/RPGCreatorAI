import { getFileSystemAdapter, isDesktopShell } from './adapterFactory';
import type { ImageImportResult } from './types';

export type ImageImportRunner = (existingAssetIds: string[]) => Promise<ImageImportResult>;

export const importImageAsset: ImageImportRunner = async existingAssetIds => {
  if (!isDesktopShell() || !window.rpgBridge) {
    return {
      success: false,
      cancelled: false,
      error: 'Image import is available after opening a desktop project folder.',
    };
  }

  const root = getFileSystemAdapter()?.getProjectRoot();
  if (!root) {
    return {
      success: false,
      cancelled: false,
      error: 'Open or create a desktop project before importing images.',
    };
  }

  return window.rpgBridge.fs.importImageAsset(root, existingAssetIds);
};
