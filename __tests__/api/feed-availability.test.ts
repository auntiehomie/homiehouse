import { NextRequest } from 'next/server';
import { GET } from '@/app/api/feed/route';
import { fetchFeed } from '@/lib/hypersnap';
import { rankCommunityPage } from '@/lib/community-feed';
jest.mock('@/lib/community-feed', () => ({ rankCommunityPage: jest.fn() }));
jest.mock('@/lib/hypersnap', () => ({ fetchFeed: jest.fn(), fetchChannelFeed: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ enforceRateLimit: jest.fn(), rateLimitKeyFromRequest: () => 'test' }));
jest.mock('@/lib/logger', () => ({ createApiLogger: () => ({ start: jest.fn(), error: jest.fn() }) }));
const feed = fetchFeed as jest.Mock;
beforeEach(() => jest.clearAllMocks());
it('ranks only the optional Community feed and preserves the upstream page token', async () => {
  const casts = [{ hash: 'a' }, { hash: 'b' }];
  feed.mockResolvedValue({ casts, next: { cursor: 'node-page-2' } });
  (rankCommunityPage as jest.Mock).mockResolvedValue([...casts].reverse());
  const res = await GET(new NextRequest('https://homiehouse.app/api/feed?feed_type=community&cursor=node-page-1'));
  expect(await res.json()).toMatchObject({ data: [...casts].reverse(), cursor: 'node-page-2', meta: { feedType: 'community', ranking: { scope: 'node-page', authenticityVerified: false } } });
  expect(feed).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'node-page-1', filter_type: 'global_trending' }));
});
it('returns every node cast including unranked authors', async () => {
  const casts = [{ hash: 'unranked', author: { fid: 123, username: 'new-user' } }, { hash: 'no-profile' }];
  feed.mockResolvedValue({ casts, next: { cursor: 'older' } });
  const res = await GET(new NextRequest('https://homiehouse.app/api/feed?feed_type=global'));
  expect((await res.json()).data).toEqual(casts);
  expect(rankCommunityPage).not.toHaveBeenCalled();
});
it('does not switch a finished following page to global discovery', async () => {
  feed.mockResolvedValue({ casts: [], next: { cursor: null } });
  const res = await GET(new NextRequest('https://homiehouse.app/api/feed?feed_type=following&fid=123&cursor=last'));
  expect((await res.json()).data).toEqual([]);
  expect(feed).toHaveBeenCalledTimes(1);
});
it('does not substitute ranked discovery for an empty first Following page', async () => {
  feed.mockResolvedValue({ casts: [], next: { cursor: null } });
  const res = await GET(new NextRequest('https://homiehouse.app/api/feed?feed_type=following&fid=123'));
  expect(await res.json()).toMatchObject({ data: [], meta: { feedType: 'following', automatedSpamFiltering: false } });
  expect(feed).toHaveBeenCalledTimes(1);
  expect(res.headers.get('cache-control')).toBe('no-store');
});
it('requires an identity for Following rather than showing Global under its label', async () => {
  const res = await GET(new NextRequest('https://homiehouse.app/api/feed?feed_type=following'));
  expect(res.status).toBe(400);
  expect(feed).not.toHaveBeenCalled();
});
