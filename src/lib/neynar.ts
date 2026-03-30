// CONNECTOR: Pinata (migrated from Neynar)
/**
 * Neynar compatibility shim — all exports delegate to src/lib/pinata.ts.
 *
 * This file exists so that existing imports of '@/lib/neynar' continue to
 * work without changes.  The actual implementation now lives in pinata.ts
 * and calls the Pinata Farcaster API.
 *
 * See docs/PINATA_MIGRATION.md for full migration details.
 */

export {
  pinataFetch as neynarFetch,
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
