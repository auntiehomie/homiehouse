import { NextRequest } from 'next/server';
import { GET } from '@/app/api/mini-app-catalog/route';

jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));
jest.mock('@/lib/logger', () => ({ createApiLogger: () => ({ error: jest.fn() }) }));

const request = (query = '') => new NextRequest(`http://localhost/api/mini-app-catalog${query}`);

describe('/api/mini-app-catalog', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('returns safe app cards from the public Mini App discovery feed without a provider key', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      result: { frames: [
        {
          domain: 'app.example',
          homeUrl: 'https://app.example/',
          name: 'Example App',
          author: { username: 'builder', displayName: 'Builder' },
          iconUrl: 'https://cdn.example/icon.png',
          requiredChains: ['eip155:8453'],
        },
        { domain: 'unsafe.example', homeUrl: 'http://unsafe.example/app', name: 'Unsafe app' },
      ] },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as jest.Mock;

    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ apps: [{
      id: 'app.example',
      url: 'https://app.example/',
      name: 'Example App',
      description: 'by Builder',
      iconUrl: 'https://cdn.example/icon.png',
      author: 'Builder',
    }] });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://client.warpcast.com/v1/top-frameapps?limit=100',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    );
  });

  it('filters the discovery feed locally when a query is supplied', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      result: { frames: [
        { domain: 'music.example', homeUrl: 'https://music.example/', name: 'Music app' },
        { domain: 'games.example', homeUrl: 'https://games.example/', name: 'Games app' },
      ] },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as jest.Mock;

    const response = await GET(request('?q=music%20app'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ apps: [expect.objectContaining({ name: 'Music app' })] });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://client.warpcast.com/v1/top-frameapps?limit=100',
      expect.any(Object),
    );
  });
});
