import { NextRequest } from 'next/server';
import { POST } from '@/app/api/push/subscribe/route';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn(async () => 12) }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(async () => ({ success: true })) }));
const query = jest.fn(async () => ({ rows: [] }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn(() => ({ query })) }));
const subscription = { endpoint: 'https://push.example.org/send/secret', keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'b'.repeat(22) } };
function request(body: unknown) { return new NextRequest('http://localhost/api/push/subscribe', { method: 'POST', body: JSON.stringify(body) }); }
beforeEach(() => jest.clearAllMocks());
it('rejects non-HTTPS push endpoints before touching storage', async () => {
 const response = await POST(request({ fid: 12, subscription: { ...subscription, endpoint: 'http://127.0.0.1/internal' } }));
 expect(response.status).toBe(400); expect(getDb).not.toHaveBeenCalled();
});
it('rejects a mismatched identity', async () => {
 const response = await POST(request({ fid: 13, subscription }));
 expect(response.status).toBe(403); expect(getDb).not.toHaveBeenCalled();
});
it('stores explicit preferences without resetting the notification watermark', async () => {
 const response = await POST(request({ fid: 12, subscription, preferences: { replies: true, mentions: true, newCasts: true } }));
 expect(response.status).toBe(200);
 expect(verifyFarcasterSignerAuth).toHaveBeenCalled();
 const insert = query.mock.calls.find(args => String(args[0]).includes('INSERT INTO push_subscriptions'));
 expect(insert).toBeDefined();
 expect(String(insert?.[0])).not.toContain('last_notified_at = NOW()');
 expect(JSON.stringify(insert)).toContain('newCasts');
});
