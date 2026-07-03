// ============================================================
// FluidMusic — Vitest Configuration
// Unit tests for renderer JS modules
// ============================================================
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // jsdom environment for DOM-dependent tests
    environment: 'jsdom',
    // Global test utilities
    globals: true,
    // Test file patterns
    include: ['tests/unit/**/*.test.{js,ts}'],
    // Setup file for DOM mocks
    setupFiles: ['./tests/setup.js'],
    // Coverage
    coverage: {
      provider: 'v8',
      include: ['public/js/**/*.js', 'src/core/**/*.ts'],
      exclude: ['public/js/module-registry.js', 'public/js/renderer-manager.js'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'public/js'),
    },
  },
});
