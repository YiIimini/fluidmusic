// ============================================================
// FluidMusic — Vite Build Configuration
// Bundles renderer process (public/) for production
// Electron main process stays as raw Node.js (not bundled)
//
// Note: Three.js is loaded as a global via vendor/three.min.js
// (script tag in index.html). All modules use window.THREE.
// When we migrate to ES modules, add three back to
// dependencies and restore the alias + manualChunks.
// ============================================================
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Renderer source
  root: resolve(__dirname, 'public'),
  base: './',

  build: {
    outDir: resolve(__dirname, 'dist-renderer'),
    emptyOutDir: true,
    // Target modern Chromium (Electron 33 = Chromium 130)
    target: 'chrome130',
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // keep console for debugging
      },
    },
    // Generate sourcemaps for debugging
    sourcemap: true,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // Dev server (for development without Electron)
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
