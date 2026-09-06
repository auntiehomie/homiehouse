import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/sponsored-cast/route';
import { fetchSponsoredCast, recordSponsoredCastClick } from '@/lib/sponsored';

jest.mock('@/lib/sponsored', () => ({
  fetchSponsoredCast: jest.fn(),
  recordSponsoredCastClick: jest.fn(),
}));
jest.mock('@/lib/ratelimit', () => ({
  enforceRateLimit: jest.fn().mockResolvedValue(undefined),
  rateLimitKeyFromRequest: jest.fn(() => 'test-client'),
}));
jest.mock('@/lib/logger', () => ({
  createApiLogger: () => ({ error: jest.fn() }),
}));

const mockFetch = fetchSponsoredCast as jest.Mock;
const mockClick = recordSponsoredCastClick as jest.Mock;

const request = (url: string, init?: RequestInit) => new NextRequest(`http://localhost${url}`, init);

describe('/api/sponsored-cast', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a sponsored cast', async () => {
    mockFetch.mockResolvedValueOnce({ id: 1, hash: '0xabc' });
    const response = await GET(request('/api/sponsored-cast?exclude=0xold'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sponsored: { id: 1, hash: '0xabc' } });
    expect(mockFetch).toHaveBeenCalledWith('0xold');
  });

  it('records a click', async () => {
    const response = await POST(request('/api/sponsored-cast', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 1 }),
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockClick).toHaveBeenCalledWith(1);
  });

  it('validates the click id', async () => {
    const response = await POST(request('/api/sponsored-cast', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    }));
    expect(response.status).toBe(400);
  });

  it('returns a safe error when fetching fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await GET(request('/api/sponsored-cast'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Failed to fetch sponsored cast' });
  });
});
