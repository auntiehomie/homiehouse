import { NextRequest } from 'next/server';
import { GET } from '@/app/api/castboards/route';
import { fetchChannelFeed } from '@/lib/hypersnap';
jest.mock('@/lib/hypersnap', () => ({ fetchChannelFeed: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ enforceRateLimit: jest.fn(), rateLimitKeyFromRequest: () => 'test' }));
const read = fetchChannelFeed as jest.Mock;
beforeEach(() => { read.mockReset(); });
it('rejects unknown boards before requesting arbitrary channels', async () => {
  const res = await GET(new NextRequest('http://localhost/api/castboards?board=unknown'));
  expect(res.status).toBe(404); expect(read).not.toHaveBeenCalled();
});
it('returns partial results and identifies unavailable channels', async () => {
  read.mockResolvedValueOnce({ casts: [{ hash: 'a', text: 'Shipping' }] }).mockRejectedValueOnce(new Error('offline'));
  const res = await GET(new NextRequest('http://localhost/api/castboards?board=builders'));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ casts: [{ hash: 'a' }], failedChannels: ['dev'] });
});
it('does not present an upstream outage as an empty board', async () => {
  read.mockRejectedValue(new Error('offline'));
  const res = await GET(new NextRequest('http://localhost/api/castboards?board=builders'));
  expect(res.status).toBe(503);
});
