import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',
  envDir: '..',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    copyPublicDir: false
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
