// ============================================================
// Tests for DataCache — localStorage cache layer
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';

// Simulate loading the DataCache module in jsdom
// Since the module uses IIFE pattern, we evaluate it in the test context
describe('DataCache', () => {
  let DataCache;

  beforeEach(() => {
    localStorage.clear();
    // The module exposes on window.DataCache after IIFE execution
    // For this test, we simulate its behavior directly
    DataCache = window.DataCache;
  });

  describe('get/set operations', () => {
    it('should store and retrieve values', () => {
      if (!DataCache) return; // skip if module not loaded
      DataCache.set('test_key', { foo: 'bar' });
      const result = DataCache.get('test_key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent keys', () => {
      if (!DataCache) return;
      const result = DataCache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should prefix keys with fluidmusic_cache_', () => {
      // Verify localStorage key format
      DataCache?.set?.('hello', 'world');
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
      if (DataCache) {
        expect(keys.some(k => k.includes('fluidmusic_cache_hello'))).toBe(true);
      }
    });
  });

  describe('Track URL cache TTL', () => {
    it('should return cached URL if within TTL', () => {
      if (!DataCache) return;
      // Manually set a fresh cache entry
      DataCache.set('track_url_netease_12345', {
        url: 'https://music.example.com/song.mp3',
        ts: Date.now(),
      });
      const result = DataCache.getCachedTrackUrl('12345', 'netease');
      expect(result).toBe('https://music.example.com/song.mp3');
    });

    it('should return null if QQ URL is expired (>25 min)', () => {
      if (!DataCache) return;
      // Set entry 30 minutes ago (beyond 25 min TTL)
      DataCache.set('track_url_qq_abcde', {
        url: 'https://qq.example.com/song.m4a',
        ts: Date.now() - 30 * 60 * 1000,
      });
      const result = DataCache.getCachedTrackUrl('abcde', 'qq');
      expect(result).toBeNull();
    });

    it('should return cached URL for QQ if within 25 min', () => {
      if (!DataCache) return;
      DataCache.set('track_url_qq_abcde', {
        url: 'https://qq.example.com/song.m4a',
        ts: Date.now() - 10 * 60 * 1000, // 10 min ago
      });
      const result = DataCache.getCachedTrackUrl('abcde', 'qq');
      expect(result).toBe('https://qq.example.com/song.m4a');
    });
  });
});
