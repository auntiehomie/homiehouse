/**
 * Domain-based query key builders for React Query.
 * Pattern follows @farcasterxyz/client — each domain exports a keys object
 * whose methods produce stable, cacheable key arrays per resource.
 */

// ─── Feed keys ──────────────────────────────────────────────────────────────

export const feedKeys = {
  all: ['feed'] as const,
  following: (fid: number) => [...feedKeys.all, 'following', fid] as const,
  channel: (channelId: string, fid?: number) =>
    [...feedKeys.all, 'channel', channelId, fid] as const,
  trending: () => [...feedKeys.all, 'trending'] as const,
};

// ─── Cast keys ──────────────────────────────────────────────────────────────

export const castKeys = {
  all: ['casts'] as const,
  detail: (hash: string) => [...castKeys.all, 'detail', hash] as const,
  conversation: (hash: string) =>
    [...castKeys.all, 'conversation', hash] as const,
  byFid: (fid: number) => [...castKeys.all, 'byFid', fid] as const,
  byUsername: (username: string) =>
    [...castKeys.all, 'byUsername', username] as const,
  search: (query: string) => [...castKeys.all, 'search', query] as const,
};

// ─── User keys ──────────────────────────────────────────────────────────────

export const userKeys = {
  all: ['users'] as const,
  byUsername: (username: string) =>
    [...userKeys.all, 'username', username] as const,
  search: (query: string) => [...userKeys.all, 'search', query] as const,
  following: (fid: number) => [...userKeys.all, 'following', fid] as const,
  channels: (fid: number) => [...userKeys.all, 'channels', fid] as const,
};

// ─── Channel keys ───────────────────────────────────────────────────────────

export const channelKeys = {
  all: ['channels'] as const,
  list: (limit?: number) => [...channelKeys.all, 'list', limit] as const,
  feed: (channelId: string) =>
    [...channelKeys.all, 'feed', channelId] as const,
};

// ─── Notification keys ──────────────────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
  forFid: (fid: number) => [...notificationKeys.all, fid] as const,
};