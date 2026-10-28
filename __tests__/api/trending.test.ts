import { NextRequest } from 'next/server';
import { GET } from '@/app/api/trending/route';
import { fetchTrendingFeed } from '@/lib/hypersnap';
import { fetchSponsoredCast } from '@/lib/sponsored';

jest.mock('@/lib/hypersnap', () => ({
  fetchTrendingFeed: jest.fn(),
}));
jest.mock('@/lib/sponsored', () => ({
  fetchSponsoredCast: jest.fn(),
}));
jest.mock('@/lib/ratelimit', () => ({
  enforceRateLimit: jest.fn().mockResolvedValue(undefined),
  rateLimitKeyFromRequest: jest.fn(() => 'test-client'),
}));
jest.mock('@/lib/logger', () => ({
  createApiLogger: () => ({
    start: jest.fn(),
    end: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockTrending = fetchTrendingFeed as jest.Mock;
const mockSponsored = fetchSponsoredCast as jest.Mock;

describe('/api/trending', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a shared ranking request even when a viewer FID is supplied', async () => {
    mockTrending.mockResolvedValueOnce({ casts: [{ hash: '0xabc' }] });
    mockSponsored.mockResolvedValueOnce({ id: 1, cast_hash: '0xsponsor' });

    const response = await GET(new NextRequest('http://localhost/api/trending?limit=10&viewer_fid=123'));

    expect(response.status).toBe(200);
    expect(mockTrending).toHaveBeenCalledWith({
      limit: 10,
      time_window: '24h',
      channel_id: undefined,
    });
    await expect(response.json()).resolves.toEqual({
      data: [{ hash: '0xabc' }],
      sponsored: { id: 1, cast_hash: '0xsponsor' },
    });
  });

  it('keeps trending available when sponsorship lookup fails', async () => {
    mockTrending.mockResolvedValueOnce({ casts: [{ hash: '0xabc' }] });
    mockSponsored.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await GET(new NextRequest('http://localhost/api/trending'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ hash: '0xabc' }],
      sponsored: null,
    });
  });
});
