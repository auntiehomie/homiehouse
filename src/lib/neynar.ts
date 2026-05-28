/**
 * Neynar compatibility shim — all exports delegate to src/lib/hypersnap.ts.
 *
 * This file exists so that any remaining imports of '@/lib/neynar' continue to
 * work without changes. No direct Neynar API calls are made from this file.
 *
 * All Farcaster reads are served by Hypersnap.
 * All Farcaster writes use the app-managed signer in src/lib/farcaster-writes.ts.
 */

export {
  hypersnapFetch as neynarFetch,
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
} from './hypersnap';
