'use client';

/**
 * Feed queries — following, trending, and channel feeds.
 * Uses @tanstack/react-query with infinite pagination for feed endpoints.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchFeed, fetchTrendingFeed, fetchChannelFeed } from '@/lib/hypersnap';
import { feedKeys } from '@/lib/query-keys';
import { getNextPageCursor } from '@/lib/pagination';

// ─── Types ──────────────────────────────────────────────────────────────────

/** @deprecated Use `feed_type: 'following'` inside `fetchFeed` directly. */
export type FeedType = 'following' | 'trending' | 'channel';

export interface CastResult {
  hash: string;
  text: string;
  timestamp: string;
  author: {
    fid: number;
    username: string;
    display_name?: string;
    pfp_url?: string;
  };
  embeds?: { url: string }[];
  reactions?: {
    likes_count?: number;
    recasts_count?: number;
    replies_count?: number;
  };
  parent_hash?: string;
  parent_url?: string;
  parent_author?: { fid: number; username?: string };
  thread_hash?: string;
  channel?: { id: string; name?: string };
  [key: string]: unknown;
}

export interface FeedPage {
  casts: CastResult[];
  next_cursor: string | null;
  next: { cursor: string } | null;
}

// ─── Feed hooks ─────────────────────────────────────────────────────────────

/**
 * Paginated "following" feed for an authenticated user.
 * `limit` defaults to 25; pass a larger value to fetch more per page.
 */
export function useFeed(fid: number, limit = 25) {
  return useInfiniteQuery<FeedPage>({
    queryKey: feedKeys.following(fid),
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === 'string' ? pageParam : undefined;
      const data = await fetchFeed({
        feed_type: 'following',
        fid,
        limit,
        ...(cursor ? { cursor } : {}),
      });
      return {
        casts: data?.casts ?? [],
        next_cursor: data?.next_cursor ?? null,
        next: data?.next ?? null,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => getNextPageCursor(lastPage),
    enabled: !!fid,
  });
}

/**
 * Paginated trending feed (global OR channel-scoped).
 * Pass `channelId` to scope to a single channel, or omit for global trending.
 */
export function useTrendingFeed(channelId?: string, limit = 25) {
  return useInfiniteQuery<FeedPage>({
    queryKey: channelId
      ? feedKeys.channel(channelId)
      : feedKeys.trending(),
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === 'string' ? pageParam : undefined;
      const params: Record<string, unknown> = { limit };
      if (channelId) params.channel_id = channelId;
      if (cursor) params.cursor = cursor;
      const data = await fetchTrendingFeed(params);
      return {
        casts: data?.casts ?? [],
        next_cursor: data?.next_cursor ?? null,
        next: data?.next ?? null,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => getNextPageCursor(lastPage),
  });
}

/**
 * Paginated channel feed.
 * Uses the dedicated `fetchChannelFeed` endpoint which handles cursor-based
 * pagination natively.
 */
export function useChannelFeed(channelId: string, fid?: number, limit = 25) {
  return useInfiniteQuery<FeedPage>({
    queryKey: feedKeys.channel(channelId, fid),
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === 'string' ? pageParam : undefined;
      const data = await fetchChannelFeed(channelId, {
        limit,
        cursor,
        ...(fid ? { viewerFid: fid } : {}),
      });
      return {
        casts: data?.casts ?? [],
        next_cursor: data?.next_cursor ?? null,
        next: data?.next ?? null,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => getNextPageCursor(lastPage),
    enabled: !!channelId,
  });
}