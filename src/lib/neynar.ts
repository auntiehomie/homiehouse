// CONNECTOR: Hypersnap (migrated from Neynar → Pinata → Hypersnap)
/**
 * Neynar compatibility shim — all exports delegate to src/lib/pinata.ts,
 * which in turn delegates Farcaster reads/writes to src/lib/hypersnap.ts.
 *
 * This file exists so that existing imports of '@/lib/neynar' continue to
 * work without changes.
 *
 * See docs/HYPERSNAP_MIGRATION.md for full migration details.
 */

export {
  neynarFetch,
  publishCast,
  publishReaction,
  deleteReaction,
  fetchFeed,
  fetchTrendingFeed,
  fetchUserByUsername,
  fetchCast,
  fetchUserChannels,
  fetchChannelList,
  fetchFollowing,
  fetchNotifications,
  searchUsers,
  searchCasts,
  getCastsByUsername,
} from './pinata';

export type { PinataFetchOptions as NeynarFetchOptions } from './pinata';
