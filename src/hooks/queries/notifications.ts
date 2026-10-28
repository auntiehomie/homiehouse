'use client';

/**
 * Notification queries — paginated notification feed.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchNotifications } from '@/lib/hypersnap';
import { notificationKeys } from '@/lib/query-keys';
import { getNextPageCursor } from '@/lib/pagination';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FarcasterNotification {
  type: 'like' | 'recast' | 'reply' | 'follow' | 'mention';
  timestamp: string;
  actor: {
    fid: number;
    username: string;
    display_name?: string;
    pfp_url?: string;
  };
  cast?: {
    hash: string;
    text: string;
    parent_hash?: string;
    parent_url?: string;
  };
  [key: string]: unknown;
}

export interface NotificationsPage {
  notifications: FarcasterNotification[];
  next_cursor: string | null;
  next: { cursor: string } | null;
}

// ─── Notification hooks ─────────────────────────────────────────────────────

/** Paginated notifications for a FID. */
export function useNotifications(fid: number, limit = 25) {
  return useInfiniteQuery<NotificationsPage>({
    queryKey: notificationKeys.forFid(fid),
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === 'string' ? pageParam : undefined;
      const data = await fetchNotifications({
        fid,
        limit,
        ...(cursor ? { cursor } : {}),
      });
      return {
        notifications: data?.notifications ?? [],
        next_cursor: data?.next?.cursor ?? null,
        next: data?.next ?? null,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => getNextPageCursor(lastPage),
    enabled: !!fid,
  });
}