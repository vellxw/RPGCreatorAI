import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root,
  base: './',
  build: {
    outDir: resolve(root, '../../../../output/android-web-runtime'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
