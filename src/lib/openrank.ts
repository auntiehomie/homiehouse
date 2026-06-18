/**
 * OpenRank (Karma3Labs) spam filtering utility.
 *
 * Queries the free EigenTrust-based global engagement score API.
 * Score = 0 means the account has never been engaged with by any trusted
 * account in the Farcaster social graph — the clearest spam signal available
 * without a paid third-party service.
 *
 * Scores are cached in Upstash Redis for 2 hours (matching OpenRank's own
 * update cadence) with a per-FID key so cache hits are granular.
 */

const OPENRANK_BASE = 'https://graph.cast.k3l.io';
const CACHE_TTL_S = 7_200; // 2 h — matches OpenRank update frequency
const FETCH_TIMEOUT_MS = 3_000;
const CHUNK_SIZE = 100;

let _redis: any = null;

function getRedis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({ url, token });
  }
  return _redis;
}

function cacheKey(fid: number) {
  return `openrank:v1:${fid}`;
}

async function fetchFromOpenRank(fids: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();

  for (let i = 0; i < fids.length; i += CHUNK_SIZE) {
    const chunk = fids.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch(`${OPENRANK_BASE}/scores/global/engagement/fids`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`OpenRank ${res.status}`);

      const data: { i: string; v: number }[] = await res.json();
      const returnedFids = new Set<number>();

      for (const { i: id, v } of data) {
        const fid = parseInt(id, 10);
        result.set(fid, v);
        returnedFids.add(fid);
      }

      // FIDs absent from response = score 0 (completely unranked)
      for (const fid of chunk) {
        if (!returnedFids.has(fid)) result.set(fid, 0);
      }
    } catch {
      // Fail open: if OpenRank is unreachable, treat as trusted
      for (const fid of chunk) {
        if (!result.has(fid)) result.set(fid, 1.0);
      }
    }
  }

  return result;
}

/**
 * Returns OpenRank global engagement scores for the given FIDs.
 * Cache-first: Redis → OpenRank API.
 * Always fails open (returns 1.0) on any error so spam filtering never
 * breaks the feed.
 */
export async function getOpenRankScores(fids: number[]): Promise<Map<number, number>> {
  const scores = new Map<number, number>();
  if (!fids.length) return scores;

  const unique = [...new Set(fids.filter(Boolean))];
  const redis = getRedis();
  const uncached: number[] = [];

  if (redis) {
    try {
      const keys = unique.map(cacheKey);
      // mget returns null for missing keys
      const cached: (string | null)[] = await redis.mget(...keys);
      for (let i = 0; i < unique.length; i++) {
        const val = cached[i];
        if (val !== null && val !== undefined) {
          scores.set(unique[i], parseFloat(String(val)));
        } else {
          uncached.push(unique[i]);
        }
      }
    } catch {
      uncached.push(...unique);
    }
  } else {
    uncached.push(...unique);
  }

  if (!uncached.length) return scores;

  const fresh = await fetchFromOpenRank(uncached);

  if (redis) {
    try {
      const pipeline = redis.pipeline();
      for (const [fid, score] of fresh) {
        pipeline.set(cacheKey(fid), score, { ex: CACHE_TTL_S });
      }
      await pipeline.exec();
    } catch {
      // Cache write failure is non-fatal
    }
  }

  for (const [fid, score] of fresh) {
    scores.set(fid, score);
  }

  return scores;
}

/**
 * Returns true if an author should be hidden as likely spam.
 *
 * Criteria: OpenRank score = 0 (never engaged by any trusted account)
 * AND fewer than 3 followers (guards against false positives for new but
 * legitimate users who are simply not yet in the trust graph).
 */
export function isSpamAccount(
  fid: number,
  scores: Map<number, number>,
  author?: { follower_count?: number }
): boolean {
  const score = scores.get(fid) ?? 1.0; // default to trusted when unknown
  if (score > 0) return false;

  // score === 0: completely unranked.
  // Keep accounts with 3+ followers to avoid false positives for legit newcomers.
  const followers = author?.follower_count ?? 0;
  return followers < 3;
}
