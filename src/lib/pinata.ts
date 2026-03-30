/**
 * Pinata Farcaster API utilities
 * Drop-in replacement for Neynar API connector.
 *
 * Base URL: https://api.pinata.cloud/v3/farcaster
 * Auth: Authorization: Bearer <PINATA_JWT>
 *
 * NOTE: Some Neynar-specific endpoints (signer management, fungibles, bulk user lookup)
 * have no direct Pinata equivalent. Those fall back to neynar-compat shims that throw
 * descriptive errors — see PINATA_MIGRATION.md for details.
 */

import { FarcasterAPIError } from './errors';

const PINATA_BASE_URL = 'https://api.pinata.cloud/v3/farcaster';

export interface PinataFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/**
 * Wrapper for Pinata Farcaster API calls with automatic error handling.
 * @param endpoint - API endpoint (without base URL), or full URL
 * @param options  - Fetch options
 * @returns Parsed JSON response
 * @throws FarcasterAPIError on API errors
 */
export async function pinataFetch<T = any>(
  endpoint: string,
  options?: PinataFetchOptions
): Promise<T> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt && !options?.skipAuth) {
    throw new FarcasterAPIError('PINATA_JWT not configured', 500, 'MISSING_API_KEY');
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${PINATA_BASE_URL}${endpoint}`;

  const { skipAuth, ...fetchOptions } = options || {};

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      ...(skipAuth ? {} : { 'Authorization': `Bearer ${jwt!}` }),
      ...fetchOptions?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails = errorText;

    try {
      const errorJson = JSON.parse(errorText);
      errorDetails = errorJson.message || errorJson.error || errorText;
    } catch {
      // keep raw error text
    }

    throw new FarcasterAPIError(errorDetails, response.status, 'PINATA_API_ERROR');
  }

  return response.json();
}

// ─── Re-exported as neynarFetch alias for backward compat ────────────────────

/**
 * Alias of pinataFetch — keeps callers that imported neynarFetch working.
 * Internally routes to Pinata.
 */
export const neynarFetch = pinataFetch;

// ─── Cast operations ──────────────────────────────────────────────────────────

/**
 * Post a cast via Pinata API
 * Pinata POST /casts accepts: { signerId, text, embeds, parentCastId, channelId }
 */
export async function publishCast(payload: {
  signer_uuid: string;
  text: string;
  embeds?: any[];
  parent?: string;
  channel_id?: string;
}) {
  return pinataFetch('/casts', {
    method: 'POST',
    body: JSON.stringify({
      signerId: payload.signer_uuid,
      text: payload.text,
      ...(payload.embeds?.length ? { embeds: payload.embeds } : {}),
      ...(payload.parent ? { parentCastId: payload.parent } : {}),
      ...(payload.channel_id ? { channelId: payload.channel_id } : {}),
    }),
  });
}

/**
 * Fetch cast by hash
 * Pinata: GET /casts/<hash>
 */
export async function fetchCast(castHash: string) {
  return pinataFetch(`/casts/${encodeURIComponent(castHash)}`);
}

// ─── Reaction operations ──────────────────────────────────────────────────────

/**
 * Post a reaction (like/recast) via Pinata API
 * Pinata POST /reactions: { signerId, reactionType, target }
 */
export async function publishReaction(payload: {
  signer_uuid: string;
  reaction_type: 'like' | 'recast';
  target: string;
}) {
  return pinataFetch('/reactions', {
    method: 'POST',
    body: JSON.stringify({
      signerId: payload.signer_uuid,
      reactionType: payload.reaction_type,
      target: payload.target,
    }),
  });
}

/**
 * Delete a reaction via Pinata API
 * Pinata DELETE /reactions: { signerId, reactionType, target }
 */
export async function deleteReaction(payload: {
  signer_uuid: string;
  reaction_type: 'like' | 'recast';
  target: string;
}) {
  return pinataFetch('/reactions', {
    method: 'DELETE',
    body: JSON.stringify({
      signerId: payload.signer_uuid,
      reactionType: payload.reaction_type,
      target: payload.target,
    }),
  });
}

// ─── Feed operations ──────────────────────────────────────────────────────────

/**
 * Fetch user/following feed
 * Pinata: GET /feed/following?fid=<fid>
 * Falls back to trending for unknown feed_type values.
 */
export async function fetchFeed(params: {
  feed_type?: string;
  fid?: string;
  channel_id?: string;
  filter_type?: string;
  viewer_fid?: string;
  limit?: number;
  cursor?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.fid) searchParams.set('fid', params.fid);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.cursor) searchParams.set('pageToken', params.cursor);

  // Pinata endpoint selection:
  // feed_type=filter+filter_type=fids → following feed for that fid
  // feed_type=following → following feed
  // anything else      → trending
  const useFollowing =
    params.feed_type === 'following' ||
    (params.feed_type === 'filter' && params.filter_type === 'fids');

  const endpoint = useFollowing
    ? `/feed/following?${searchParams.toString()}`
    : `/feed/trending?${searchParams.toString()}`;

  return pinataFetch(endpoint);
}

/**
 * Fetch trending feed
 * Pinata: GET /feed/trending
 */
export async function fetchTrendingFeed(params: {
  limit?: number;
  time_window?: string;
  viewer_fid?: string;
  channel_id?: string;
  cursor?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.cursor) searchParams.set('pageToken', params.cursor);

  return pinataFetch(`/feed/trending?${searchParams.toString()}`);
}

// ─── User operations ──────────────────────────────────────────────────────────

/**
 * Fetch user profile by username
 * Pinata: GET /users/by_username?username=<u>
 */
export async function fetchUserByUsername(username: string) {
  try {
    return await pinataFetch(
      `/users/by_username?username=${encodeURIComponent(username)}`
    );
  } catch (error) {
    console.error(`Failed to fetch user @${username}:`, error);
    if (error instanceof FarcasterAPIError && error.status === 404) {
      throw new Error(
        `User @${username} not found on Farcaster. Please check the username and try again.`
      );
    }
    throw error;
  }
}

/**
 * Fetch user channels
 * Pinata: GET /channel/list (filtered by member)
 * Note: Pinata doesn't have a per-user channel endpoint; returns all channels.
 */
export async function fetchUserChannels(fid: string, limit: number = 25) {
  return pinataFetch(`/channel/list?limit=${limit}`);
}

/**
 * Fetch channel list
 * Pinata: GET /channel/list
 */
export async function fetchChannelList(limit: number = 25) {
  return pinataFetch(`/channel/list?limit=${limit}`);
}

/**
 * Fetch user following
 * Pinata: GET /feed/following?fid=<fid>
 */
export async function fetchFollowing(fid: string, limit: number = 100) {
  return pinataFetch(`/feed/following?fid=${fid}&limit=${limit}`);
}

/**
 * Fetch notifications for a user
 * Pinata: GET /notifications?fid=<fid>
 */
export async function fetchNotifications(params: {
  fid: string;
  priority_mode?: boolean;
  cursor?: string;
  type?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set('fid', params.fid);
  if (params.cursor) searchParams.set('pageToken', params.cursor);
  if (params.type) searchParams.set('type', params.type);

  return pinataFetch(`/notifications?${searchParams.toString()}`);
}

/**
 * Search users by query
 * Pinata: GET /users/by_username?username=<q> (partial-match where supported)
 * NOTE: Pinata does not have a dedicated search-users endpoint;
 * this performs a username lookup as a best-effort substitute.
 */
export async function searchUsers(query: string, limit: number = 5) {
  return pinataFetch(
    `/users/by_username?username=${encodeURIComponent(query)}&limit=${limit}`
  );
}

/**
 * Search casts by text
 * NOTE: Pinata Farcaster API does not expose a cast search endpoint.
 * Returns an empty result set rather than throwing.
 */
export async function searchCasts(_query: string, _limit: number = 10) {
  console.warn('[pinata] searchCasts: not supported by Pinata API — returning empty result');
  return { casts: [] };
}

/**
 * Get casts authored by a username
 * Resolves username → fid, then fetches via following feed.
 */
export async function getCastsByUsername(username: string, limit: number = 25) {
  try {
    const userData = await fetchUserByUsername(username);

    // Pinata returns the user under a "data" key
    const user = userData?.data ?? userData?.user ?? userData;
    if (!user?.fid) {
      throw new Error(`User @${username} was found but has no FID (Farcaster ID)`);
    }

    console.log(`Fetching ${limit} casts from @${username} (FID: ${user.fid})`);

    const castsData = await pinataFetch(
      `/casts?fid=${user.fid}&limit=${limit}`
    );

    if (!castsData?.casts || castsData.casts.length === 0) {
      console.log(`No casts found for @${username}`);
      return { casts: [] };
    }

    console.log(`Successfully fetched ${castsData.casts.length} casts from @${username}`);
    return castsData;
  } catch (error) {
    console.error(`Error in getCastsByUsername for @${username}:`, error);
    throw error;
  }
}

// ─── Signer operations (NOT supported by Pinata) ─────────────────────────────
// Neynar /signer and /signer/signed_key endpoints have no Pinata equivalent.
// auth.ts and signer/route.ts still call neynarFetch for these paths;
// at runtime those calls will be routed through pinataFetch → Pinata base URL,
// which will 404. The app must keep NEYNAR_API_KEY set for signer flows,
// OR implement a custom signer registration flow.
// See docs/PINATA_MIGRATION.md → "Known Gaps" section.
