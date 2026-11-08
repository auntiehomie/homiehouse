import { NextRequest } from 'next/server';
import { GET as botStatus } from '@/app/api/bot/status/route';
import { GET as botTestReply } from '@/app/api/bot/test-reply/route';
import { GET as llmDiagnostic } from '@/app/api/llm-diag/route';
import { GET as scheduledGet, POST as scheduledPost, PUT as scheduledPut } from '@/app/api/publish-scheduled-casts/route';
import { GET as pushCron } from '@/app/api/push/check-notifications/route';
import { getDb, sql } from '@/lib/db';
import { fetchNotifications } from '@/lib/hypersnap';
import { getLLMProviders } from '@/lib/llm';
import { safeFetchPublicUrl } from '@/lib/safe-public-fetch';
import webpush from 'web-push';

jest.mock('@noble/ed25519', () => ({}));
jest.mock('@noble/curves/ed25519', () => ({}));
jest.mock('@/lib/session', () => ({}));
jest.mock('@/lib/hypersnap-signer-auth', () => ({}));
jest.mock('@/lib/fc-message-builder', () => ({}));
jest.mock('@/lib/signer-crypto', () => ({}));
jest.mock('@/lib/db', () => ({ getDb: jest.fn(), sql: jest.fn() }));
jest.mock('@/lib/hypersnap', () => ({ fetchNotifications: jest.fn() }));
jest.mock('@/lib/llm', () => ({ getLLMProviders: jest.fn() }));
jest.mock('@/lib/safe-public-fetch', () => ({ safeFetchPublicUrl: jest.fn() }));
jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), generateRequestDetails: jest.fn() }));

const secret = 'test-cron-secret'.repeat(3);
const originalEnv = process.env;
const privilegedHandlers = [botStatus, llmDiagnostic, scheduledGet, scheduledPost, scheduledPut, pushCron];

beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...originalEnv, NODE_ENV: 'production', CRON_SECRET: secret };
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

it('retires the bot write diagnostic', () => {
  expect(botTestReply().status).toBe(410);
});

it('rejects requests carrying a forged cron marker before running privileged work', async () => {
  const request = new NextRequest('https://example.com', { headers: { 'x-vercel-cron': '1' } });
  for (const handler of privilegedHandlers) {
    expect((await handler(request)).status).toBe(401);
  }
  expect(sql).not.toHaveBeenCalled();
  expect(getDb).not.toHaveBeenCalled();
  expect(fetchNotifications).not.toHaveBeenCalled();
  expect(getLLMProviders).not.toHaveBeenCalled();
});

it('fails closed in production when the cron secret is missing', async () => {
  delete process.env.CRON_SECRET;
  const request = new NextRequest('https://example.com');
  for (const handler of privilegedHandlers) {
    expect((await handler(request)).status).toBeGreaterThanOrEqual(500);
  }
  expect(sql).not.toHaveBeenCalled();
  expect(getDb).not.toHaveBeenCalled();
  expect(fetchNotifications).not.toHaveBeenCalled();
  expect(getLLMProviders).not.toHaveBeenCalled();
});

it('checks stored push destinations at delivery and preserves sent and expired bookkeeping', async () => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public';
  process.env.VAPID_PRIVATE_KEY = 'private';
  const endpoints = ['http://127.0.0.1', 'https://push.example.com/sent', 'https://push.example.com/gone'];
  const rows = endpoints.map((endpoint, id) => ({
    id, user_fid: 123, subscription: { endpoint }, last_notified_at: '2020-01-01',
  }));
  const query = jest.fn().mockResolvedValueOnce({ rows }).mockResolvedValue({ rows: [] });
  jest.mocked(getDb).mockReturnValue({ query } as unknown as ReturnType<typeof getDb>);
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    Response.json({ notifications: [{ timestamp: '2026-01-01' }] }),
  );
  const body = Buffer.from('encrypted');
  jest.mocked(webpush.generateRequestDetails).mockReturnValue({
    method: 'POST', endpoint: endpoints[1], headers: { Authorization: 'vapid example' }, body,
  });
  jest.mocked(safeFetchPublicUrl)
    .mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(new Response(null, { status: 410 }));

  const request = new NextRequest('https://example.com', { headers: { authorization: `Bearer ${secret}` } });
  expect(await (await pushCron(request)).json()).toEqual({ ok: true, sent: 1, errors: 2 });
  expect(safeFetchPublicUrl).toHaveBeenCalledTimes(2);
  expect(safeFetchPublicUrl).toHaveBeenNthCalledWith(1, new URL(endpoints[1]), expect.objectContaining({
    method: 'POST', maxRedirects: 0, body,
  }));
  expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE push_subscriptions'), [1]);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM push_subscriptions'), [2]);
});
