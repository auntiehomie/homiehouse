/**
 * Hypersnap — Farcaster read/write client replacing the Pinata Farcaster API.
 *
 * Read endpoints are unauthenticated GETs to /v2/farcaster/*.
 * Write operations use the app-managed Ed25519 signer keypair (see
 * src/lib/farcaster-writes.ts). The stubs below throw descriptive errors
 * pointing to the proper implementation path.
 *
 * Primary node:  NEXT_PUBLIC_HYPERSNAP_URL  (default: Hypersnap Public — haatz.quilibrium.com)
 * Fallback node: HYPERSNAP_FALLBACK_URL     (default: self-hosted proxy on droplet)
 */

const HYPERSNAP_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_HYPERSNAP_URL) ||
  'https://haatz.quilibrium.com';

/** Ardea/Arca — second Hypersnap node, same API surface. Used when primary is slow/unavailable. */
const HYPERSNAP_FALLBACK =
  (typeof process !== 'undefined' && process.env.HYPERSNAP_FALLBACK_URL) ||
  'http://161.35.52.192:3100';

// ─── Generic fetch ──────────────────────────────────────────────────────────

/**
 * Generic unauthenticated fetch to Hypersnap.
 * No auth needed for read endpoints.
 * timeoutMs: abort if no response within this many ms (default 6 s).
 */
