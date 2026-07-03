// ============================================================
// public/js/ts-loader.js — Loads the TypeScript bridge bundle
//
// This is a temporary loader until full ES module migration.
// In production the bridge is bundled by Vite; in dev mode we
// check whether it was loaded via the <script type="module">
// tag in index.html.
// ============================================================

(function () {
  'use strict';

  console.log('[TS-Loader] Checking for TypeScript bridge...');

  if (window.__FM_TS_LOADED) {
    console.log('[TS-Loader] TS bridge already loaded');
  } else {
    console.log('[TS-Loader] TS bridge not loaded — using legacy JS modules');
  }
})();
