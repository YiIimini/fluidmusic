// ============================================================
// FluidMusic — DataCache: async IndexedDB-backed cache layer
// Replaces synchronous localStorage with IndexedDB + TTL expiration.
// ============================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // timestamp in ms; 0 = never expires
}

const DB_NAME = 'fluidmusic-cache';
const DB_VERSION = 1;
const STORES = ['playlists', 'songs', 'urls', 'lyrics', 'search', 'profiles'] as const;

type StoreName = (typeof STORES)[number];

/**
 * Async IndexedDB-backed cache with TTL-based expiration.
 *
 * Falls back silently to an in-memory Map when IndexedDB is unavailable
 * (e.g. in a stripped-down webview or restricted browser context).
 */
export class DataCache {
	private db: IDBDatabase | null = null;
	private opening: Promise<void> | null = null;
	private fallback = new Map<string, Map<string, CacheEntry<any>>>();

	// --------------- public API ---------------

	/**
	 * Open (or create) the IndexedDB database.  Safe to call multiple times —
	 * subsequent calls return the cached promise until the DB handle is ready.
	 */
	async open(): Promise<void> {
		if (this.db) return;
		if (!this.isIDBAvailable()) {
			// IndexedDB not available — fallback is always "open"
			this.ensureFallbackStores();
			return;
		}
		if (this.opening) return this.opening;

		this.opening = new Promise<void>((resolve, reject) => {
			const req = indexedDB.open(DB_NAME, DB_VERSION);
			req.onupgradeneeded = () => {
				const db = req.result;
				for (const name of STORES) {
					if (!db.objectStoreNames.contains(name)) {
						db.createObjectStore(name);
					}
				}
			};
			req.onsuccess = () => {
				this.db = req.result;
				this.db.onclose = () => {
					// If the DB is closed externally (e.g. disk full), reset so
					// the next call re-opens.
					this.db = null;
					this.opening = null;
				};
				resolve();
			};
			req.onerror = () => reject(req.error);
			req.onblocked = () => {
				// Another connection is holding an older version; close it so
				// we can upgrade.
				console.warn('[DataCache] blocked — closing stale connection');
				req.result?.close();
			};
		});

		try {
			await this.opening;
		} finally {
			// Allow re-opening after a failure
			if (!this.db) this.opening = null;
		}
	}

	/**
	 * Retrieve a cached value by store + key.  Returns `null` if the key does
	 * not exist or the entry has expired.  Expired entries are cleaned up
	 * asynchronously.
	 */
	async get<T>(store: string, key: string): Promise<T | null> {
		await this.ensureOpen();

		if (!this.db) {
			return this.fallbackGet<T>(store, key);
		}

		return new Promise<T | null>((resolve, reject) => {
			try {
				const tx = this.db!.transaction(store, 'readonly');
				const req = tx.objectStore(store).get(key);
				req.onsuccess = () => {
					const entry = req.result as CacheEntry<T> | undefined;
					if (!entry) {
						resolve(null);
						return;
					}
					if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
						// Expired — delete in background, return null
						this.delete(store, key).catch(() => {});
						resolve(null);
						return;
					}
					resolve(entry.value);
				};
				req.onerror = () => reject(req.error);
			} catch (e) {
				reject(e);
			}
		});
	}

	/**
	 * Store a value with an optional TTL in milliseconds.
	 * When `ttlMs` is omitted or 0 the entry never expires.
	 */
	async set<T>(
		store: string,
		key: string,
		value: T,
		ttlMs?: number,
	): Promise<void> {
		await this.ensureOpen();

		const entry: CacheEntry<T> = {
			value,
			expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : 0,
		};

		if (!this.db) {
			this.fallbackSet(store, key, entry);
			return;
		}

		return new Promise<void>((resolve, reject) => {
			try {
				const tx = this.db!.transaction(store, 'readwrite');
				tx.objectStore(store).put(entry, key);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			} catch (e) {
				reject(e);
			}
		});
	}

	/**
	 * Cache-aside helper: return cached value if present and fresh, otherwise
	 * call `fetcher()`, cache the result, and return it.
	 */
	async getOrFetch<T>(
		store: string,
		key: string,
		fetcher: () => Promise<T>,
		ttlMs: number,
	): Promise<T> {
		const cached = await this.get<T>(store, key);
		if (cached !== null) return cached;
		const value = await fetcher();
		await this.set(store, key, value, ttlMs);
		return value;
	}

	/**
	 * Delete a single entry.
	 */
	async delete(store: string, key: string): Promise<void> {
		await this.ensureOpen();

		if (!this.db) {
			const s = this.fallback.get(store);
			if (s) s.delete(key);
			return;
		}

		return new Promise<void>((resolve, reject) => {
			try {
				const tx = this.db!.transaction(store, 'readwrite');
				tx.objectStore(store).delete(key);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			} catch (e) {
				reject(e);
			}
		});
	}

	/**
	 * Remove every entry from one store.
	 */
	async clearStore(store: string): Promise<void> {
		await this.ensureOpen();

		if (!this.db) {
			const s = this.fallback.get(store);
			if (s) s.clear();
			return;
		}

		return new Promise<void>((resolve, reject) => {
			try {
				const tx = this.db!.transaction(store, 'readwrite');
				tx.objectStore(store).clear();
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			} catch (e) {
				reject(e);
			}
		});
	}

	/**
	 * Clear every store — effectively a full cache reset.
	 */
	async clearAll(): Promise<void> {
		await this.ensureOpen();

		if (!this.db) {
			for (const s of this.fallback.values()) s.clear();
			return;
		}

		const tasks = STORES.map(
			(store) =>
				new Promise<void>((resolve, reject) => {
					try {
						const tx = this.db!.transaction(store, 'readwrite');
						tx.objectStore(store).clear();
						tx.oncomplete = () => resolve();
						tx.onerror = () => reject(tx.error);
					} catch (e) {
						reject(e);
					}
				}),
		);
		await Promise.all(tasks);
	}

	/**
	 * Close the underlying database connection.  After calling this you must
	 * call `open()` again before using the cache.
	 */
	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
		this.opening = null;
	}

	/**
	 * Returns `true` when IndexedDB is available and the database is open
	 * (or will be opened on the next call).  Returns `false` when we have
	 * fallen back to in-memory storage.
	 */
	isAvailable(): boolean {
		return this.db !== null;
	}

	// --------------- private helpers ---------------

	private isIDBAvailable(): boolean {
		try {
			return typeof indexedDB !== 'undefined' && indexedDB !== null;
		} catch {
			return false;
		}
	}

	private async ensureOpen(): Promise<void> {
		if (!this.db && !this.opening) {
			await this.open();
		} else if (this.opening) {
			await this.opening;
		}
	}

	private ensureFallbackStores(): void {
		for (const name of STORES) {
			if (!this.fallback.has(name)) {
				this.fallback.set(name, new Map());
			}
		}
	}

	private fallbackGet<T>(store: string, key: string): T | null {
		const s = this.fallback.get(store);
		if (!s) return null;
		const entry = s.get(key) as CacheEntry<T> | undefined;
		if (!entry) return null;
		if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
			s.delete(key);
			return null;
		}
		return entry.value;
	}

	private fallbackSet<T>(store: string, key: string, entry: CacheEntry<T>): void {
		let s = this.fallback.get(store);
		if (!s) {
			s = new Map();
			this.fallback.set(store, s);
		}
		s.set(key, entry);
	}
}

/** Singleton instance shared across the app. */
export const dataCache = new DataCache();
