/**
 * Shared Neynar API utilities
 * Centralizes API calls and error handling for Neynar API
 */

import { NeynarError } from './errors';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE_URL = 'https://api.neynar.com/v2/farcaster';

export interface NeynarFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Wrapper for Neynar API calls with automatic error handling
 * @param endpoint - API endpoint (without base URL)
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws NeynarError on API errors
 */
export async function neynarFetch<T = any>(
  endpoint: string,
  options?: NeynarFetchOptions
): Promise<T> {
  if (!NEYNAR_API_KEY && !options?.skipAuth) {
    throw new NeynarError('NEYNAR_API_KEY not configured', 500, 'MISSING_API_KEY');
  }

  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${NEYNAR_BASE_URL}${endpoint}`;

  const { skipAuth, ...fetchOptions } = options || {};

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      ...(skipAuth ? {} : { 'api_key': NEYNAR_API_KEY! }),
      ...fetchOptions?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails = errorText;
    
    // Try to parse error as JSON for better error messages
    try {
      const errorJson = JSON.parse(errorText);
      errorDetails = errorJson.message || errorJson.error || errorText;
    } catch (e) {
      // Keep original error text if not JSON
    }
    
    throw new NeynarError(errorDetails, response.status, 'NEYNAR_API_ERROR');
  }

  return response.json();
}

/**
 * Post a cast via Neynar API
 */
export async function publishCast(payload: {
  signer_uuid: string;
  text: string;
  embeds?: any[];
  parent?: string;
  channel_key?: string;
}) {
  return neynarFetch('/cast', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Post a reaction (like/recast) via Neynar API
 */
export async function publishReaction(payload: {
  signer_uuid: string;
  reaction_type: 'like' | 'recast';
  target: string;
}) {
  return neynarFetch('/reaction', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Delete a reaction via Neynar API
 */
export async function deleteReaction(payload: {
  signer_uuid: string;
  reaction_type: 'like' | 'recast';
  target: string;
}) {
  return neynarFetch('/reaction', {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch user feed
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
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, value.toString());
    }
  });
  
  return neynarFetch(`/feed?${searchParams.toString()}`);
}

/**
 * Fetch trending feed
 */
export async function fetchTrendingFeed(params: {
  limit?: number;
  time_window?: string;
  viewer_fid?: string;
  channel_id?: string;
  cursor?: string;
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, value.toString());
    }
  });
  
  return neynarFetch(`/feed/trending?${searchParams.toString()}`);
}

/**
 * Fetch user profile by username
 */
export async function fetchUserByUsername(username: string) {
  return neynarFetch(`/user/by_username?username=${encodeURIComponent(username)}`);
}

/**
 * Fetch cast by hash
 */
export async function fetchCast(castHash: string) {
  return neynarFetch(`/cast?identifier=${encodeURIComponent(castHash)}&type=hash`);
}

/**
 * Fetch user channels
 */
export async function fetchUserChannels(fid: string, limit: number = 25) {
  return neynarFetch(`/user/channels?fid=${fid}&limit=${limit}`);
}

/**
 * Fetch channel list
 */
export async function fetchChannelList(limit: number = 25) {
  return neynarFetch(`/channel/list?limit=${limit}`);
}

/**
 * Fetch user following
 */
export async function fetchFollowing(fid: string, limit: number = 100) {
  return neynarFetch(`/following?fid=${fid}&limit=${limit}`);
}

/**
 * Fetch notifications
 */
export async function fetchNotifications(params: {
  fid: string;
  priority_mode?: boolean;
  cursor?: string;
  type?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set('fid', params.fid);
  if (params.priority_mode) searchParams.set('priority_mode', 'true');
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.type) searchParams.set('type', params.type);
  
  return neynarFetch(`/notifications?${searchParams.toString()}`);
}

/**
 * Search users
 */
export async function searchUsers(query: string, limit: number = 5) {
  return neynarFetch(`/user/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

/**
 * Search casts by text
 */
export async function searchCasts(query: string, limit: number = 10) {
  return neynarFetch(`/cast/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

/**
 * Get casts by author username
 */
export async function getCastsByUsername(username: string, limit: number = 25) {
  // First get user by username
  const userData = await fetchUserByUsername(username);
  if (!userData?.user?.fid) {
    throw new Error(`User ${username} not found`);
  }
  
  // Then get their casts
  return neynarFetch(`/feed/user/${userData.user.fid}/casts?limit=${limit}`);
}
