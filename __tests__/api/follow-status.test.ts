import { NextRequest } from 'next/server';
import { GET } from '@/app/api/follow-status/route';

const request = (query: string) => new NextRequest(`https://homiehouse.app/api/follow-status?${query}`);

describe('/api/follow-status', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('returns true when the node has a follow link', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const response = await GET(request('fid=123&target_fid=456'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ following: true });
    expect(fetchMock.mock.calls[0][0]).toContain('/v1/linkById?fid=123&target_fid=456&link_type=follow');
  });

  it('returns false only when the node confirms no link exists', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 } as Response);

    const response = await GET(request('fid=123&target_fid=456'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ following: false });
  });

  it('uses the fallback node when the configured node is unavailable', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const response = await GET(request('fid=123&target_fid=456'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ following: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not turn a node outage into a false follow result', async () => {
    fetchMock.mockRejectedValue(new Error('node unavailable'));

    const response = await GET(request('fid=123&target_fid=456'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ following: null });
  });

  it('rejects malformed FIDs', async () => {
    const response = await GET(request('fid=0&target_fid=nope'));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