export async function hypersnapFetch(endpoint: string, opts: RequestInit = {}, timeoutMs = 6000): Promise<any> {
  const url = `${HYPERSNAP_BASE}${endpoint}`;
  const isWrite = opts.method && opts.method !== 'GET' && opts.method !== 'HEAD';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      // On the server, tell Next.js to revalidate this response every 30 s.
      // Skip if the caller explicitly set cache (e.g. 'no-store' for live data).
      // Client-side the `next` key is silently ignored by the browser fetch.
      ...(!isWrite && !opts.cache && { next: { revalidate: 30 } }),
      headers: {
        accept: 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Hypersnap API error ${res.status} at ${endpoint}: ${text}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the same endpoint from the fallback hub.
 * Only called when the primary Hypersnap node times out or returns empty.
 * Returns null if no fallback is configured or if the fallback also fails.
 */
async function fallbackFetch(endpoint: string): Promise<any> {
  if (!HYPERSNAP_FALLBACK) return null;
  const url = `${HYPERSNAP_FALLBACK}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch notifications with a node fallback. Notifications drive the autonomous
 * mention agent, so a transient primary-node failure must not look like an
 * empty inbox.
 */
async function fallbackNotifications(endpoint: string): Promise<any> {
  if (!HYPERSNAP_FALLBACK) return null;
  const url = `${HYPERSNAP_FALLBACK}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// neynarFetch alias removed — use hypersnapFetch directly

// ─── Read endpoints ──────────────────────────────────────────────────────────

/**
 * Fetch users that a FID is following.
 * GET /v2/farcaster/user/following?fid=:fid&limit=:limit
 * Maps Hypersnap's `result` array to `users` for API compatibility.
 */
export async function fetchFollowing(fid: number, limit = 100): Promise<any> {
  const qs = new URLSearchParams({ fid: String(fid), limit: String(limit) });
  const data = await hypersnapFetch(`/v2/farcaster/user/following?${qs.toString()}`);
  // Normalise: some Hypersnap builds return { result: [...] }, others { users: [...] }
  if (data?.result && !data?.users) {
    return { ...data, users: data.result };
  }
  return data;
}

/**
 * Fetch a feed (following / trending).
 * feed_type=following       → GET /v2/farcaster/feed/following?fid=:fid&limit=:limit
 * feed_type=filter/global_trending → GET /v2/farcaster/feed/trending?limit=:limit
 * default                   → GET /v2/farcaster/feed/following?fid=:fid&limit=:limit
 *
 * Falls back to HYPERSNAP_FALLBACK_URL if the primary node times out or returns empty.
 */
export async function fetchFeed(params: Record<string, any> = {}): Promise<any> {
  const feedType = params.feed_type || 'following';
  const isTrending =
    feedType === 'filter' && params.filter_type === 'global_trending';

  // Global/trending routes through the resilient trending path (OpenRank ranking
  // + Hypersnap hydration, with a node fallback). The node's own /feed/trending
  // endpoint is dead, so hitting it here just returned empty.
  if (isTrending) {
    return fetchTrendingFeed({ limit: params.limit, viewer_fid: params.viewer_fid });
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }

  const endpoint = feedType === 'filter'
    ? `/v2/farcaster/feed?${qs.toString()}`
    : `/v2/farcaster/feed/following?${qs.toString()}`;

  // 1. Primary Hypersnap node
  try {
    const data = await hypersnapFetch(endpoint);
    if (Array.isArray(data?.casts) && data.casts.length > 0) return data;
  } catch (_) {}

  // 2. Fallback hub (HYPERSNAP_FALLBACK_URL)
  const fallback = await fallbackFetch(endpoint);
  if (Array.isArray(fallback?.casts) && fallback.casts.length > 0) return fallback;

  return { casts: [] };
}

/** OpenRank (Karma3Labs) cast graph — free, unauthenticated global + per-channel trending ranking. */
const OPENRANK_CAST_BASE = 'https://graph.cast.k3l.io';

/**
 * Fetch trending cast hashes, ranked, from OpenRank — globally, or scoped to
 * one channel when `channelId` is given.
 *
 * Global: GET /casts/global/trending?limit=:limit → { result: [{ cast_hash, cast_hour }] }
 * Channel: GET /channels/casts/popular/:channel?agg=sumsquare&weights=L1C10R5Y1&limit=:limit
 *          → same { result: [{ cast_hash, ... }] } shape.
 * (agg/weights are OpenRank's documented defaults for this endpoint — sumsquare
 * aggregation weighted toward recasts > replies > likes.)
 *
 * Neither OpenRank endpoint supports a time-window parameter — trending is
 * always "right now" per OpenRank's own rolling computation, hourly for
 * global and per its own cadence for channels. There is no way to ask for
 * e.g. "trending this week" from this data source.
 *
 * Returns [] on any failure so trending degrades gracefully.
 */
async function fetchTrendingCastHashes(limit: number, channelId?: string): Promise<string[]> {
  const url = channelId
    ? `${OPENRANK_CAST_BASE}/channels/casts/popular/${encodeURIComponent(channelId)}?agg=sumsquare&weights=L1C10R5Y1&limit=${limit}&offset=0`
    : `${OPENRANK_CAST_BASE}/casts/global/trending?limit=${limit}&offset=0`;
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
      // OpenRank recomputes hourly — cache for 5 min on the server.
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows: any[] = Array.isArray(data?.result) ? data.result : [];
    return rows.map((r) => r?.cast_hash).filter((h): h is string => typeof h === 'string' && h.length > 0);
  } catch {
    return [];
  }
}

/**
 * Hydrate ranked cast hashes into full cast objects via Hypersnap.
 * Runs in parallel, preserves the input (rank) order, and drops any hash
 * that fails to resolve.
 */
async function hydrateCastsByHash(hashes: string[]): Promise<any[]> {
  const results = await Promise.all(
    hashes.map(async (hash) => {
      try {
        const data = await fetchCast(hash);
        return data?.cast ?? null;
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

/**
 * High-signal Farcaster accounts used as a trending proxy when OpenRank is
 * unreachable. Their following feeds are a firehose of active, prominent casts.
 */
const TRENDING_SEED_FIDS = [3, 99, 194, 2];

/**
 * Node-only trending fallback for when OpenRank is down (e.g. its TLS cert
 * expires) and the node has no working /feed/trending. Aggregates recent casts
 * from a few high-signal following feeds, deduped and sorted newest-first.
 *
 * Not true engagement ranking — the node doesn't return reaction counts — but it
 * keeps the tab populated with active content instead of showing nothing.
 */
async function fetchTrendingFallbackFromNode(limit: number): Promise<any[]> {
  const perSeed = Math.max(10, Math.ceil(limit / 2));
  const batches = await Promise.all(
    TRENDING_SEED_FIDS.map(async (fid) => {
      try {
        const data = await hypersnapFetch(
          `/v2/farcaster/feed/following?fid=${fid}&limit=${perSeed}`,
          {},
          6000
        );
        return Array.isArray(data?.casts) ? data.casts : [];
      } catch {
        return [];
      }
    })
  );

  const byHash = new Map<string, any>();
  const parseTs = (c: any) => { const t = Date.parse(c?.timestamp); return isNaN(t) ? 0 : t; };
  for (const cast of batches.flat()) {
    if (cast?.hash && !byHash.has(cast.hash)) byHash.set(cast.hash, cast);
  }
  // Prefer top-level casts; fall back to including replies if that's too thin.
  const all = [...byHash.values()];
  const topLevel = all.filter((c) => !c.parent_hash);
  const pool = topLevel.length >= limit ? topLevel : all;
  return pool.sort((a, b) => parseTs(b) - parseTs(a)).slice(0, limit);
}

/**
 * Fetch the trending feed — globally, or scoped to one channel when
 * `params.channel_id` is set (Farcaster's channels are its closest thing to
 * "topics", so this is how you get "what's trending in this topic" rather
 * than just a single undifferentiated global list).
 *
 * The Hypersnap node's own /feed/trending endpoint is unavailable (it times
 * out — trending computation isn't served by the self-hosted node) and never
 * supported channel scoping anyway, so we rank via OpenRank (globally or via
 * its per-channel endpoint) and hydrate the resulting hashes through
 * Hypersnap. If OpenRank is unreachable too, fall back to recent casts —
 * from the channel itself when one was requested, otherwise from a few
 * high-signal accounts — so the feed is never empty.
 *
 * `time_window`/`viewer_fid` in `params` are accepted for API compatibility
 * but currently do nothing: neither OpenRank endpoint nor the Hypersnap node
 * support time-windowed or personalized trending.
 */
export async function fetchTrendingFeed(params: Record<string, any> = {}): Promise<any> {
  const limit = Math.max(1, Math.min(Number(params.limit) || 25, 50));
  const channelId: string | undefined = params.channel_id || undefined;

  // 1. Rank via OpenRank (global or channel-scoped), then hydrate through Hypersnap.
  // Over-fetch hashes so hydration failures don't shrink the list below `limit`.
  const hashes = await fetchTrendingCastHashes(Math.min(limit * 2, 50), channelId);
  if (hashes.length > 0) {
    const casts = await hydrateCastsByHash(hashes);
    if (casts.length > 0) return { casts: casts.slice(0, limit) };
  }

  // 2. Try the node's native trending endpoint (in case it comes back).
  // Channel scoping was never supported here, so only try this path globally.
  if (!channelId) {
    try {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
      const data = await hypersnapFetch(`/v2/farcaster/feed/trending?${qs.toString()}`, {}, 6000);
      if (Array.isArray(data?.casts) && data.casts.length > 0) return data;
    } catch {}
  }

  // 3. OpenRank (+ node trending, if applicable) unavailable → recent casts.
  // Channel-scoped: pull straight from the channel's own feed instead of the
  // channel-agnostic high-signal-account fallback below.
  if (channelId) {
    try {
      const data = await fetchChannelFeed(channelId, { limit });
      const casts: any[] = data?.casts ?? [];
      if (casts.length > 0) return { casts: casts.slice(0, limit) };
    } catch {}
    return { casts: [] };
  }

  const fallbackCasts = await fetchTrendingFallbackFromNode(limit);
  return { casts: fallbackCasts };
}

/**
 * Fetch a Farcaster user by username.
 * GET /v2/farcaster/user/by-username?username=:username
 * Normalises the response to { user: { fid, username, display_name, pfp_url, profile, ... } }.
 */
export async function fetchUserByUsername(username: string): Promise<any> {
  const data = await hypersnapFetch(
    `/v2/farcaster/user/by-username?username=${encodeURIComponent(username)}`
  );
  // Various shapes: { user }, { result: { ... } }, { data: { user } }
  const user =
    data?.user ??
    data?.result ??
    data?.data?.user ??
    data?.data ??
    data;
  return { user };
}

/**
 * Fetch the mini apps / frame catalog.
 * GET /v2/farcaster/frame/catalog
 */
export async function fetchMiniAppCatalog(params: {
  limit?: number;
  cursor?: string;
  timeWindow?: '1h' | '6h' | '12h' | '24h' | '7d';
  categories?: string[];
}): Promise<any> {
  const { limit = 50, cursor, timeWindow = '7d', categories } = params;
  const qs = new URLSearchParams({ limit: String(limit), time_window: timeWindow });
  if (cursor) qs.set('cursor', cursor);
  if (categories?.length) categories.forEach(c => qs.append('categories', c));
  return hypersnapFetch(`/v2/farcaster/frame/catalog?${qs.toString()}`);
}
/**
 * Fetch a channel feed.
 * Tries /v2/farcaster/feed?feed_type=filter&filter_type=channel_id first,
 * then falls back to /v2/farcaster/feed/channels?channel_ids=:id.
 */
export async function fetchChannelFeed(channelId: string, params: {
  limit?: number;
  cursor?: string;
  viewerFid?: number;
} = {}): Promise<any> {
  const { limit = 25, cursor, viewerFid } = params;
  const base = new URLSearchParams({ limit: String(limit) });
  if (cursor) base.set('cursor', cursor);
  if (viewerFid) base.set('viewer_fid', String(viewerFid));

  // Primary: standard filter feed for a channel
  try {
    const qs = new URLSearchParams(base);
    qs.set('feed_type', 'filter');
    qs.set('filter_type', 'channel_id');
    qs.set('channel_id', channelId);
    const data = await hypersnapFetch(`/v2/farcaster/feed?${qs.toString()}`);
    if (data?.casts?.length) return data;
  } catch (_) {}

  // Fallback: multi-channel feed endpoint
  const qs2 = new URLSearchParams(base);
  qs2.set('channel_ids', channelId);
  try {
    return await hypersnapFetch(`/v2/farcaster/feed/channels?${qs2.toString()}`);
  } catch (_) {
    return { casts: [], next: null };
  }
}

export async function fetchUserChannels(fid: number, limit = 50): Promise<any> {
  const qs = new URLSearchParams({ fid: String(fid), limit: String(limit) });
  const endpoint = `/v2/farcaster/user/channels?${qs.toString()}`;

  // 1. Primary hub
  try {
    const data = await hypersnapFetch(endpoint);
    if (Array.isArray(data?.channels) && data.channels.length > 0) return data;
  } catch {}

  // 2. Fallback hub (HYPERSNAP_FALLBACK_URL)
  const fallback = await fallbackFetch(endpoint);
  if (Array.isArray(fallback?.channels) && fallback.channels.length > 0) return fallback;

  return { channels: [] };
}

/**
 * Fetch the full channel list.
 * GET /v2/farcaster/channel/list?limit=:limit
 */
export async function fetchChannelList(limit = 50): Promise<any> {
  return hypersnapFetch(`/v2/farcaster/channel/list?limit=${limit}`);
}

/**
 * Fetch a single cast by hash.
 * GET /v2/farcaster/cast?identifier=:hash&type=hash
 */
export async function fetchCast(hash: string): Promise<any> {
  return hypersnapFetch(
    `/v2/farcaster/cast?identifier=${encodeURIComponent(hash)}&type=hash`
  );
}

/**
 * Fetch direct replies to a cast.
 * GET /v2/farcaster/feed?feed_type=filter&filter_type=parent_hash&parent_hash=:hash
 */
/**
 * Fetch recent casts by a specific FID.
 * GET /v2/farcaster/feed?feed_type=filter&fids=:fid&limit=:limit
 *
 * This is the correct way to query casts by author on Hypersnap nodes —
 * the `parent_hash` filter_type is NOT supported, but `fids` is required.
 * The response includes `parent_hash` for reply casts (type === 'cast-reply').
 */
export async function fetchCastsByFid(fid: number, limit = 50): Promise<any[]> {
  const qs = new URLSearchParams({
    feed_type: 'filter',
    fids: String(fid),
    limit: String(limit),
  });
  const endpoint = `/v2/farcaster/feed?${qs.toString()}`;

  try {
    const data = await hypersnapFetch(endpoint);
    return data?.casts ?? [];
  } catch {
    // Try fallback node
    const fallback = await fallbackFetch(endpoint);
    if (fallback !== null) return fallback?.casts ?? [];
    throw new Error(`fetchCastsByFid: both nodes failed for fid=${fid}`);
  }
}

/**
 * Check if a bot (by FID) has already replied to a specific cast.
 * Fetches the bot's recent casts and checks for parent_hash matches.
 *
 * Returns true if the bot has a cast with parent_hash === castHash.
 * Throws on API error so callers can fail-closed.
 */
export async function hasBotRepliedToCast(botFid: number, castHash: string): Promise<boolean> {
  const casts = await fetchCastsByFid(botFid, 50);
  return casts.some(
    (c: any) =>
      c.parent_hash === castHash ||
      c.parent_url === castHash
  );
}

/**
 * Fetch a cast conversation (cast + direct replies).
 * GET /v2/farcaster/cast/conversation?identifier=:hash&type=hash&reply_depth=2
 * Returns { conversation: { cast: { ...cast, direct_replies: [...] } } }
 */
export async function fetchCastConversation(hash: string): Promise<any> {
  const qs = new URLSearchParams({
    identifier: hash,
    type: 'hash',
    reply_depth: '2',
    include_chronological_parent_casts: 'false',
  });
  return hypersnapFetch(`/v2/farcaster/cast/conversation?${qs.toString()}`);
}

/**
 * Fetch notifications for a FID.
 * GET /v2/farcaster/notifications?fid=:fid&limit=:limit[&cursor=:cursor]
 */
export async function fetchNotifications(params: {
  fid: number;
  limit?: number;
  cursor?: string;
}): Promise<any> {
  const { fid, limit = 25, cursor } = params;
  const qs = new URLSearchParams({ fid: String(fid), limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  // Always fetch fresh — cron jobs need live notification data, not cached.
  const endpoint = `/v2/farcaster/notifications?${qs.toString()}`;
  const timings: Record<string, number> = {};

  // 1. Primary hub
  const primaryStart = Date.now();
  try {
    const data = await hypersnapFetch(endpoint, { cache: 'no-store' }, 8_000);
    timings.primary = Date.now() - primaryStart;
    if (data?.notifications || data?.data?.notifications) {
      return { ...data, _timings: timings, _source: 'primary' };
    }
  } catch (err: any) {
    timings.primary = Date.now() - primaryStart;
    timings.primaryError = err?.message || 'unknown';
  }

  // 2. Fallback hub (Ardea/Arca)
  const fallbackStart = Date.now();
  try {
    const fallback = await fallbackFetch(endpoint);
    timings.fallback = Date.now() - fallbackStart;
    if (fallback?.notifications || fallback?.data?.notifications) {
      return { ...fallback, _timings: timings, _source: 'fallback' };
    }
  } catch (err: any) {
    timings.fallback = Date.now() - fallbackStart;
    timings.fallbackError = err?.message || 'unknown';
  }

  return { notifications: [], next: {}, _timings: timings, _source: 'empty' };
}

/**
 * Search for Farcaster users.
 * GET /v2/farcaster/user/search?q=:query&limit=:limit
 * Returns { users: [...] }.
 */
export async function searchUsers(query: string, limit = 10): Promise<any> {
  const qs = new URLSearchParams({ q: query.toLowerCase(), limit: String(limit) });
  const data = await hypersnapFetch(`/v2/farcaster/user/search?${qs.toString()}`);
  // Normalise: { result: [...] } → { users: [...] }
  if (data?.result && !data?.users) {
    return { ...data, users: data.result };
  }
  return data;
}

/**
 * Search for casts.
 * Tries the primary Hypersnap node first; falls back to HYPERSNAP_FALLBACK_URL.
 * Returns { casts: [...] }.
 */
export async function searchCasts(query: string, limit = 10): Promise<any> {
  const normalize = (data: any) => {
    if (data?.result?.casts && !data?.casts) {
      return { casts: data.result.casts, next: data.result.next ?? {} };
    }
    return data;
  };

  const qs = new URLSearchParams({ q: query, limit: String(limit) });
  const endpoint = `/v2/farcaster/cast/search?${qs.toString()}`;

  // 1. Primary hub
  try {
    const data = normalize(await hypersnapFetch(endpoint));
    if (Array.isArray(data?.casts) && data.casts.length > 0) return data;
  } catch {}

  // 2. Fallback hub (HYPERSNAP_FALLBACK_URL)
  const fallback = normalize(await fallbackFetch(endpoint) ?? {});
  if (Array.isArray(fallback?.casts) && fallback.casts.length > 0) return fallback;

  return { casts: [], next: {} };
}

/**
 * Fetch casts by username.
 * Resolves the FID via fetchUserByUsername, then fetches the feed.
 * GET /v2/farcaster/feed/user-casts?fid=:fid&limit=:limit
 */
export async function getCastsByUsername(username: string, limit = 25): Promise<any> {
  const userData = await fetchUserByUsername(username);
  const fid = userData?.user?.fid;
  if (!fid) return { casts: [] };
  const qs = new URLSearchParams({ fid: String(fid), limit: String(limit) });
  return hypersnapFetch(`/v2/farcaster/feed/user-casts?${qs.toString()}`);
}

// ─── Write stubs ─────────────────────────────────────────────────────────────
//
// Farcaster writes require submitting signed MessageData protobuf messages to
// a Hub. The old signer_uuid pattern was deprecated.
// To implement writes, use the app-mnemonic Ed25519 keypair approach
// (see src/lib/farcaster-writes.ts).

/**
 * @deprecated Use the app-mnemonic Ed25519 signer + @standard-crypto/farcaster-js
 * HubRestAPIClient to submit casts. See src/lib/farcaster-writes.ts.
 */
export async function publishCast(_payload: any): Promise<any> {
  throw new Error(
    'publishCast: Use the app-mnemonic Ed25519 signer + @standard-crypto/farcaster-js HubRestAPIClient to submit casts. See src/lib/farcaster-writes.ts'
  );
}

/**
 * @deprecated Use the app-mnemonic Ed25519 signer + @standard-crypto/farcaster-js
 * HubRestAPIClient. See src/lib/farcaster-writes.ts.
 */
export async function publishReaction(_payload: any): Promise<any> {
  throw new Error(
    'publishReaction: Use the app-mnemonic Ed25519 signer + @standard-crypto/farcaster-js HubRestAPIClient. See src/lib/farcaster-writes.ts'
  );
}

/**
 * @deprecated Use the app-mnemonic Ed25519 signer + @standard-crypto/farcaster-js
 * HubRestAPIClient. See src/lib/farcaster-writes.ts.
 */
export async function deleteReaction(_payload: any): Promise<any> {
  throw new Error(
    'deleteReaction: Use the app-mnemonic Ed25519 signer + @standard-crypto/farcaster-js HubRestAPIClient. See src/lib/farcaster-writes.ts'
  );
}
