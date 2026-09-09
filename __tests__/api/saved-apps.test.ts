import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from '@/app/api/saved-apps/route';
import { sql } from '@/lib/db';

jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
const mockSql = sql as jest.Mock;
const request = (url: string, init?: RequestInit) => new NextRequest(`http://localhost${url}`, init);

const json = (method: string, body: unknown) => request('/api/saved-apps', {
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('/api/saved-apps', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists saved mini apps for a fid', async () => {
    mockSql.mockResolvedValueOnce([{ app_id: 'demo', app_data: { name: 'Demo' } }]);
    const response = await GET(request('/api/saved-apps?fid=123'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ apps: [{ app_id: 'demo', app_data: { name: 'Demo' } }] });
  });

  it('upserts a saved mini app', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1', app_id: 'demo' }]);
    const response = await POST(json('POST', { fid: 123, app_id: 'demo', app_data: { name: 'Demo' } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ saved: true, app: { app_id: 'demo' } });
  });

  it('deletes a saved mini app', async () => {
    mockSql.mockResolvedValueOnce([]);
    const response = await DELETE(json('DELETE', { fid: 123, app_id: 'demo' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
  });

  it.each([
    () => GET(request('/api/saved-apps')),
    () => POST(json('POST', { fid: 123 })),
    () => DELETE(json('DELETE', { fid: 123 })),
  ])('rejects invalid input', async (invoke) => {
    const response = await invoke();
    expect(response.status).toBe(400);
  });

  it('returns a database error when listing fails', async () => {
    mockSql.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await GET(request('/api/saved-apps?fid=123'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Database error' });
  });
});
