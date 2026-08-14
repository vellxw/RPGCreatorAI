import { getFileSystemAdapter, isDesktopShell } from './adapterFactory';
import { ANIMATION_PACKAGE_VERSION, validateAnimationPackage } from '../animation/animationPackage';
import type { SpritesheetImportMetadata, SpritesheetImportResult } from './types';

export type SpritesheetImportRunner = (
  existingAssetIds: string[],
  metadata: SpritesheetImportMetadata,
) => Promise<SpritesheetImportResult>;

export function validateSpritesheetImportMetadata(
  metadata: SpritesheetImportMetadata,
  image?: { width?: number; height?: number },
): string | null {
  const expectedWidth = metadata.frameWidth * metadata.frameCount;
  if (!Number.isSafeInteger(expectedWidth)) {
    return 'Spritesheet frame width * frame count must be a safe integer.';
  }

  const width = image?.width ?? expectedWidth;
  const height = image?.height ?? metadata.frameHeight;
  if (width !== expectedWidth || height !== metadata.frameHeight) {
    return `Spritesheet dimensions are ${width}x${height}, but metadata requires ${expectedWidth}x${metadata.frameHeight}.`;
  }
  const report = validateAnimationPackage({
    schemaVersion: ANIMATION_PACKAGE_VERSION,
    id: metadata.idBase,
    source: {
      path: 'assets/imported/spritesheet.png',
      sha256: '0'.repeat(64),
      width,
      height,
      layout: 'grid',
    },
    grid: {
      columns: metadata.frameCount,
      rows: 1,
      cellWidth: metadata.frameWidth,
      cellHeight: metadata.frameHeight,
    },
    clips: [{
      id: 'import.any',
      action: 'import',
      direction: 'any',
      frameIndices: Array.from({ length: metadata.frameCount }, (_, index) => index),
      fps: 1,
      loop: false,
    }],
  });
  const error = report.issues.find(issue => issue.severity === 'error');
  if (error) return `Invalid spritesheet metadata: ${error.message}`;
  return null;
}

export const importSpritesheetAsset: SpritesheetImportRunner = async (existingAssetIds, metadata) => {
  const metadataError = validateSpritesheetImportMetadata(metadata);
  if (metadataError) {
    return { success: false, cancelled: false, error: metadataError };
  }

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

  const result = await window.rpgBridge.fs.importSpritesheetAsset(root, existingAssetIds, metadata);
  if (!result.success || !result.asset) return result;

  const dimensionsError = validateSpritesheetImportMetadata(metadata, result.asset);
  if (dimensionsError) {
    return { success: false, cancelled: false, error: dimensionsError };
  }
  return result;
};
