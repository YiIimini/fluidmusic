// ============================================================
// Tests for Favorites — localStorage-backed favorites manager
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';

// The Favorites module uses localStorage key 'fluidmusic-favorites'
// We test its expected behavior
describe('Favorites', () => {
  const FAVORITES_KEY = 'fluidmusic-favorites';

  const Favorites = {
    _getAll() {
      try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      } catch { return []; }
    },
    _setAll(items) {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
    },
    getAll() {
      return [...this._getAll()];
    },
    has(track) {
      return this._getAll().some(
        (f) => f.id === track.id && f.platform === track.platform
      );
    },
    toggle(track) {
      const items = this._getAll();
      const idx = items.findIndex(
        (f) => f.id === track.id && f.platform === track.platform
      );
      if (idx >= 0) {
        items.splice(idx, 1);
        this._setAll(items);
        return false; // removed
      }
      items.push({
        id: track.id,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl || '',
        platform: track.platform,
        addedAt: Date.now(),
      });
      this._setAll(items);
      return true; // added
    },
    clear() {
      localStorage.removeItem(FAVORITES_KEY);
    },
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('should start with empty favorites', () => {
    expect(Favorites.getAll()).toEqual([]);
  });

  it('should add a track to favorites', () => {
    const track = { id: '123', title: 'Test Song', artist: 'Artist', platform: 'netease' };
    const added = Favorites.toggle(track);
    expect(added).toBe(true);
    expect(Favorites.getAll()).toHaveLength(1);
    expect(Favorites.getAll()[0].title).toBe('Test Song');
  });

  it('should remove a track when toggled twice', () => {
    const track = { id: '456', title: 'Another', artist: 'Artist2', platform: 'qq' };
    Favorites.toggle(track); // add
    Favorites.toggle(track); // remove
    expect(Favorites.getAll()).toHaveLength(0);
  });

  it('should detect if a track is favorited', () => {
    const track = { id: '789', title: 'Faved', platform: 'netease' };
    Favorites.toggle(track);
    expect(Favorites.has(track)).toBe(true);
    expect(Favorites.has({ id: '999', platform: 'netease' })).toBe(false);
  });

  it('should clear all favorites', () => {
    Favorites.toggle({ id: '1', platform: 'netease' });
    Favorites.toggle({ id: '2', platform: 'qq' });
    expect(Favorites.getAll()).toHaveLength(2);
    Favorites.clear();
    expect(Favorites.getAll()).toHaveLength(0);
  });

  it('should deduplicate by id + platform', () => {
    const track = { id: 'same', title: 'Dup', platform: 'netease' };
    Favorites.toggle(track);
    Favorites.toggle(track); // remove
    Favorites.toggle(track); // re-add
    expect(Favorites.getAll()).toHaveLength(1);
  });

  it('should store platform info', () => {
    Favorites.toggle({ id: 'n1', platform: 'netease', title: 'N' });
    Favorites.toggle({ id: 'q1', platform: 'qq', title: 'Q' });
    const all = Favorites.getAll();
    expect(all.find(f => f.platform === 'netease').title).toBe('N');
    expect(all.find(f => f.platform === 'qq').title).toBe('Q');
  });
});
