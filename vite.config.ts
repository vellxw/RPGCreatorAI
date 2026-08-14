import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

function featureChunkName(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/');

  if (normalizedId.includes('/node_modules/phaser/')) {
    return 'vendor-phaser';
  }

  if (normalizedId.includes('/src/components/ai/')) {
    return 'feature-ai-studio';
  }

  if (normalizedId.includes('/src/media/')) {
    return 'feature-media';
  }

  if (
    normalizedId.includes('/src/runtime-phaser/')
    || normalizedId.includes('/src/components/playtest/')
    || normalizedId.endsWith('/src/screens/PlaytestScreen.tsx')
    || normalizedId.endsWith('/src/screens/PlaytestWorkspaceBoundary.tsx')
    || normalizedId.endsWith('/src/playtest/phaserPlaytestAdapter.ts')
  ) {
    return 'feature-playtest';
  }

  return undefined;
}

export default defineConfig({
  // Android's synthetic appassets origin serves this build below
  // /assets/www/, so release references must remain document-relative.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      output: {
        // Keep optional editor features out of the startup graph and give
        // their lazy chunks stable names for browser/cache reuse.
        manualChunks: featureChunkName,
      },
    },
  },
});
