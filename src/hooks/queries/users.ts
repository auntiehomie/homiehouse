'use client';

/**
 * User queries — lookup by username, search, following list, and channels.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchUserByUsername,
  searchUsers,
  fetchFollowing,
  fetchUserChannels,
} from '@/lib/hypersnap';
import { userKeys } from '@/lib/query-keys';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
  profile?: {
    bio?: { text?: string };
  };
  follower_count?: number;
  following_count?: number;
  [key: string]: unknown;
}

export interface FollowingUser {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
  follower_count?: number;
  [key: string]: unknown;
}

export interface ChannelInfo {
  id: string;
  name?: string;
  description?: string;
  image_url?: string;
  follower_count?: number;
  [key: string]: unknown;
}

// ─── User hooks ─────────────────────────────────────────────────────────────

/** Look up a user by their Farcaster username. */
export function useUserByUsername(username: string) {
  return useQuery<UserProfile | null>({
    queryKey: userKeys.byUsername(username),
    queryFn: async () => {
      const data = await fetchUserByUsername(username);
      return data?.user ?? null;
    },
    enabled: !!username,
  });
}

/** Search for Farcaster users by query string. */
export function useUserSearch(query: string) {
  return useQuery<UserProfile[]>({
    queryKey: userKeys.search(query),
    queryFn: async () => {
      const data = await searchUsers(query, 10);
      return data?.users ?? [];
    },
    enabled: !!query && query.length >= 2,
  });
}

/** Fetch the list of users that a FID is following. */
export function useFollowing(fid: number) {
  return useQuery<FollowingUser[]>({
    queryKey: userKeys.following(fid),
    queryFn: async () => {
      const data = await fetchFollowing(fid, 100);
      return data?.users ?? [];
    },
    enabled: !!fid,
  });
}

/** Fetch the channels a user is a member of. */
export function useUserChannels(fid: number) {
  return useQuery<ChannelInfo[]>({
    queryKey: userKeys.channels(fid),
    queryFn: async () => {
      const data = await fetchUserChannels(fid, 50);
      return data?.channels ?? [];
    },
    enabled: !!fid,
  });
}