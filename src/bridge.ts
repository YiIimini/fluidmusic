// ============================================================
// src/bridge.ts — Initializes TS core modules and exposes them
//
// This is the entry point that boots the TypeScript module tree.
// Singleton instances are created here and exposed on both the
// ES module export and window.__FM_TS so that legacy IIFE scripts
// in public/js/ can adopt the new modules incrementally without
// a big-bang rewrite.
// ============================================================

import { EventBus } from './core/event-bus';
import { ErrorHandler } from './core/error-handler';
import { AppStore } from './core/app-store';
import { DataCache } from './core/data-cache';
import { ThemeManager } from './core/theme-manager';
import { SettingsPresets } from './core/settings-presets';

// --------------- singleton instances ---------------

const eventBus = new EventBus();
const appStore = new AppStore(eventBus);
const dataCache = new DataCache();

// --------------- ES module exports ---------------

export { eventBus, appStore, dataCache };

// --------------- window bridge for legacy JS ---------------
// Expose on a single namespace so we don't pollute window.
// Legacy IIFE modules access these via window.__FM_TS.eventBus etc.

if (typeof window !== 'undefined') {
  (window as any).__FM_TS = {
    eventBus,
    appStore,
    dataCache,
    errorHandler: ErrorHandler,
    themeManager: ThemeManager,
    settingsPresets: SettingsPresets,
    // Flag: TS bridge is ready
    ready: true,
  };

  (window as any).__FM_TS_LOADED = true;
}

// --------------- initialize IndexedDB cache ---------------
// Fire-and-forget: the cache opens asynchronously.  During the
// brief window before it's ready, reads will queue on the opening
// promise (see DataCache.ensureOpen).

dataCache.open().then(() => {
  console.log('[TS-Bridge] DataCache (IndexedDB) ready');
}).catch((err: Error) => {
  console.warn('[TS-Bridge] DataCache fallback to memory:', err.message);
});

console.log('[TS-Bridge] Core modules initialized', {
  eventBus: true,
  appStore: true,
  dataCache: true,
});
