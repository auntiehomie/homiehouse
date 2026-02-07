/**
 * Rate limiting utility using a simple in-memory store
 * For production with multiple instances, use Upstash Redis:
 * - npm install @upstash/ratelimit @upstash/redis
 * - Replace this with: https://upstash.com/docs/redis/features/ratelimiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Simple rate limiter (sliding window, 1-hour window)
 * For distributed/production use, integrate Upstash Redis instead
 * 
 * @param key - Unique identifier (e.g., IP address, user ID)
 * @param limit - Max requests allowed
 * @param window - Time window in seconds (default: 3600 = 1 hour)
 * @returns { success: boolean, remaining: number }
 */
export function rateLimit(
  key: string,
  limit: number = 10,
  window: number = 3600
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  // Clean up old entries
  if (entry && now > entry.resetAt) {
    store.delete(key);
    return { success: true, remaining: limit - 1 };
  }

  // Initialize or increment
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + window * 1000 });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count < limit) {
    entry.count++;
    return { success: true, remaining: limit - entry.count };
  }

  return { success: false, remaining: 0 };
}

/**
 * Reset rate limit for a key (e.g., after successful payment or verification)
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Get current rate limit status (for debugging)
 */
export function getRateLimitStatus(key: string): RateLimitEntry | null {
  return store.get(key) || null;
}
