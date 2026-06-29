// ============================================================
// FluidMusic — Favorites Manager
// LocalStorage-persisted favorites list
// Survives app restarts
// ============================================================
(function () {
  'use strict';

  const STORAGE_KEY = 'fluidmusic-favorites';

  const Favorites = {
    items: [],
    initialized: false,
  };

  function init() {
    load();
    Favorites.initialized = true;
    console.log('Favorites initialized:', Favorites.items.length, 'items');
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      Favorites.items = raw ? JSON.parse(raw) : [];
    } catch (e) {
      Favorites.items = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Favorites.items));
    } catch (e) {
      console.warn('Failed to save favorites:', e);
    }
  }

  function add(track) {
    // Avoid duplicates by id+platform
    const exists = Favorites.items.find(
      (t) => t.id === track.id && t.platform === track.platform
    );
    if (!exists) {
      Favorites.items.unshift({
        id: track.id,
        title: track.title || track.name || '未知',
        artist: track.artist || '',
        coverUrl: track.coverUrl || '',
        platform: track.platform || 'local',
        addedAt: Date.now(),
      });
      save();
      return true;
    }
    return false;
  }

  function remove(track) {
    const idx = Favorites.items.findIndex(
      (t) => t.id === track.id && t.platform === track.platform
    );
    if (idx >= 0) {
      Favorites.items.splice(idx, 1);
      save();
      return true;
    }
    return false;
  }

  function toggle(track) {
    if (has(track)) {
      remove(track);
      return false;
    } else {
      add(track);
      return true;
    }
  }

  function has(track) {
    return Favorites.items.some(
      (t) => t.id === track.id && t.platform === track.platform
    );
  }

  function clear() {
    Favorites.items = [];
    save();
  }

  function getAll() {
    return [...Favorites.items];
  }

  function count() {
    return Favorites.items.length;
  }

  Favorites.init = init;
  Favorites.add = add;
  Favorites.remove = remove;
  Favorites.toggle = toggle;
  Favorites.has = has;
  Favorites.clear = clear;
  Favorites.getAll = getAll;
  Favorites.count = count;

  window.Favorites = Favorites;
  console.log('FluidMusic Favorites loaded');
})();
