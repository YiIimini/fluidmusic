// ============================================================
// FluidMusic — Data Cache Layer
// Persistent storage for playlist/song data across sessions
// Batch API loading with anti-throttle delays
// ============================================================
(function () {
  'use strict';

  const CACHE_PREFIX = 'fluidmusic_cache_';
  const CACHE_VERSION = 1;

  const DataCache = {
    _mem: {},
  };

  // ── Persistent read/write ──
  function cacheKey(key) { return CACHE_PREFIX + key; }

  DataCache.get = function (key) {
    if (DataCache._mem[key] !== undefined) return DataCache._mem[key];
    try {
      const raw = localStorage.getItem(cacheKey(key));
      if (raw) {
        const parsed = JSON.parse(raw);
        DataCache._mem[key] = parsed;
        return parsed;
      }
    } catch (e) { /* ignore */ }
    return null;
  };

  DataCache.set = function (key, value) {
    DataCache._mem[key] = value;
    try {
      localStorage.setItem(cacheKey(key), JSON.stringify(value));
    } catch (e) {
      console.warn('[DataCache] Storage full, clearing oldest entries');
      clearOldest();
      try { localStorage.setItem(cacheKey(key), JSON.stringify(value)); } catch (e2) {}
    }
  };

  DataCache.has = function (key) {
    return DataCache.get(key) !== null;
  };

  DataCache.remove = function (key) {
    delete DataCache._mem[key];
    try { localStorage.removeItem(cacheKey(key)); } catch (e) {}
  };

  function clearOldest() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.sort();
    // Remove oldest 20%
    const remove = Math.max(1, Math.floor(keys.length * 0.2));
    for (let i = 0; i < remove && i < keys.length; i++) {
      localStorage.removeItem(keys[i]);
    }
  }

  // ── Batch loader with delay between requests ──
  DataCache.batchFetch = async function (fetchers, delayMs) {
    delayMs = delayMs || 800;
    const results = [];
    for (let i = 0; i < fetchers.length; i++) {
      try {
        const r = await fetchers[i]();
        results.push(r);
      } catch (e) {
        console.warn('[DataCache] Batch fetch item', i, 'failed:', e.message);
        results.push(null);
      }
      if (i < fetchers.length - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    return results;
  };

  // ── Cache playlist data with timestamp ──
  DataCache.cachePlaylists = function (playlists) {
    DataCache.set('playlists', {
      data: playlists,
      ts: Date.now(),
      v: CACHE_VERSION,
    });
  };

  DataCache.getCachedPlaylists = function () {
    const entry = DataCache.get('playlists');
    if (!entry || entry.v !== CACHE_VERSION) return null;
    // Cache valid for 30 minutes
    if (Date.now() - entry.ts > 6 * 60 * 60 * 1000) return null; // 6 hour cache
    return entry.data;
  };

  // ── Cache song list for a playlist ──
  DataCache.cachePlaylistSongs = function (playlistId, platform, tracks) {
    DataCache.set('plsongs_' + platform + '_' + playlistId, {
      data: tracks,
      ts: Date.now(),
    });
  };

  DataCache.getCachedPlaylistSongs = function (playlistId, platform) {
    const entry = DataCache.get('plsongs_' + platform + '_' + playlistId);
    if (!entry) return null;
    if (Date.now() - entry.ts > 24 * 60 * 60 * 1000) return null; // 24 hour cache
    return entry.data;
  };


  // Clear only playlist song caches (keep playlists metadata and favorites)
  DataCache.clearAllPlaylistSongs = function () {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX) && (k.includes('plsongs_') || k.includes('track_url_'))) {
        keys.push(k);
      }
    }
    keys.forEach(k => { localStorage.removeItem(k); delete DataCache._mem[k]; });
  };

  
  // ── Track URL cache (survives across sessions) ──
  DataCache.cacheTrackUrl = function (trackId, platform, url) {
    if (!trackId || !url) return;
    DataCache.set('track_url_' + platform + '_' + trackId, { url, ts: Date.now() });
  };

  DataCache.getCachedTrackUrl = function (trackId, platform) {
    const entry = DataCache.get('track_url_' + platform + '_' + trackId);
    if (!entry) return null;
    // QQ Music URLs expire ~30 min; use 25 min to be safe
    // Netease URLs last longer; use 2 hours
    const ttl = platform === 'qq' ? 25 * 60 * 1000 : 2 * 60 * 60 * 1000;
    if (Date.now() - entry.ts > ttl) return null;
    return entry.url;
  };

  DataCache.clearAll = function () {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    DataCache._mem = {};
  };

  if (typeof __FM !== 'undefined') __FM.register('dataCache', [], function () { return DataCache; }, { priority: 9 });
  window.DataCache = DataCache;
  console.log('FluidMusic Data Cache loaded');
})();
