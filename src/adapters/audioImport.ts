import { getFileSystemAdapter, isDesktopShell } from './adapterFactory';
import type { AudioImportMetadata, AudioImportResult } from './types';

export type AudioImportRunner = (
  existingAssetIds: string[],
  metadata: AudioImportMetadata,
) => Promise<AudioImportResult>;

export const importAudioAsset: AudioImportRunner = async (existingAssetIds, metadata) => {
  if (!isDesktopShell() || !window.rpgBridge) {
    return {
      success: false,
      cancelled: false,
      error: 'Audio import is available after opening a desktop project folder.',
    };
  }

  const root = getFileSystemAdapter()?.getProjectRoot();
  if (!root) {
    return {
      success: false,
      cancelled: false,
      error: 'Open or create a desktop project before importing audio.',
    };
  }

  return window.rpgBridge.fs.importAudioAsset(root, existingAssetIds, metadata);
};
