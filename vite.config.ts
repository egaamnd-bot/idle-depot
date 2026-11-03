import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the same build works on web hosting, Telegram Mini App and Capacitor.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    // Never inline assets as data URIs: Phaser's loader and the replace-the-file workflow expect real files.
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
