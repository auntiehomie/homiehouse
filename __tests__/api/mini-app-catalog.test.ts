import { NextRequest } from 'next/server';
import { GET } from '@/app/api/mini-app-catalog/route';

jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));
jest.mock('@/lib/logger', () => ({ createApiLogger: () => ({ error: jest.fn() }) }));

const request = (query = '') => new NextRequest(`http://localhost/api/mini-app-catalog${query}`);

describe('/api/mini-app-catalog', () => {
  const originalApiKey = process.env.NEYNAR_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.NEYNAR_API_KEY;
    else process.env.NEYNAR_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('explains when catalog credentials are not configured', async () => {
    delete process.env.NEYNAR_API_KEY;
    global.fetch = jest.fn();
    const response = await GET(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Mini App discovery is not configured yet.' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns safe app cards from the hosted discovery catalog', async () => {
    process.env.NEYNAR_API_KEY = 'test-api-key';
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      frames: [
        {
          frames_url: 'https://app.example/mini',
          title: 'Fallback title',
          author: { username: 'builder' },
          manifest: { miniapp: {
            home_url: 'https://app.example/',
            name: 'Example App',
            description: 'A useful app',
            icon_url: 'https://cdn.example/icon.png',
            primary_category: 'utility',
          } },
        },
        { frames_url: 'http://unsafe.example/app', title: 'Unsafe app' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as jest.Mock;

    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ apps: [{
      id: 'https://app.example/mini',
      url: 'https://app.example/',
      name: 'Example App',
      description: 'A useful app',
      iconUrl: 'https://cdn.example/icon.png',
      author: '@builder',
      category: 'utility',
    }] });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.neynar.com/v2/farcaster/frame/catalog/?limit=100&time_window=7d',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'test-api-key' }) }),
    );
  });

  it('searches the wider Mini App index when a query is supplied', async () => {
    process.env.NEYNAR_API_KEY = 'test-api-key';
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      frames: [{
        frames_url: 'https://search.example/',
        manifest: { miniapp: { home_url: 'https://search.example/', name: 'Search result' } },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as jest.Mock;

    const response = await GET(request('?q=music%20app'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ apps: [expect.objectContaining({ name: 'Search result' })] });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.neynar.com/v2/farcaster/frame/search/?q=music+app&limit=50',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'test-api-key' }) }),
    );
  });

  it('rejects search terms longer than the provider limit', async () => {
    process.env.NEYNAR_API_KEY = 'test-api-key';
    global.fetch = jest.fn();
    const response = await GET(request(`?q=${'a'.repeat(33)}`));
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
