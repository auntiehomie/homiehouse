/**
 * Hypersnap — Farcaster read/write client replacing the Pinata Farcaster API.
 *
 * Read endpoints are unauthenticated GETs to /v2/farcaster/*.
 * Write endpoints (publishCast, publishReaction, deleteReaction) require the
 * Privy embedded signer + @standard-crypto/farcaster-js HubRestAPIClient.
 * Those stubs throw descriptive errors pointing to the proper implementation path.
 *
 * Base URL: process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com'
 */

const HYPERSNAP_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_HYPERSNAP_URL) ||
  'https://haatz.quilibrium.com';

// ─── Generic fetch ──────────────────────────────────────────────────────────

/**
 * Generic unauthenticated fetch to Hypersnap.
 * No auth needed for read endpoints.
 */
export async function hypersnapFetch(endpoint: string, opts: RequestInit = {}): Promise<any> {
  const url = `${HYPERSNAP_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...opts,
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
}

/** Backward-compat alias — callers that imported neynarFetch still work. */
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
 */
export async function fetchFeed(params: Record<string, any> = {}): Promise<any> {
  const feedType = params.feed_type || 'following';
  const isTrending =
    feedType === 'filter' && params.filter_type === 'global_trending';

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }

  const endpoint = isTrending
    ? `/v2/farcaster/feed/trending?${qs.toString()}`
    : feedType === 'filter'
    ? `/v2/farcaster/feed?${qs.toString()}`
    : `/v2/farcaster/feed/following?${qs.toString()}`;

  return hypersnapFetch(endpoint);
}

/**
 * Fetch the global trending feed.
 * GET /v2/farcaster/feed/trending
 */
export async function fetchTrendingFeed(params: Record<string, any> = {}): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  return hypersnapFetch(`/v2/farcaster/feed/trending?${qs.toString()}`);
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
 * Fetch the Neynar mini apps / frame catalog.
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

  // Primary: standard Neynar filter feed for a channel
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
  return hypersnapFetch(`/v2/farcaster/user/channels?${qs.toString()}`);
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
export async function fetchCastReplies(hash: string, limit = 50): Promise<any> {
  const qs = new URLSearchParams({
    feed_type: 'filter',
    filter_type: 'parent_hash',
    parent_hash: hash,
    limit: String(limit),
  });
  try {
    return await hypersnapFetch(`/v2/farcaster/feed?${qs.toString()}`);
  } catch {
    // Self-hosted nodes often don't support parent_hash filtering
    return { casts: [] };
  }
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
  return hypersnapFetch(`/v2/farcaster/notifications?${qs.toString()}`);
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
 * Tries the Hypersnap proxy first; if that returns empty and NEYNAR_API_KEY is
 * set (server-side only), falls back to the Neynar API directly.
 * Returns { casts: [...] }.
 */
export async function searchCasts(query: string, limit = 10): Promise<any> {
  const normalize = (data: any) => {
    if (data?.result?.casts && !data?.casts) {
      return { casts: data.result.casts, next: data.result.next ?? {} };
    }
    return data;
  };

  // 1. Try Hypersnap proxy
  try {
    const qs = new URLSearchParams({ q: query, limit: String(limit) });
    const data = normalize(await hypersnapFetch(`/v2/farcaster/cast/search?${qs.toString()}`));
    if (Array.isArray(data?.casts) && data.casts.length > 0) return data;
  } catch {}

  // 2. Fallback: Neynar API directly (server-side only)
  const neynarKey = typeof process !== 'undefined' ? process.env.NEYNAR_API_KEY : undefined;
  if (neynarKey) {
    try {
      const qs = new URLSearchParams({ q: query, limit: String(limit) });
      const res = await fetch(`https://api.neynar.com/v2/farcaster/cast/search?${qs.toString()}`, {
        headers: { accept: 'application/json', api_key: neynarKey },
      });
      if (res.ok) {
        const data = await res.json();
        return normalize(data);
      }
    } catch {}
  }

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
// a Hub. The old signer_uuid pattern was Neynar-specific.
// To implement writes, use the Privy embedded signer to obtain an Ed25519
// keypair, then sign casts/reactions with @standard-crypto/farcaster-js
// HubRestAPIClient (see src/lib/farcaster-writes.ts).

/**
 * @deprecated Use the Privy embedded signer + @standard-crypto/farcaster-js
 * HubRestAPIClient to submit casts. See src/lib/farcaster-writes.ts.
 */
export async function publishCast(_payload: any): Promise<any> {
  throw new Error(
    'publishCast: Use the Privy embedded signer + @standard-crypto/farcaster-js HubRestAPIClient to submit casts. See src/lib/farcaster-writes.ts'
  );
}

/**
 * @deprecated Use the Privy embedded signer + @standard-crypto/farcaster-js
 * HubRestAPIClient. See src/lib/farcaster-writes.ts.
 */
export async function publishReaction(_payload: any): Promise<any> {
  throw new Error(
    'publishReaction: Use the Privy embedded signer + @standard-crypto/farcaster-js HubRestAPIClient. See src/lib/farcaster-writes.ts'
  );
}

/**
 * @deprecated Use the Privy embedded signer + @standard-crypto/farcaster-js
 * HubRestAPIClient. See src/lib/farcaster-writes.ts.
 */
export async function deleteReaction(_payload: any): Promise<any> {
  throw new Error(
    'deleteReaction: Use the Privy embedded signer + @standard-crypto/farcaster-js HubRestAPIClient. See src/lib/farcaster-writes.ts'
  );
}
