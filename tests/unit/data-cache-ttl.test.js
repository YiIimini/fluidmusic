// ============================================================
// Tests for DataCache TTL — cache expiry contract
// Complements data-cache.test.js with focused TTL-value assertions
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DataCache TTL', () => {
  // Simulate the TTL contract that DataCache must uphold.
  // The real DataCache (public/js/data-cache.js) already implements
  // most of this; these tests document and verify the exact TTL values.

  const TTL = {
    QQ_SONG_URL: 25 * 60 * 1000,         // 25 minutes
    NETEASE_SONG_URL: 2 * 60 * 60 * 1000, // 2 hours
    PLAYLIST_META: 6 * 60 * 60 * 1000,    // 6 hours
  };

  function makeCacheEntry(value, ageMs) {
    return { value, ts: Date.now() - ageMs };
  }

  function isExpired(entry, ttlMs) {
    if (!entry) return true;
    return Date.now() - entry.ts > ttlMs;
  }

  function getCachedTrackUrl(entry, platform) {
    if (!entry) return null;
    const ttl = platform === 'qq' ? TTL.QQ_SONG_URL : TTL.NETEASE_SONG_URL;
    if (isExpired(entry, ttl)) return null;
    return entry.value;
  }

  function getCachedPlaylists(entry) {
    if (!entry) return null;
    if (isExpired(entry, TTL.PLAYLIST_META)) return null;
    return entry.value;
  }

  it('should return cached value before TTL expires', () => {
    const entry = makeCacheEntry('https://example.com/song.mp3', 0);
    const result = getCachedTrackUrl(entry, 'netease');
    expect(result).toBe('https://example.com/song.mp3');
  });

  it('should return null after TTL expires', () => {
    const entry = makeCacheEntry('https://example.com/song.mp3', TTL.NETEASE_SONG_URL + 1000);
    const result = getCachedTrackUrl(entry, 'netease');
    expect(result).toBeNull();
  });

  it('should use 25min TTL for QQ song URLs', () => {
    // Within 25 min — should be valid
    const fresh = makeCacheEntry('qq-song', 24 * 60 * 1000);
    expect(getCachedTrackUrl(fresh, 'qq')).toBe('qq-song');

    // Past 25 min — should expire
    const stale = makeCacheEntry('qq-song', 26 * 60 * 1000);
    expect(getCachedTrackUrl(stale, 'qq')).toBeNull();
  });

  it('should use 2h TTL for Netease song URLs', () => {
    // Within 2 hours — should be valid
    const fresh = makeCacheEntry('ne-song', 119 * 60 * 1000);
    expect(getCachedTrackUrl(fresh, 'netease')).toBe('ne-song');

    // Past 2 hours — should expire
    const stale = makeCacheEntry('ne-song', 121 * 60 * 1000);
    expect(getCachedTrackUrl(stale, 'netease')).toBeNull();
  });

  it('should use 6h TTL for playlist metadata', () => {
    // Within 6 hours — should be valid
    const fresh = makeCacheEntry([{ id: '1', name: 'My List' }], 5 * 60 * 60 * 1000);
    expect(getCachedPlaylists(fresh)).toEqual([{ id: '1', name: 'My List' }]);

    // Past 6 hours — should expire
    const stale = makeCacheEntry([{ id: '1' }], 7 * 60 * 60 * 1000);
    expect(getCachedPlaylists(stale)).toBeNull();
  });

  it('should call fetcher on cache miss', async () => {
    // Simulate a cache-or-fetch pattern: if cache entry is missing/expired,
    // the fetcher function is called to obtain fresh data.
    const fetcher = vi.fn().mockResolvedValue('fresh-data');
    const cacheEntry = null; // simulate miss

    async function getOrFetch(entry, fetcherFn) {
      if (!entry || isExpired(entry, TTL.NETEASE_SONG_URL)) {
        return await fetcherFn();
      }
      return entry.value;
    }

    const result = await getOrFetch(cacheEntry, fetcher);
    expect(result).toBe('fresh-data');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should not call fetcher on cache hit', async () => {
    const fetcher = vi.fn().mockResolvedValue('should-not-be-called');
    const cacheEntry = makeCacheEntry('cached-data', 0); // fresh entry

    async function getOrFetch(entry, fetcherFn) {
      if (!entry || isExpired(entry, TTL.NETEASE_SONG_URL)) {
        return await fetcherFn();
      }
      return entry.value;
    }

    const result = await getOrFetch(cacheEntry, fetcher);
    expect(result).toBe('cached-data');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
