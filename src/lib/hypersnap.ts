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
export async function fallbackFetch(endpoint: string, opts: RequestInit = {}): Promise<any> {
  if (!HYPERSNAP_FALLBACK) return null;
  const url = `${HYPERSNAP_FALLBACK}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      ...opts,
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

// Legacy fetch alias removed — use hypersnapFetch directly

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

  // Global/trending routes through Hypersnap's native feed first. This avoids
  // making the global feed depend on OpenRank's availability or a fan-out of
  // per-cast hydration requests.
  if (isTrending) {
    return fetchTrendingFeed(params);
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
    const data = await hypersnapFetch(endpoint, { cache: 'no-store' });
    if (Array.isArray(data?.casts)) return data;
  } catch (_) {}

  // 2. Fallback hub (HYPERSNAP_FALLBACK_URL)
  const fallback = await fallbackFetch(endpoint, { cache: 'no-store' });
  if (Array.isArray(fallback?.casts)) return fallback;

  throw new Error('Feed unavailable on both nodes');
}

/** Native discovery feeds preserve node ordering and pagination. No external
 * reputation/ranking service is allowed to remove casts from these results.
 */
export async function fetchTrendingFeed(params: Record<string, any> = {}): Promise<any> {
  const limit = Math.max(1, Math.min(Number(params.limit) || 25, 50));
  if (params.channel_id) {
    return fetchChannelFeed(params.channel_id, { limit, cursor: params.cursor, viewerFid: params.viewer_fid });
  }
  const qs = new URLSearchParams({ limit: String(limit) });
  if (params.cursor) qs.set('cursor', String(params.cursor));
  const endpoint = `/v2/farcaster/feed/trending?${qs}`;
  try {
    const data = await hypersnapFetch(endpoint, { cache: 'no-store' });
    if (Array.isArray(data?.casts)) return data;
  } catch {}
  const fallback = await fallbackFetch(endpoint, { cache: 'no-store' });
  if (Array.isArray(fallback?.casts)) return fallback;
  throw new Error('Trending feed unavailable on both nodes');
}

/**
 * Fetch a Farcaster user by username.
 * GET /v2/farcaster/user/by-username?username=:username
 * Normalises the response to { user: { fid, username, display_name, pfp_url, profile, ... } }.
 */
export async function fetchUserByUsername(username: string): Promise<any> {
  const endpoint = `/v2/farcaster/user/by-username?username=${encodeURIComponent(username)}`;
  const normalize = (data: any) => {
    const user = data?.user ?? data?.result?.user ?? data?.result ?? data?.data?.user ?? data?.data ?? data;
    return user?.fid || user?.id ? { ...data, user } : null;
  };
  let primaryError: unknown;
  try {
    const result = normalize(await hypersnapFetch(endpoint));
    if (result) return result;
  } catch (error) {
    primaryError = error;
  }
  const fallback = normalize(await fallbackFetch(endpoint));
  if (fallback) return fallback;
  if (primaryError) throw primaryError;
  return { user: null };
}

/** Fetch and normalize a user by FID from Hypersnap. */
export async function fetchUserByFid(fid: number): Promise<any> {
  if (!Number.isSafeInteger(fid) || fid <= 0) throw new Error('A valid FID is required');
  const endpoint = `/v2/farcaster/user/bulk?fids=${fid}`;
  const normalize = (data: any) => {
    const user = data?.users?.[0] ?? data?.result?.users?.[0] ?? data?.user ?? data?.result?.user ?? (data?.result?.fid ? data.result : undefined);
    return user?.fid || user?.id ? { ...data, user } : null;
  };
  let primaryError: unknown;
  try {
    const result = normalize(await hypersnapFetch(endpoint));
    if (result) return result;
  } catch (error) {
    primaryError = error;
  }
  const fallback = normalize(await fallbackFetch(endpoint));
  if (fallback) return fallback;
  if (primaryError) throw primaryError;
  return { user: null };
}

/** Fetch channel casts using Hypersnap's supported channel endpoint. */
export async function fetchChannelFeed(channelId: string, params: {
  limit?: number;
  cursor?: string;
  viewerFid?: number;
} = {}): Promise<any> {
  const { limit = 25, cursor, viewerFid } = params;
  const qs = new URLSearchParams({ channel_ids: channelId, limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  if (viewerFid) qs.set('viewer_fid', String(viewerFid));
  const endpoint = `/v2/farcaster/feed/channels?${qs}`;
  try {
    const data = await hypersnapFetch(endpoint);
    if (Array.isArray(data?.casts)) return data;
  } catch {}
  const fallback = await fallbackFetch(endpoint);
  if (Array.isArray(fallback?.casts)) return fallback;
  throw new Error('Channel feed unavailable on both nodes');
}

export async function fetchUserChannels(fid: number, limit = 50): Promise<any> {
  const qs = new URLSearchParams({ fid: String(fid), limit: String(limit) });
  const endpoint = `/v2/farcaster/user/channels?${qs.toString()}`;

  // 1. Primary hub
  try {
    const data = await hypersnapFetch(endpoint);
    const channels = data?.channels ?? data?.result?.channels ?? data?.data?.channels;
    if (Array.isArray(channels) && channels.length > 0) return { ...data, channels };
  } catch {}

  // 2. Fallback hub (HYPERSNAP_FALLBACK_URL)
  const fallback = await fallbackFetch(endpoint);
  const channels = fallback?.channels ?? fallback?.result?.channels ?? fallback?.data?.channels;
  if (Array.isArray(channels) && channels.length > 0) return { ...fallback, channels };

  return { channels: [] };
}

/**
 * Fetch the full channel list.
 * GET /v2/farcaster/channel/list?limit=:limit
 */
export async function fetchChannelList(limit = 50): Promise<any> {
  const data = await hypersnapFetch(`/v2/farcaster/channel/list?limit=${limit}`);
  const channels = data?.channels ?? data?.result?.channels ?? data?.data?.channels;
  return { ...data, channels: Array.isArray(channels) ? channels : [] };
}

/**
 * Fetch a single cast by hash.
 * GET /v2/farcaster/cast?identifier=:hash&type=hash
 */
export function normalizeCastResponse(data: any): any {
  // Hypersnap versions and proxy layers have returned each of these shapes.
  // Keep downstream callers on one stable `{ cast }` contract.
  const cast = data?.cast ?? data?.result?.cast ?? data?.data?.cast ?? data?.result?.data?.cast;
  return cast ? { ...data, cast } : data;
}

export async function fetchCast(hash: string): Promise<any> {
  const endpoint = `/v2/farcaster/cast?identifier=${encodeURIComponent(hash)}&type=hash`;
  let primaryError: unknown;
  try {
    const data = normalizeCastResponse(await hypersnapFetch(endpoint));
    if (data?.cast) return data;
  } catch (error) {
    primaryError = error;
  }

  const fallback = normalizeCastResponse(await fallbackFetch(endpoint));
  if (fallback?.cast) return fallback;
  if (primaryError) throw primaryError;
  return fallback;
}

/** Native author feed uses a real hub page token; the multi-FID filter does not. */
export async function fetchUserCastsPage(fid: number, limit = 50, cursor?: string): Promise<any> {
  const qs = new URLSearchParams({ fid: String(fid), limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  const endpoint = `/v2/farcaster/feed/user/casts?${qs}`;
  try {
    const data = await hypersnapFetch(endpoint);
    if (Array.isArray(data?.casts)) return data;
  } catch {}
  const fallback = await fallbackFetch(endpoint);
  if (Array.isArray(fallback?.casts)) return fallback;
  throw new Error(`Author feed unavailable for fid=${fid}`);
}

export async function fetchCastsByFid(fid: number, limit = 50): Promise<any[]> {
  return (await fetchUserCastsPage(fid, limit)).casts;
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
  const endpoint = `/v2/farcaster/cast/conversation?${qs}`;
  try {
    const data = await hypersnapFetch(endpoint, { cache: 'no-store' });
    if (data?.conversation?.cast) return data;
  } catch {}
  const fallback = await fallbackFetch(endpoint, { cache: 'no-store' });
  if (fallback?.conversation?.cast) return fallback;
  throw new Error('Conversation unavailable on both nodes');
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
export async function searchCasts(query: string, limit = 10, cursor?: string): Promise<any> {
  const normalize = (data: any) => {
    if (data?.result?.casts && !data?.casts) {
      return { casts: data.result.casts, next: data.result.next ?? {} };
    }
    return data;
  };

  const qs = new URLSearchParams({ q: query, limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
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
 * GET /v2/farcaster/feed/user/casts?fid=:fid&limit=:limit
 */
export async function getCastsByUsername(username: string, limit = 25): Promise<any> {
  const userData = await fetchUserByUsername(username);
  const fid = userData?.user?.fid;
  if (!fid) return { casts: [] };
  return fetchUserCastsPage(Number(fid), limit);
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
