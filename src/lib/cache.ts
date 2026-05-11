/**
 * Simple in-memory cache with TTL.
 * On Vercel serverless, each function invocation may or may not share memory,
 * but within a single warm instance, this drastically reduces API calls.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number;

  constructor(maxEntries: number = 500) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    // Evict old entries if at capacity
    if (this.store.size >= this.maxEntries) {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (now > v.expiresAt) this.store.delete(k);
      }
      // If still full, delete oldest 25%
      if (this.store.size >= this.maxEntries) {
        const keys = Array.from(this.store.keys());
        const toDelete = Math.floor(keys.length * 0.25);
        for (let i = 0; i < toDelete; i++) {
          this.store.delete(keys[i]);
        }
      }
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// Singleton instances — sized by expected data volume
// History cache is smaller because each entry is a large array (~252 daily bars)
export const quoteCache = new MemoryCache(300);          // For stock quotes (small objects)
export const historyCache = new MemoryCache(200);        // For historical data (large arrays)
export const searchCache = new MemoryCache(100);         // For search results
export const fundamentalsCache = new MemoryCache(200);   // For fundamental data (screener)
export const screenerResultCache = new MemoryCache(100); // For final screener results

// TTL constants (in seconds)
export const CACHE_TTL = {
  QUOTE: 5 * 60,               // 5 minutes
  HISTORICAL: 60 * 60,         // 1 hour
  SEARCH: 10 * 60,             // 10 minutes
  FUNDAMENTALS: 30 * 60,       // 30 minutes
  SCREENER_RESULT: 15 * 60,    // 15 minutes
};