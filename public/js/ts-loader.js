// ============================================================
// public/js/ts-loader.js — TS bridge bootstrapper
//
// Provides a stable window.__FM_TS stub so all JS modules can
// safely reference __FM_TS.eventBus / .dataCache / .appStore
// without typeof guards. When the Vite-built bridge bundle loads,
// it overlays real implementations on top of this stub.
// ============================================================

(function () {
  'use strict';

  // If the TS bridge already loaded (production Vite bundle),
  // don't overwrite it.
  if (window.__FM_TS_LOADED) {
    console.log('[TS-Loader] TS bridge already loaded — keeping real modules');
    return;
  }

  // ── Minimal stub: provides the same interface as src/bridge.ts ──
  // EventBus stub: drop-in no-op for emit/on/off
  var _stubListeners = {};
  var stubEventBus = {
    emit: function (event, data) {
      var handlers = _stubListeners[event];
      if (handlers) handlers.forEach(function (fn) { try { fn(data); } catch (_) {} });
    },
    on: function (event, fn) {
      if (!_stubListeners[event]) _stubListeners[event] = [];
      _stubListeners[event].push(fn);
    },
    off: function (event, fn) {
      var handlers = _stubListeners[event];
      if (handlers) _stubListeners[event] = handlers.filter(function (f) { return f !== fn; });
    },
  };

  // DataCache stub: localStorage-backed with TTL support
  var _stubCacheStore = {};
  var stubDataCache = {
    get: async function (store, key) {
      var cacheKey = 'fm_' + store + '_' + key;
      var entry = _stubCacheStore[cacheKey];
      if (entry && (!entry.expires || entry.expires > Date.now())) {
        return entry.value;
      }
      return null;
    },
    set: async function (store, key, value, ttlMs) {
      var cacheKey = 'fm_' + store + '_' + key;
      _stubCacheStore[cacheKey] = {
        value: value,
        expires: ttlMs ? Date.now() + ttlMs : 0,
      };
    },
    remove: async function (store, key) {
      var cacheKey = 'fm_' + store + '_' + key;
      delete _stubCacheStore[cacheKey];
    },
    clear: async function () {
      _stubCacheStore = {};
    },
  };

  window.__FM_TS = {
    eventBus: stubEventBus,
    dataCache: stubDataCache,
    appStore: null,        // not used by legacy JS directly
    errorHandler: null,
    themeManager: null,
    settingsPresets: null,
    platform: null,
    ready: false,
  };

  // Mark as loaded so ts-audio-bridge.js and others see it
  window.__FM_TS_LOADED = true;

  console.log('[TS-Loader] Stub __FM_TS initialized — ready for TS bridge overlay');
})();
