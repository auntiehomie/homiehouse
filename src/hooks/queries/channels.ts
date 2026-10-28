'use client';

/**
 * Channel queries — channel list and per-channel feed.
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { fetchChannelList, fetchChannelFeed } from '@/lib/hypersnap';
import { channelKeys } from '@/lib/query-keys';
import { getNextPageCursor } from '@/lib/pagination';
import type { ChannelInfo } from './users';

// ─── Types ──────────────────────────────────────────────────────────────────

export type { ChannelInfo };

export interface ChannelFeedPage {
  casts: Array<Partial<{
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
    channel?: { id: string; name?: string };
  }> & Record<string, unknown>>;
  next_cursor: string | null;
  next: { cursor: string } | null;
}

// ─── Channel hooks ──────────────────────────────────────────────────────────

/** Fetch the full channel list. */
export function useChannelList(limit = 50) {
  return useQuery<ChannelInfo[]>({
    queryKey: channelKeys.list(limit),
    queryFn: async () => {
      const data = await fetchChannelList(limit);
      return data?.channels ?? data?.result ?? [];
    },
  });
}

/** Paginated channel feed (casts in a specific channel). */
export function useChannelFeed(channelId: string, fid?: number, limit = 25) {
  return useInfiniteQuery<ChannelFeedPage>({
    queryKey: channelKeys.feed(channelId),
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