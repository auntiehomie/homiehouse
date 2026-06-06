/**
 * Rate limiting utility — Upstash Redis-backed for distributed/serverless use.
 *
 * Falls back to in-memory store when UPSTASH_REDIS_REST_URL is not configured
 * (e.g., local development without Redis).
 */

import { AuthError } from './errors';

// ── Upstash Redis (production) ───────────────────────────────────────────────

let _rateLimit: any = null;

function getUpstashRatelimit() {
  if (_rateLimit) return _rateLimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const { Ratelimit } = require('@upstash/ratelimit');
    const { Redis } = require('@upstash/redis');

    const redis = new Redis({ url, token });

    _rateLimit = {
      slidingWindow: (limit: number, window: number) =>
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(limit, `${window}s`),
          analytics: true,
          prefix: 'ratelimit',
        }),
    };
  }

  return _rateLimit;
}

// ── In-memory fallback (development) ─────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

function memoryRatelimit(
  key: string,
  limit: number,
  windowSeconds: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (entry && now > entry.resetAt) {
    memoryStore.delete(key);
    return { success: true, remaining: limit - 1 };
  }

  if (!entry) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count < limit) {
    entry.count++;
    return { success: true, remaining: limit - entry.count };
  }

  return { success: false, remaining: 0 };
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

/**
 * Check rate limit for a given key.
 * Uses Upstash Redis when configured, falls back to in-memory.
 *
 * @param key - Unique identifier (IP, user ID, etc.)
 * @param limit - Max requests allowed in the window
 * @param windowSeconds - Time window in seconds (default: 60)
 */
export async function checkRateLimit(
  key: string,
  limit: number = 30,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const upstash = getUpstashRatelimit();

  if (upstash) {
    const limiter = upstash.slidingWindow(limit, windowSeconds);
    const result = await limiter.limit(key);
    return {
      success: result.success,
      remaining: result.remaining,
    };
  }

  // Fallback to in-memory
  return memoryRatelimit(key, limit, windowSeconds);
}

/**
 * Apply rate limiting to a request, throwing AuthError (429) if exceeded.
 * Uses IP address or a custom key.
 */
export async function enforceRateLimit(params: {
  key: string;
  limit?: number;
  windowSeconds?: number;
  label?: string;
}): Promise<void> {
  const { success, remaining } = await checkRateLimit(
    params.key,
    params.limit ?? 30,
    params.windowSeconds ?? 60
  );

  if (!success) {
    throw new AuthError(
      params.label
        ? `Rate limited: ${params.label}. Try again later.`
        : 'Too many requests. Try again later.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}

/**
 * Extract a rate-limit key from a request (IP-based).
 */
export function rateLimitKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}

// ── Backward compatibility ───────────────────────────────────────────────────

/**
 * @deprecated Use checkRateLimit() or enforceRateLimit() instead.
 * Synchronous in-memory rate limiter kept for existing route compatibility.
 */
export function rateLimit(
  key: string,
  limit: number = 10,
  window: number = 3600
): { success: boolean; remaining: number } {
  return memoryRatelimit(key, limit, window);
}