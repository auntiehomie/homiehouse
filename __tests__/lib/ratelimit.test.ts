import { checkRateLimit, enforceRateLimit } from '@/lib/ratelimit';

describe('checkRateLimit preview fallback', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    if (originalUpstashUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUpstashUrl;
    if (originalUpstashToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalUpstashToken;
  });

  it('uses the in-memory limiter for an opted-in Vercel Preview request', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'preview';

    const key = `preview-test:${Date.now()}`;
    await expect(checkRateLimit(key, 1, 60, { allowInMemoryPreview: true })).resolves.toEqual({
      success: true,
      remaining: 0,
    });
    await expect(checkRateLimit(key, 1, 60, { allowInMemoryPreview: true })).resolves.toEqual({
      success: false,
      remaining: 0,
    });
  });

  it('keeps production fail-closed when distributed limiting is unavailable', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';

    await expect(checkRateLimit(`production-test:${Date.now()}`, 1, 60, { allowInMemoryPreview: true }))
      .rejects.toMatchObject({ code: 'RATE_LIMIT_STORE_UNAVAILABLE', status: 503 });
  });
  it('permits public read route opt-in in Preview and still rejects it in Production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'preview';
    await expect(enforceRateLimit({ key: 'preview-public-feed', allowInMemoryPreview: true })).resolves.toBeUndefined();
    process.env.VERCEL_ENV = 'production';
    await expect(enforceRateLimit({ key: 'production-public-feed', allowInMemoryPreview: true }))
      .rejects.toMatchObject({ status: 503, code: 'RATE_LIMIT_STORE_UNAVAILABLE' });
  });
});

describe('legacy rateLimit()', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@upstash/ratelimit');
    jest.dontMock('@upstash/redis');
    process.env.NODE_ENV = originalNodeEnv;
    if (originalUpstashUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUpstashUrl;
    if (originalUpstashToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalUpstashToken;
  });

  function loadWithUpstash(limitImpl: jest.Mock) {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    const Ratelimit = Object.assign(jest.fn(() => ({ limit: limitImpl })), { slidingWindow: jest.fn() });
    jest.doMock('@upstash/ratelimit', () => ({ Ratelimit }));
    jest.doMock('@upstash/redis', () => ({ Redis: jest.fn() }));
    let mod: typeof import('@/lib/ratelimit');
    jest.isolateModules(() => { mod = require('@/lib/ratelimit'); });
    return mod!;
  }

  it('uses the shared Upstash store when configured', async () => {
    const limit = jest.fn().mockResolvedValue({ success: false, remaining: 0 });
    const { rateLimit } = loadWithUpstash(limit);
    await expect(rateLimit('legacy-upstash', 5, 60)).resolves.toEqual({ success: false, remaining: 0 });
    expect(limit).toHaveBeenCalledWith('legacy-upstash');
  });

  it('falls back to in-memory limiting when Upstash errors', async () => {
    const limit = jest.fn().mockRejectedValue(new Error('redis down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { rateLimit } = loadWithUpstash(limit);
    const key = `legacy-fallback:${Date.now()}`;
    await expect(rateLimit(key, 1, 60)).resolves.toEqual({ success: true, remaining: 0 });
    await expect(rateLimit(key, 1, 60)).resolves.toEqual({ success: false, remaining: 0 });
    errorSpy.mockRestore();
  });

  it('stays available in production without Upstash (per-instance fallback)', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = 'production';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let mod: typeof import('@/lib/ratelimit');
    jest.isolateModules(() => { mod = require('@/lib/ratelimit'); });
    await expect(mod!.rateLimit(`legacy-noconfig:${Date.now()}`, 2, 60)).resolves.toEqual({ success: true, remaining: 1 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
