import type { PhaserNamespace, PhaserRendererPreference } from '../types';

export interface BrowserRenderCapabilities {
  canvas2d: boolean;
  webgl: boolean;
}

export function detectBrowserRenderCapabilities(doc: Document = document): BrowserRenderCapabilities {
  const canvas = doc.createElement('canvas');
  const canvas2d = canvas.getContext('2d') !== null;
  let webgl = false;
  try {
    webgl = canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  } catch {
    webgl = false;
  }
  return { canvas2d, webgl };
}

export function resolvePhaserRenderer(
  Phaser: PhaserNamespace,
  preference: PhaserRendererPreference = 'auto',
  capabilities = detectBrowserRenderCapabilities(),
): number {
  if (preference === 'canvas') {
    if (!capabilities.canvas2d) throw new Error('Canvas 2D is not available in this browser.');
    return Phaser.CANVAS;
  }
  if (preference === 'webgl') {
    if (!capabilities.webgl) throw new Error('WebGL was required but is not available.');
    return Phaser.WEBGL;
  }
  if (capabilities.webgl) return Phaser.WEBGL;
  if (capabilities.canvas2d) return Phaser.CANVAS;
  return Phaser.AUTO;
}

