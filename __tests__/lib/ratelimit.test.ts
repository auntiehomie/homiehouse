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
