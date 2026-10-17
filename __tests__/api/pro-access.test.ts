import { NextRequest } from 'next/server';
import { GET as status } from '@/app/api/pro-status/route';
import { GET as premium } from '@/app/api/premium-track/route';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isProUser } from '@/lib/pro';
import { AuthError } from '@/lib/errors';
import { PREMIUM_MODULE_IDS } from '@/lib/premium-curriculum';

jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ enforceRateLimit: jest.fn(), rateLimitKeyFromRequest: () => 'test' }));
jest.mock('@/lib/logger', () => ({ createApiLogger: () => ({ start: jest.fn(), error: jest.fn() }) }));
const auth = verifyFarcasterSignerAuth as jest.Mock;
const query = sql as unknown as jest.Mock;
const request = (path: string, authenticated = true) => new NextRequest(`https://homiehouse.app/api/${path}`, {
  headers: authenticated ? { 'x-session-token': 'read-only-session' } : {},
});
beforeEach(() => { jest.clearAllMocks(); auth.mockResolvedValue(3103); query.mockResolvedValue([{ id: 'paid', status: 'active' }]); });

test('paid status uses authenticated identity, read permission and private no-store responses', async () => {
  const response = await status(request('pro-status?fid=3103'));
  expect(await response.json()).toMatchObject({ ok: true, is_pro: true });
  expect(auth).toHaveBeenCalledWith(expect.anything(), 'read:all');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('vary')).toContain('x-session-token');
});
test('a caller cannot check someone else’s subscription using a query FID', async () => {
  expect((await status(request('pro-status?fid=999'))).status).toBe(403);
  expect(query).not.toHaveBeenCalled();
});
test('invalid auth is a 401, not a successful free-user response', async () => {
  auth.mockRejectedValue(new AuthError('Session expired', 401));
  const response = await status(request('pro-status'));
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ ok: false, error: 'Session expired' });
  expect((await premium(request('premium-track'))).status).toBe(401);
  expect(query).not.toHaveBeenCalled();
});
test('a paid read-only session unlocks listings and full lesson content', async () => {
  const listing = await premium(request('premium-track'));
  expect(await listing.json()).toMatchObject({ ok: true, unlocked: true, pro_required: false });
  const moduleId = [...PREMIUM_MODULE_IDS][0];
  const lesson = await premium(request(`premium-track?module=${moduleId}`));
  expect(await lesson.json()).toMatchObject({ unlocked: true, module: { id: moduleId }, lesson: expect.any(Object) });
  expect(lesson.headers.get('cache-control')).toBe('private, no-store');
});
test('anonymous visitors receive only teasers; an unpaid authenticated user stays locked', async () => {
  const teaser = await premium(request('premium-track', false));
  expect(await teaser.json()).toMatchObject({ pro_required: true });
  expect(query).not.toHaveBeenCalled();
  expect(teaser.headers.get('cache-control')).toBe('private, no-store');
  query.mockResolvedValue([]);
  const response = await premium(request(`premium-track?module=${[...PREMIUM_MODULE_IDS][0]}`));
  const data = await response.json();
  expect(data.pro_required).toBe(true);
  expect(data.lesson).toBeUndefined();
});
test('database failure is an error instead of silently revoking paid access', async () => {
  query.mockRejectedValue(new Error('Database unavailable'));
  await expect(isProUser(3103)).rejects.toThrow('Database unavailable');
  expect((await premium(request('premium-track'))).status).toBe(500);
  expect((await status(request('pro-status'))).status).toBe(500);
});
