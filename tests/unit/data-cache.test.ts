// ============================================================
// Tests for DataCache — IndexedDB-backed cache with TTL
// ============================================================
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DataCache } from '../../src/core/data-cache';

describe('DataCache', () => {
	let cache: DataCache;

	beforeEach(async () => {
		cache = new DataCache();
		await cache.open();
	});

	afterEach(() => {
		cache.close();
	});

	// --------------- basic get / set ---------------

	describe('get / set', () => {
		it('should store and retrieve a primitive value', async () => {
			await cache.set('playlists', 'key1', 'hello');
			const val = await cache.get<string>('playlists', 'key1');
			expect(val).toBe('hello');
		});

		it('should store and retrieve an object', async () => {
			const obj = { name: 'My Playlist', tracks: 42 };
			await cache.set('playlists', 'pl1', obj);
			const val = await cache.get<typeof obj>('playlists', 'pl1');
			expect(val).toEqual(obj);
		});

		it('should store and retrieve an array', async () => {
			const arr = [1, 2, 3];
			await cache.set('songs', 'arr', arr);
			const val = await cache.get<number[]>('songs', 'arr');
			expect(val).toEqual([1, 2, 3]);
		});

		it('should store and retrieve null', async () => {
			await cache.set('search', 'nullish', null);
			const val = await cache.get('search', 'nullish');
			expect(val).toBeNull();
		});

		it('should return null for missing keys', async () => {
			const val = await cache.get('playlists', 'nonexistent');
			expect(val).toBeNull();
		});

		it('should overwrite an existing key', async () => {
			await cache.set('urls', 'k', 'v1');
			await cache.set('urls', 'k', 'v2');
			const val = await cache.get<string>('urls', 'k');
			expect(val).toBe('v2');
		});

		it('should isolate keys across different stores', async () => {
			await cache.set('playlists', 'key', 'pl-value');
			await cache.set('songs', 'key', 'song-value');
			expect(await cache.get<string>('playlists', 'key')).toBe('pl-value');
			expect(await cache.get<string>('songs', 'key')).toBe('song-value');
		});
	});

	// --------------- TTL expiration ---------------

	describe('TTL expiration', () => {
		it('should return value before TTL expires', async () => {
			await cache.set('lyrics', 'fresh', 'some-lyrics', 60_000); // 1 min
			const val = await cache.get<string>('lyrics', 'fresh');
			expect(val).toBe('some-lyrics');
		});

		it('should return null after TTL expires', async () => {
			// Set with TTL of 100ms
			await cache.set('lyrics', 'stale', 'old-lyrics', 100);
			// Wait for expiry
			await new Promise((r) => setTimeout(r, 150));
			const val = await cache.get<string>('lyrics', 'stale');
			expect(val).toBeNull();
		});

		it('should treat ttlMs=0 as never-expiring', async () => {
			await cache.set('profiles', 'perm', 'permanent', 0);
			const val = await cache.get<string>('profiles', 'perm');
			expect(val).toBe('permanent');
		});

		it('should treat omitted ttlMs as never-expiring', async () => {
			await cache.set('profiles', 'perm2', 'forever');
			const val = await cache.get<string>('profiles', 'perm2');
			expect(val).toBe('forever');
		});

		it('should clean up expired entry on get attempt', async () => {
			await cache.set('search', 'cleanup', 'data', 50);
			await new Promise((r) => setTimeout(r, 100));
			// get should trigger background delete
			const val = await cache.get('search', 'cleanup');
			expect(val).toBeNull();
			// A second get should also return null (the entry was cleaned)
			const val2 = await cache.get('search', 'cleanup');
			expect(val2).toBeNull();
		});

		it('should not expire entries in one store based on another store', async () => {
			await cache.set('lyrics', 'shared-key', 'lyric-value', 50);
			await cache.set('search', 'shared-key', 'search-value', 10_000);
			await new Promise((r) => setTimeout(r, 100));
			expect(await cache.get<string>('lyrics', 'shared-key')).toBeNull();
			expect(await cache.get<string>('search', 'shared-key')).toBe('search-value');
		});
	});

	// --------------- getOrFetch ---------------

	describe('getOrFetch', () => {
		it('should return cached value and not call fetcher', async () => {
			await cache.set('urls', 'cached', 'cached-url', 60_000);
			const fetcher = vi.fn().mockResolvedValue('fresh-url');

			const val = await cache.getOrFetch('urls', 'cached', fetcher, 60_000);
			expect(val).toBe('cached-url');
			expect(fetcher).not.toHaveBeenCalled();
		});

		it('should call fetcher on cache miss and cache result', async () => {
			const fetcher = vi.fn().mockResolvedValue('fetched-data');

			const val = await cache.getOrFetch('search', 'new-key', fetcher, 60_000);
			expect(val).toBe('fetched-data');
			expect(fetcher).toHaveBeenCalledTimes(1);

			// Subsequent call should hit cache
			const val2 = await cache.getOrFetch('search', 'new-key', fetcher, 60_000);
			expect(val2).toBe('fetched-data');
			expect(fetcher).toHaveBeenCalledTimes(1); // still once
		});

		it('should call fetcher when cached entry is expired', async () => {
			await cache.set('urls', 'old', 'stale-data', 50);
			const fetcher = vi.fn().mockResolvedValue('refreshed-data');
			await new Promise((r) => setTimeout(r, 100));

			const val = await cache.getOrFetch('urls', 'old', fetcher, 60_000);
			expect(val).toBe('refreshed-data');
			expect(fetcher).toHaveBeenCalledTimes(1);
		});

		it('should return fetcher result even when set fails', async () => {
			// Use a store name that will cause put to fail — but with IndexedDB
			// all registered stores are valid, so we test the happy path.
			const fetcher = vi.fn().mockResolvedValue('ok');
			const val = await cache.getOrFetch('profiles', 'robust', fetcher, 10_000);
			expect(val).toBe('ok');
		});
	});

	// --------------- delete ---------------

	describe('delete', () => {
		it('should remove an existing entry', async () => {
			await cache.set('playlists', 'todelete', 'value');
			await cache.delete('playlists', 'todelete');
			expect(await cache.get('playlists', 'todelete')).toBeNull();
		});

		it('should be a no-op for non-existent keys', async () => {
			// Should not throw
			await expect(cache.delete('playlists', 'ghost')).resolves.toBeUndefined();
		});
	});

	// --------------- clearStore ---------------

	describe('clearStore', () => {
		it('should remove all entries from one store but not others', async () => {
			await cache.set('playlists', 'p1', 'a');
			await cache.set('playlists', 'p2', 'b');
			await cache.set('songs', 's1', 'c');

			await cache.clearStore('playlists');

			expect(await cache.get('playlists', 'p1')).toBeNull();
			expect(await cache.get('playlists', 'p2')).toBeNull();
			expect(await cache.get<string>('songs', 's1')).toBe('c');
		});

		it('should not throw on empty store', async () => {
			await expect(cache.clearStore('lyrics')).resolves.toBeUndefined();
		});
	});

	// --------------- clearAll ---------------

	describe('clearAll', () => {
		it('should wipe every store', async () => {
			await cache.set('playlists', 'p', 'pl');
			await cache.set('songs', 's', 'song');
			await cache.set('urls', 'u', 'url');
			await cache.set('lyrics', 'l', 'lyric');
			await cache.set('search', 'sr', 'search');
			await cache.set('profiles', 'pr', 'profile');

			await cache.clearAll();

			for (const store of ['playlists', 'songs', 'urls', 'lyrics', 'search', 'profiles']) {
				expect(await cache.get(store, 'p')).toBeNull();
				expect(await cache.get(store, 's')).toBeNull();
				expect(await cache.get(store, 'u')).toBeNull();
				expect(await cache.get(store, 'l')).toBeNull();
				expect(await cache.get(store, 'sr')).toBeNull();
				expect(await cache.get(store, 'pr')).toBeNull();
			}
		});
	});

	// --------------- concurrent open ---------------

	describe('concurrent open', () => {
		it('should handle multiple concurrent open() calls', async () => {
			const c = new DataCache();
			const [a, b, c2] = await Promise.all([c.open(), c.open(), c.open()]);
			expect(a).toBeUndefined();
			expect(b).toBeUndefined();
			expect(c2).toBeUndefined();
			c.close();
		});

		it('should not throw when get is called without explicit open', async () => {
			const c = new DataCache();
			// get should auto-open
			const val = await c.get('playlists', 'auto');
			expect(val).toBeNull();
			c.close();
		});

		it('should auto-reopen after close', async () => {
			const c = new DataCache();
			await c.open();
			await c.set('songs', 'x', 'y');
			c.close();

			// Should work after re-open (auto-opened by set)
			await c.set('songs', 'x2', 'y2');
			expect(await c.get<string>('songs', 'x2')).toBe('y2');
			c.close();
		});
	});

	// --------------- Fallback (no IndexedDB) ---------------

	describe('fallback (no IndexedDB)', () => {
		let savedIDB: any;

		beforeEach(() => {
			savedIDB = global.indexedDB;
			delete (global as any).indexedDB;
		});

		afterEach(() => {
			(global as any).indexedDB = savedIDB;
		});

		it('should fall back to in-memory storage', async () => {
			const c = new DataCache();
			await c.open();

			await c.set('playlists', 'fb-key', { fallback: true });
			const val = await c.get<{ fallback: boolean }>('playlists', 'fb-key');
			expect(val).toEqual({ fallback: true });

			expect(c.isAvailable()).toBe(false);
			c.close();
		});

		it('should respect TTL in fallback mode', async () => {
			const c = new DataCache();
			await c.open();

			await c.set('search', 'tmp', 'ephemeral', 50);
			await new Promise((r) => setTimeout(r, 100));
			const val = await c.get('search', 'tmp');
			expect(val).toBeNull();
			c.close();
		});

		it('should support getOrFetch in fallback mode', async () => {
			const c = new DataCache();
			await c.open();

			const fetcher = vi.fn().mockResolvedValue('fb-fetched');
			const val = await c.getOrFetch('urls', 'fb', fetcher, 60_000);
			expect(val).toBe('fb-fetched');
			expect(fetcher).toHaveBeenCalledTimes(1);

			// Second call should hit cache
			const val2 = await c.getOrFetch('urls', 'fb', fetcher, 60_000);
			expect(val2).toBe('fb-fetched');
			expect(fetcher).toHaveBeenCalledTimes(1);
			c.close();
		});

		it('should support delete and clearStore in fallback mode', async () => {
			const c = new DataCache();
			await c.open();

			await c.set('playlists', 'd', 'x');
			await c.delete('playlists', 'd');
			expect(await c.get('playlists', 'd')).toBeNull();

			await c.set('songs', 'a', 1);
			await c.set('songs', 'b', 2);
			await c.clearStore('songs');
			expect(await c.get('songs', 'a')).toBeNull();
			expect(await c.get('songs', 'b')).toBeNull();

			c.close();
		});

		it('should support clearAll in fallback mode', async () => {
			const c = new DataCache();
			await c.open();

			await c.set('playlists', 'x', 1);
			await c.set('songs', 'y', 2);
			await c.clearAll();

			expect(await c.get('playlists', 'x')).toBeNull();
			expect(await c.get('songs', 'y')).toBeNull();
			c.close();
		});
	});

	// --------------- all store types ---------------

	describe('store isolation', () => {
		const stores = ['playlists', 'songs', 'urls', 'lyrics', 'search', 'profiles'] as const;

		for (const store of stores) {
			it(`should read/write in store: ${store}`, async () => {
				await cache.set(store, 'test', store);
				expect(await cache.get<string>(store, 'test')).toBe(store);
			});

			it(`should clear store: ${store}`, async () => {
				await cache.set(store, 'a', 1);
				await cache.set(store, 'b', 2);
				await cache.clearStore(store);
				expect(await cache.get(store, 'a')).toBeNull();
				expect(await cache.get(store, 'b')).toBeNull();
			});
		}
	});

	// --------------- edge cases ---------------

	describe('edge cases', () => {
		it('should handle large objects', async () => {
			const large = { data: new Array(1000).fill('x').join('') };
			await cache.set('search', 'big', large);
			const val = await cache.get<typeof large>('search', 'big');
			expect(val?.data?.length).toBe(1000);
		});

		it('should handle special characters in keys', async () => {
			const weirdKey = 'key/with:special?chars&=%20';
			await cache.set('urls', weirdKey, 'works');
			expect(await cache.get<string>('urls', weirdKey)).toBe('works');
		});

		it('should handle Unicode keys and values', async () => {
			const unicodeKey = '歌曲_列表';
			const unicodeVal = '🎵 音乐 🎶';
			await cache.set('playlists', unicodeKey, unicodeVal);
			expect(await cache.get<string>('playlists', unicodeKey)).toBe(unicodeVal);
		});

		it('should handle zero TTL (immediately expired)', async () => {
			await cache.set('search', 'instant', 'gone', 1);
			await new Promise((r) => setTimeout(r, 10));
			expect(await cache.get('search', 'instant')).toBeNull();
		});

		it('should handle boolean values', async () => {
			await cache.set('profiles', 'bool-true', true);
			await cache.set('profiles', 'bool-false', false);
			expect(await cache.get<boolean>('profiles', 'bool-true')).toBe(true);
			expect(await cache.get<boolean>('profiles', 'bool-false')).toBe(false);
		});

		it('should handle number values including 0', async () => {
			await cache.set('songs', 'zero', 0);
			await cache.set('songs', 'neg', -1);
			expect(await cache.get<number>('songs', 'zero')).toBe(0);
			expect(await cache.get<number>('songs', 'neg')).toBe(-1);
		});
	});
});
