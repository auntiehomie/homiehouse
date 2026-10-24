import { rankCommunityPage } from '@/lib/community-feed';
import { hypersnapFetch } from '@/lib/hypersnap';
jest.mock('@/lib/hypersnap', () => ({ hypersnapFetch: jest.fn() }));
const fetchNode = hypersnapFetch as jest.Mock;

it('fails open on history outages and never requests invalid author IDs', async () => {
  fetchNode.mockRejectedValue(new Error('node timeout'));
  const candidates = [{ hash: 'a', author: { fid: 123 } }, { hash: 'b', author: { fid: -1 } }, { hash: 'c' }];
  const result = await rankCommunityPage(candidates);
  expect(result).toHaveLength(3);
  expect(fetchNode).toHaveBeenCalledTimes(1);
  expect(fetchNode).toHaveBeenCalledWith('/v2/farcaster/feed/user/casts?fid=123&limit=50', {}, 1500);
  expect(result.every(c => c.community_ranking.components.history === 0.5)).toBe(true);
});
it('deduplicates authors, bounds concurrency and reuses cached samples', async () => {
  fetchNode.mockClear();
  let active = 0; let maximum = 0;
  fetchNode.mockImplementation(async () => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--; return { casts: [] };
  });
  const candidates = Array.from({ length: 14 }, (_, i) => ({ hash: String(i), author: { fid: 1000 + i % 12 } }));
  await rankCommunityPage(candidates);
  expect(fetchNode).toHaveBeenCalledTimes(12);
  expect(maximum).toBeLessThanOrEqual(6);
  await rankCommunityPage(candidates);
  expect(fetchNode).toHaveBeenCalledTimes(12);
});
