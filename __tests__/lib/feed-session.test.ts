import type * as FeedSession from '@/lib/feed-session';
let feed: typeof FeedSession;
let data: Map<string, string>;
const snapshot = () => ({ items: [{ hash: 'target' }], cursor: 'page-3', hasMore: true });
const capture = (hash = 'target') => feed.saveFeedReturn({ snapshotKey: feed.feedSnapshotKey('global', null), feedType: 'global', selectedChannel: null, castHash: hash, castOffset: -650, scrollY: 1400 }, snapshot());

beforeEach(() => {
  jest.resetModules();
  data = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: jest.fn((key: string) => data.get(key) || null),
    setItem: jest.fn((key: string, value: string) => data.set(key, value)),
    removeItem: jest.fn((key: string) => data.delete(key)),
  } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{"fid":321}' } });
  feed = require('@/lib/feed-session');
});
afterEach(() => jest.restoreAllMocks());

test('restores Community selection, ordered cards and cursor independently of Following', () => {
  const key = feed.feedSnapshotKey('community', null);
  feed.saveFeedReturn({ snapshotKey: key, feedType: 'community', selectedChannel: null, castHash: 'target', castOffset: 20, scrollY: 500 }, snapshot());
  jest.resetModules();
  const restored: typeof FeedSession = require('@/lib/feed-session');
  expect(restored.readFeedReturn()?.feedType).toBe('community');
  expect(restored.readFeedSnapshot(key)).toMatchObject(snapshot());
  expect(restored.readFeedSnapshot(restored.feedSnapshotKey('following', null))).toBeNull();
});

test('keeps the list, cursor and exact offset when quota errors block every write', () => {
  jest.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
  capture();
  const saved = feed.readFeedReturn()!;
  expect(saved.castOffset).toBe(-650);
  expect(saved.scrollY).toBe(1400);
  expect(feed.readFeedSnapshot(saved.snapshotKey)).toMatchObject(snapshot());
});

test('storage reads are optional after an in-tab snapshot is captured', () => {
  capture();
  jest.spyOn(sessionStorage, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
  const saved = feed.readFeedReturn()!;
  expect(feed.readFeedSnapshot(saved.snapshotKey)?.items).toEqual(snapshot().items);
});

test('writes return metadata independently before a large snapshot can fail', () => {
  jest.spyOn(sessionStorage, 'setItem').mockImplementation((key, value) => {
    if (key.includes('snapshot')) throw new Error('QuotaExceededError');
    data.set(key, value);
  });
  capture();
  expect([...data.keys()]).toEqual(['hh_feed_return_v2']);
  expect(feed.readFeedSnapshot(feed.readFeedReturn()!.snapshotKey)).not.toBeNull();
});

test('keeps an active return while reading; bounds only persisted reload recovery', () => {
  capture();
  const saved = feed.readFeedReturn()!;
  jest.spyOn(Date, 'now').mockReturnValue(saved.ts + 7 * 60 * 1000);
  expect(feed.readFeedReturn()).not.toBeNull();
  expect(feed.readFeedSnapshot(saved.snapshotKey, feed.FEED_RETURN_TTL)).not.toBeNull();
  jest.spyOn(Date, 'now').mockReturnValue(saved.ts + feed.FEED_RETURN_TTL + 1);
  expect(feed.readFeedReturn()).not.toBeNull();
  expect(feed.readFeedSnapshot(saved.snapshotKey, feed.FEED_RETURN_TTL)).not.toBeNull();
  jest.resetModules();
  const reloaded: typeof FeedSession = require('@/lib/feed-session');
  expect(reloaded.readFeedReturn()).toBeNull();
});

test('preserves casts beyond the previous 300-item cutoff with their actual cursor', () => {
  const items = Array.from({ length: 405 }, (_, index) => ({ hash: String(index) }));
  const key = feed.feedSnapshotKey('following', 'channel');
  feed.saveFeedReturn({ snapshotKey: key, feedType: 'following', selectedChannel: 'channel', castHash: '404', castOffset: -500, scrollY: 30000 }, { items, cursor: 'page-22', hasMore: true });
  expect(feed.readFeedSnapshot(key)?.items).toHaveLength(405);
  expect(feed.readFeedSnapshot(key)?.cursor).toBe('page-22');
  expect(feed.readFeedReturn()?.selectedChannel).toBe('channel');
});

test('can rehydrate a saved return after module memory is lost', () => {
  capture();
  jest.resetModules();
  const restored: typeof FeedSession = require('@/lib/feed-session');
  const saved = restored.readFeedReturn()!;
  expect(restored.readFeedSnapshot(saved.snapshotKey)).toMatchObject(snapshot());
});

test('consuming an old restore cannot clear a newer cast navigation', () => {
  capture('first');
  const old = feed.readFeedReturn()!;
  capture('second');
  feed.consumeFeedReturn(old);
  expect(feed.readFeedReturn()?.castHash).toBe('second');
  feed.consumeFeedReturn(feed.readFeedReturn()!);
  expect(feed.readFeedReturn()).toBeNull();
});

test('does not restore another signed-in account’s feed selection', () => {
  capture();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{"fid":999}' } });
  expect(feed.readFeedReturn()).toBeNull();
  expect(feed.readFeedSnapshot(feed.feedSnapshotKey('global', null))).toBeNull();
});
