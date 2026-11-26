import { NextRequest } from 'next/server';
import { GET } from '@/app/api/push/check-notifications/route';
import { fetchNotifications, fetchFeed } from '@/lib/hypersnap';
import { safeFetchPublicUrl } from '@/lib/safe-public-fetch';
import { verifyCronSecret } from '@/lib/auth';
const query = jest.fn();
jest.mock('@/lib/db', () => ({ getDb: () => ({ query }) }));
jest.mock('@/lib/auth', () => ({ verifyCronSecret: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(async () => ({ success: true })) }));
jest.mock('@/lib/hypersnap', () => ({ fetchNotifications: jest.fn(), fetchFeed: jest.fn() }));
jest.mock('@/lib/safe-public-fetch', () => ({ safeFetchPublicUrl: jest.fn() }));
jest.mock('web-push', () => ({ __esModule: true, default: { setVapidDetails: jest.fn(), generateRequestDetails: jest.fn(() => ({ headers: {}, body: Buffer.from('encrypted') })) } }));
const sub = { id: 'device', user_fid: 12, subscription: { endpoint: 'https://push.example.org/device' }, preferences: { replies: true, mentions: true, newCasts: true }, last_notified_at: '2026-01-01', last_cast_notified_at: '2026-01-01' };
beforeEach(() => {
 jest.clearAllMocks();
 process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public'; process.env.VAPID_PRIVATE_KEY = 'private';
 query.mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT id,') ? [sub] : sql.includes('RETURNING id') ? [{ id: sub.id }] : [] }));
 (fetchNotifications as jest.Mock).mockResolvedValue({ notifications: [{ type: 'reply', timestamp: '2026-01-02', cast: { hash: 'reply', text: 'Hello' } }] });
 (fetchFeed as jest.Mock).mockResolvedValue({ casts: [] });
 (safeFetchPublicUrl as jest.Mock).mockResolvedValue({ ok: true, status: 201 });
});
it('authenticates cron, fetches canonical evidence and advances to evidence timestamps only after successful delivery', async () => {
 const res = await GET(new NextRequest('http://localhost/api/push/check-notifications'));
 expect(verifyCronSecret).toHaveBeenCalled();
 expect(await res.json()).toMatchObject({ sent: 1, errors: 0 });
 expect(fetchFeed).toHaveBeenCalledWith(expect.objectContaining({ feed_type: 'following', fid: 12 }));
 const checkpoint = query.mock.calls.find(args => String(args[0]).includes('SET last_notified_at'));
 expect(checkpoint?.[1]).toContain('2026-01-02T00:00:00.000Z');
 expect(String(checkpoint?.[0])).not.toContain('last_notified_at = NOW()');
});
it('keeps watermarks unchanged on delivery failure', async () => {
 (safeFetchPublicUrl as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
 const res = await GET(new NextRequest('http://localhost/api/push/check-notifications'));
 expect(await res.json()).toMatchObject({ sent: 0, errors: 1 });
 expect(query.mock.calls.some(args => String(args[0]).includes('SET last_notified_at'))).toBe(false);
});
it('removes expired subscriptions for 404 as well as 410', async () => {
 (safeFetchPublicUrl as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
 await GET(new NextRequest('http://localhost/api/push/check-notifications'));
 expect(query.mock.calls.some(args => String(args[0]).includes('DELETE FROM push_subscriptions'))).toBe(true);
});
