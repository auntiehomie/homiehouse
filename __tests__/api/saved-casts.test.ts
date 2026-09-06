import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from '@/app/api/saved-casts/route';
import { sql } from '@/lib/db';

jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));

const mockSql = sql as jest.Mock;
const request = (url: string, init?: RequestInit) => new NextRequest(`http://localhost${url}`, init);

describe('/api/saved-casts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists saved casts for a fid', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, cast_hash: '0xabc' }]);
    const response = await GET(request('/api/saved-casts?fid=123'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ casts: [{ id: 1, cast_hash: '0xabc' }] });
  });

  it('saves a cast and returns its id', async () => {
    mockSql.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([{ id: 42 }]);
    const response = await POST(request('/api/saved-casts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fid: 123, cast_hash: '0xabc', embeds: [] }),
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ saved: true, id: 42 });
  });

  it('deletes a saved cast', async () => {
    mockSql.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([]);
    const response = await DELETE(request('/api/saved-casts', {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fid: 123, cast_hash: '0xabc' }),
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
  });

  it.each([
    ['GET', () => GET(request('/api/saved-casts'))],
    ['POST', () => POST(request('/api/saved-casts', { method: 'POST', body: JSON.stringify({ fid: 123 }) }))],
    ['DELETE', () => DELETE(request('/api/saved-casts', { method: 'DELETE', body: JSON.stringify({ fid: 123 }) }))],
  ])('rejects invalid %s input', async (_method, invoke) => {
    const response = await invoke();
    expect(response.status).toBe(400);
  });

  it('returns a database error when listing fails', async () => {
    mockSql.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await GET(request('/api/saved-casts?fid=123'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Database error' });
  });
});
