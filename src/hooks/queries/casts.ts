'use client';

/**
 * Cast queries — single cast, conversation, casts by author, and search.
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  fetchCast,
  fetchCastConversation,
  fetchCastsByFid,
  getCastsByUsername,
  searchCasts,
} from '@/lib/hypersnap';
import { castKeys } from '@/lib/query-keys';
import { getNextPageCursor } from '@/lib/pagination';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CastDetail {
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
  direct_replies?: CastDetail[];
  [key: string]: unknown;
}

export interface CastConversation {
  cast: CastDetail;
}

export interface CastSearchPage {
  casts: CastDetail[];
  next_cursor: string | null;
  next: { cursor: string } | null;
}

// ─── Cast hooks ─────────────────────────────────────────────────────────────

/** Fetch a single cast by its hash. */
export function useCast(hash: string) {
  return useQuery<CastDetail | null>({
    queryKey: castKeys.detail(hash),
    queryFn: async () => {
      const data = await fetchCast(hash);
      return data?.cast ?? null;
    },
    enabled: !!hash,
  });
}

/** Fetch a cast and its direct replies (conversation view). */
export function useCastConversation(hash: string) {
  return useQuery<CastConversation | null>({
    queryKey: castKeys.conversation(hash),
    queryFn: async () => {
      const data = await fetchCastConversation(hash);
      return data?.conversation ?? null;
    },
    enabled: !!hash,
  });
}

/** Fetch recent casts by a specific FID. */
export function useCastsByFid(fid: number) {
  return useQuery<CastDetail[]>({
    queryKey: castKeys.byFid(fid),
    queryFn: async () => {
      const casts = await fetchCastsByFid(fid, 50);
      return casts;
    },
    enabled: !!fid,
  });
}

/** Fetch casts by username (resolves FID first, then fetches). */
export function useCastsByUsername(username: string) {
  return useQuery<CastDetail[]>({
    queryKey: castKeys.byUsername(username),
    queryFn: async () => {
      const data = await getCastsByUsername(username, 50);
      return data?.casts ?? [];
    },
    enabled: !!username,
  });
}

/** Paginated cast search. */
export function useCastSearch(query: string, limit = 10) {
  return useInfiniteQuery<CastSearchPage>({
    queryKey: castKeys.search(query),
    queryFn: async ({ pageParam }) => {
      const cursor =
        typeof pageParam === 'string' && pageParam.length > 0
          ? pageParam
          : undefined;
      const data = await searchCasts(query, limit);
      // searchCasts doesn't natively paginate yet; cursor is future-proof
      return {
        casts: data?.casts ?? [],
        next_cursor: data?.next?.cursor ?? null,
        next: data?.next ?? null,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => getNextPageCursor(lastPage),
    enabled: !!query && query.length >= 2,
  });
}