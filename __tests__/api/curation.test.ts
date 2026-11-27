import { NextRequest } from 'next/server';
import { DELETE, GET, POST, PUT } from '@/app/api/curation/route';
import { sql } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn() }));

const mockSql = sql as unknown as jest.Mock;
const mockAuth = verifyFarcasterSignerAuth as jest.Mock;
const request = (url: string, init?: RequestInit) => new NextRequest(`http://localhost${url}`, init);
const json = (method: string, body: unknown, url = '/api/curation') => request(url, {
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const sqlText = (call: unknown[]) => (call[0] as TemplateStringsArray).join('?');
const row = (over: Record<string, unknown> = {}) => ({
  id: '7', fid: '123', preference_type: 'keyword', preference_value: 'base',
  action: 'include', priority: 1, created_at: 'now', updated_at: 'now', ...over,
});

/** Route a mock SQL call by its statement text. */
function sqlRouter(handlers: Record<string, unknown[] | (() => unknown)>) {
  mockSql.mockImplementation(async (strings: TemplateStringsArray) => {
    const text = strings.join('?');
    for (const [match, result] of Object.entries(handlers)) {
      if (text.includes(match)) return typeof result === 'function' ? result() : result;
    }
    return [];
  });
}

describe('/api/curation (app database)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(123);
    sqlRouter({});
  });

  it('no longer calls the external curation server', async () => {
    global.fetch = jest.fn();
    sqlRouter({ 'SELECT * FROM user_curation_preferences': [row()] });
    await GET(request('/api/curation?fid=123'));
    expect(global.fetch).not.toHaveBeenCalled();
    // The table is created once, on first use.
    expect(mockSql.mock.calls.map(sqlText).some((t) => t.includes('CREATE TABLE IF NOT EXISTS user_curation_preferences'))).toBe(true);
  });

  it('lists only the caller\'s preferences', async () => {
    sqlRouter({ 'SELECT * FROM user_curation_preferences': [row()] });
    const res = await GET(request('/api/curation?fid=123'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, preferences: [{ ...row(), id: 7, fid: 123 }] });
    const select = mockSql.mock.calls.find((c) => sqlText(c).includes('SELECT * FROM'))!;
    expect(select.slice(1)).toContain(123);
  });

  it('refuses to read another FID', async () => {
    expect((await GET(request('/api/curation?fid=456'))).status).toBe(403);
  });

  it('adds a preference for the session FID', async () => {
    sqlRouter({ 'COUNT(*)': [{ count: 0 }], 'INSERT INTO': [row()] });
    const res = await POST(json('POST', { fid: 123, preference_type: 'keyword', preference_value: '  base ', action: 'include', priority: 1 }));
    expect(res.status).toBe(200);
    const insert = mockSql.mock.calls.find((c) => sqlText(c).includes('INSERT INTO'))!;
    expect(insert.slice(1)).toEqual([123, 'keyword', 'base', 'include', 1]);
  });

  it.each([
    ['unknown type', { preference_type: 'bogus' }],
    ['empty value', { preference_value: '  ' }],
    ['non-numeric min_likes', { preference_type: 'min_likes', preference_value: 'lots' }],
    ['bad action', { action: 'boost' }],
    ['out-of-range priority', { priority: 500 }],
  ])('rejects an %s', async (_name, change) => {
    const res = await POST(json('POST', { preference_type: 'keyword', preference_value: 'x', action: 'include', ...change }));
    expect(res.status).toBe(400);
    expect(mockSql.mock.calls.some((c) => sqlText(c).includes('INSERT INTO'))).toBe(false);
  });

  it('caps preferences per user', async () => {
    sqlRouter({ 'COUNT(*)': [{ count: 200 }] });
    const res = await POST(json('POST', { preference_type: 'keyword', preference_value: 'x', action: 'include' }));
    expect(res.status).toBe(409);
  });

  it('refuses to add for another FID', async () => {
    const res = await POST(json('POST', { fid: 456, preference_type: 'keyword', preference_value: 'x', action: 'include' }));
    expect(res.status).toBe(403);
  });

  it('updates only a preference the caller owns', async () => {
    sqlRouter({ 'SELECT * FROM user_curation_preferences WHERE id': [row()], 'UPDATE user_curation_preferences': [row({ action: 'exclude' })] });
    const res = await PUT(json('PUT', { id: 7, action: 'exclude' }));
    expect(res.status).toBe(200);
    const update = mockSql.mock.calls.find((c) => sqlText(c).includes('UPDATE'))!;
    expect(update.slice(1)).toEqual(['keyword', 'base', 'exclude', 1, 7, 123]);
  });

  it('returns 404 when updating someone else\'s preference', async () => {
    sqlRouter({ 'SELECT * FROM user_curation_preferences WHERE id': [] });
    expect((await PUT(json('PUT', { id: 7, action: 'exclude' }))).status).toBe(404);
    expect(mockSql.mock.calls.some((c) => sqlText(c).includes('UPDATE'))).toBe(false);
  });

  it('deletes only by id and session FID', async () => {
    sqlRouter({ 'DELETE FROM': [{ id: 7 }] });
    const res = await DELETE(request('/api/curation?id=7', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    const del = mockSql.mock.calls.find((c) => sqlText(c).includes('DELETE FROM'))!;
    expect(del.slice(1)).toEqual([7, 123]);
  });

  it('returns 404 when deleting a preference the caller does not own', async () => {
    sqlRouter({ 'DELETE FROM': [] });
    expect((await DELETE(request('/api/curation?id=7', { method: 'DELETE' }))).status).toBe(404);
  });

  it('passes auth failures through', async () => {
    mockAuth.mockRejectedValue(new AuthError('Missing x-session-token header', 401, 'MISSING_AUTH_HEADERS'));
    expect((await GET(request('/api/curation'))).status).toBe(401);
  });
});
