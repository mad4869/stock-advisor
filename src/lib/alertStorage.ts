import { Redis } from '@upstash/redis';
const kv = Redis.fromEnv();

/**
 * Anti-Spam Storage Helper (`alertStorage.ts`)
 * Stores notified (symbol, date) keys to ensure a stock is only alerted
 * at most ONCE per 24 hours for BUY signals.
 *
 * Uses @upstash/redis (Redis) if KV_REST_API_URL / UPSTASH_REDIS_REST_URL is set.
 * Automatically falls back to an in-memory cache if KV is unconfigured or unavailable.
 */

interface LocalAlertRecord {
  timestamp: number;
  details?: any;
}

// In-memory fallback map (for local dev or fallback)
const localCache = new Map<string, LocalAlertRecord>();
const TTL_SECONDS = 86400; // 24 hours

function getCacheKey(symbol: string): string {
  const cleanSymbol = symbol.toUpperCase().trim();
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `alert:${dateStr}:${cleanSymbol}:BUY`;
}

/**
 * Checks whether a BUY alert for this symbol has already been sent today.
 */
export async function isAlertedToday(symbol: string): Promise<boolean> {
  const key = getCacheKey(symbol);

  // Check in-memory fallback first if KV env vars are not set
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    const cached = localCache.get(key);
    if (!cached) return false;
    if (Date.now() - cached.timestamp > TTL_SECONDS * 1000) {
      localCache.delete(key);
      return false;
    }
    return true;
  }

  try {
    const result = await kv.get(key);
    return result != null;
  } catch (error) {
    console.warn(`[alertStorage] KV error checking ${key}, falling back to memory:`, error);
    const cached = localCache.get(key);
    return cached ? Date.now() - cached.timestamp <= TTL_SECONDS * 1000 : false;
  }
}

/**
 * Marks a BUY alert as sent today for this symbol with a 24-hour expiration.
 */
export async function markAlertedToday(symbol: string, details?: any): Promise<void> {
  const key = getCacheKey(symbol);

  // Update in-memory fallback cache
  localCache.set(key, { timestamp: Date.now(), details });

  if (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) {
    try {
      await kv.set(key, details ?? { timestamp: Date.now(), symbol }, { ex: TTL_SECONDS });
    } catch (error) {
      console.warn(`[alertStorage] KV error setting ${key}:`, error);
    }
  }
}
