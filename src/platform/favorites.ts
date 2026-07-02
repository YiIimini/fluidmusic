// ============================================================
// FluidMusic — Favorites Manager (TypeScript)
// LocalStorage-persisted favorites list with id+platform dedup
// Survives app restarts
// Migrated from public/js/favorites.js
// ============================================================

import type { Track } from '../types/track';

declare const __FM: {
  register: (name: string, deps: string[], factory: () => any, opts?: { priority?: number }) => void;
} | undefined;

// ---- Types ----

export interface FavoriteItem {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  platform: string;
  addedAt: number;
}

const STORAGE_KEY = 'fluidmusic-favorites';

// ---- Favorites ----

export class Favorites {
  items: FavoriteItem[] = [];
  initialized = false;

  init(): void {
    this.load();
    this.initialized = true;
    console.log('Favorites initialized:', this.items.length, 'items');
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.items = raw ? JSON.parse(raw) : [];
    } catch (_e) {
      this.items = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (e) {
      console.warn('Failed to save favorites:', e);
    }
  }

  /**
   * Add a track to favorites. Returns true if added, false if already present.
   * Deduplicates by id + platform.
   */
  add(track: Track): boolean {
    const exists = this.items.find(
      (t) => t.id === track.id && t.platform === track.platform
    );
    if (!exists) {
      this.items.unshift({
        id: track.id,
        title: track.name || '未知',
        artist: track.artist || '',
        coverUrl: track.coverUrl || '',
        platform: track.platform || 'local',
        addedAt: Date.now(),
      });
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Remove a track from favorites by id + platform.
   * Returns true if removed, false if not found.
   */
  remove(track: Track): boolean {
    const idx = this.items.findIndex(
      (t) => t.id === track.id && t.platform === track.platform
    );
    if (idx >= 0) {
      this.items.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Toggle a track's favorite status. Returns the new state (true = favorited).
   */
  toggle(track: Track): boolean {
    if (this.has(track)) {
      this.remove(track);
      return false;
    } else {
      this.add(track);
      return true;
    }
  }

  /**
   * Check whether a track is favorited.
   */
  has(track: Track): boolean {
    return this.items.some(
      (t) => t.id === track.id && t.platform === track.platform
    );
  }

  /** Remove all favorites. */
  clear(): void {
    this.items = [];
    this.save();
  }

  /** Return a shallow copy of all favorite items. */
  getAll(): FavoriteItem[] {
    return [...this.items];
  }

  /** Return the number of favorited tracks. */
  count(): number {
    return this.items.length;
  }
}

// ── Singleton + backward-compat ──
const instance = new Favorites();

if (typeof __FM !== 'undefined') {
  __FM.register('favorites', [], () => instance, { priority: 9 });
}

(window as any).Favorites = instance;
console.log('FluidMusic Favorites loaded (TS)');
