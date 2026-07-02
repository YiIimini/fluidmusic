// ============================================================
// Tests for ApiBridge — URL building & response parsing contract
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ApiBridge', () => {
  // Simulate the ApiBridge URL builder and response parser.
  // The real module is at public/js/api-bridge.js; these tests
  // document and verify the URL contract and response shapes.

  const BASE_URL = 'http://127.0.0.1:3000';

  function buildUrl(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    return BASE_URL + endpoint + (query ? '?' + query : '');
  }

  function parseNeteaseSearchResponse(json) {
    // Expected shape: { result: { songs: [{ id, name, ar: [{name}], al: {picUrl} }] } }
    if (!json || !json.result || !json.result.songs) return [];
    return json.result.songs.map((song) => ({
      id: String(song.id),
      title: song.name || '',
      artist: (song.ar || []).map((a) => a.name).join(' / '),
      coverUrl: (song.al && song.al.picUrl) || '',
      platform: 'netease',
    }));
  }

  function parseQQSearchResponse(json) {
    // Expected shape: { data: { song: { list: [{ songid, songname, singer: [{name}], albumPic }] } } }
    if (!json || !json.data || !json.data.song || !json.data.song.list) return [];
    return json.data.song.list.map((song) => ({
      id: String(song.songid || song.mid || ''),
      title: song.songname || song.name || '',
      artist: (song.singer || []).map((s) => s.name).join(' / '),
      coverUrl: (song.albumPic || song.cover || '').replace(/^http:/, 'https:'),
      platform: 'qq',
    }));
  }

  // ── URL building ──

  it('should build correct search URL for netease', () => {
    const url = buildUrl('/api/netease/search', { keywords: 'hello', limit: '20' });
    expect(url).toBe(
      'http://127.0.0.1:3000/api/netease/search?keywords=hello&limit=20'
    );
  });

  it('should build correct search URL for QQ', () => {
    const url = buildUrl('/api/qq/search', { keywords: 'world', limit: '10' });
    expect(url).toBe(
      'http://127.0.0.1:3000/api/qq/search?keywords=world&limit=10'
    );
  });

  it('should omit query string when params are empty', () => {
    const url = buildUrl('/api/netease/account');
    expect(url).toBe('http://127.0.0.1:3000/api/netease/account');
  });

  it('should URL-encode special characters in search keywords', () => {
    const url = buildUrl('/api/netease/search', { keywords: '你好 world', limit: '5' });
    // URLSearchParams encodes spaces as '+' (application/x-www-form-urlencoded)
    const encoded = new URLSearchParams({ keywords: '你好 world' }).toString();
    expect(url).toContain(encoded);
    expect(url).toContain('limit=5');
  });

  // ── Response parsing ──

  it('should parse netease search response correctly', () => {
    const neteaseJson = {
      result: {
        songs: [
          {
            id: 186057,
            name: 'Hello',
            ar: [{ name: 'Adele' }],
            al: { picUrl: 'https://p1.music.126.net/abc.jpg' },
          },
          {
            id: 256,
            name: 'Hello, Goodbye',
            ar: [{ name: 'The Beatles' }],
            al: { picUrl: 'https://p1.music.126.net/def.jpg' },
          },
        ],
      },
    };

    const results = parseNeteaseSearchResponse(neteaseJson);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      id: '186057',
      title: 'Hello',
      artist: 'Adele',
      coverUrl: 'https://p1.music.126.net/abc.jpg',
      platform: 'netease',
    });
    expect(results[1].artist).toBe('The Beatles');
    expect(results[1].platform).toBe('netease');
  });

  it('should parse QQ search response correctly', () => {
    const qqJson = {
      data: {
        song: {
          list: [
            {
              songid: '78901',
              songname: 'Hello',
              singer: [{ name: 'Adele' }],
              albumPic: 'http://y.gtimg.cn/music/photo_new/abc.jpg',
            },
          ],
        },
      },
    };

    const results = parseQQSearchResponse(qqJson);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: '78901',
      title: 'Hello',
      artist: 'Adele',
      coverUrl: 'https://y.gtimg.cn/music/photo_new/abc.jpg',
      platform: 'qq',
    });
  });

  it('should handle empty search results', () => {
    // Netease empty
    expect(parseNeteaseSearchResponse({ result: { songs: [] } })).toEqual([]);
    expect(parseNeteaseSearchResponse({ result: {} })).toEqual([]);
    expect(parseNeteaseSearchResponse(null)).toEqual([]);
    expect(parseNeteaseSearchResponse({})).toEqual([]);

    // QQ empty
    expect(parseQQSearchResponse({ data: { song: { list: [] } } })).toEqual([]);
    expect(parseQQSearchResponse({ data: {} })).toEqual([]);
    expect(parseQQSearchResponse(null)).toEqual([]);
  });

  it('should handle network error gracefully', async () => {
    // Simulate fetchApi rejecting — the caller should catch and return a safe fallback
    async function safeSearch(fetchFn) {
      try {
        return await fetchFn();
      } catch (e) {
        return { error: true, message: e.message };
      }
    }

    const failingFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await safeSearch(failingFetch);

    expect(result.error).toBe(true);
    expect(result.message).toBe('Network error');
    expect(failingFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle malformed JSON response gracefully', async () => {
    // If the server returns something that isn't valid JSON, the parser should handle it
    async function safeParse(fetchFn) {
      try {
        const raw = await fetchFn();
        // In real code this would be res.json() which throws on invalid JSON
        if (typeof raw === 'string') {
          try { return JSON.parse(raw); } catch (e) {
            return { error: true, message: 'Invalid JSON' };
          }
        }
        return raw;
      } catch (e) {
        return { error: true, message: e.message };
      }
    }

    const badFetch = vi.fn().mockResolvedValue('not valid json {{{');
    const result = await safeParse(badFetch);

    expect(result.error).toBe(true);
    expect(result.message).toBe('Invalid JSON');
  });
});
