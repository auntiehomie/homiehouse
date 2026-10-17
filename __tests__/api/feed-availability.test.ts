import { NextRequest } from 'next/server';
import { GET } from '@/app/api/feed/route';
import { fetchFeed } from '@/lib/hypersnap';
jest.mock('@/lib/hypersnap', () => ({ fetchFeed: jest.fn(), fetchChannelFeed: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ enforceRateLimit: jest.fn(), rateLimitKeyFromRequest: () => 'test' }));
jest.mock('@/lib/logger', () => ({ createApiLogger: () => ({ start: jest.fn(), error: jest.fn() }) }));
const feed = fetchFeed as jest.Mock;
beforeEach(() => jest.clearAllMocks());
it('returns every node cast including unranked authors', async () => {
  const casts = [{ hash: 'unranked', author: { fid: 123, username: 'new-user' } }, { hash: 'no-profile' }];
  feed.mockResolvedValue({ casts, next: { cursor: 'older' } });
  const res = await GET(new NextRequest('https://homiehouse.app/api/feed?feed_type=global'));
  expect((await res.json()).data).toEqual(casts);
});
it('does not switch a finished following page to global discovery', async () => {
  feed.mockResolvedValue({ casts: [], next: { cursor: null } });
  const res = await GET(new NextRequest('https://homiehouse.app/api/feed?feed_type=following&fid=123&cursor=last'));
  expect((await res.json()).data).toEqual([]);
  expect(feed).toHaveBeenCalledTimes(1);
});
