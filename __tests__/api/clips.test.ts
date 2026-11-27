import { NextRequest } from 'next/server';
import { GET } from '@/app/api/clips/route';
import { POST } from '@/app/api/clips/upload/route';
import { CLIPS_PARENT, CLIP_LIMIT } from '@/lib/clips';
import { hypersnapFetch, fallbackFetch } from '@/lib/hypersnap';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { AuthError } from '@/lib/errors';

jest.mock('@/lib/hypersnap', () => ({ hypersnapFetch: jest.fn(), fallbackFetch: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ checkRateLimit: jest.fn() }));
const savedEnv = process.env;
beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...savedEnv, PINATA_JWT: 'test-storage-key' };
});
afterEach(() => { process.env = savedEnv; jest.restoreAllMocks(); });

it('reads the same parent used for publishing, filters non-video casts, and preserves pagination', async () => {
  jest.mocked(hypersnapFetch).mockRejectedValue(new Error('offline'));
  const url = 'https://gateway.pinata.cloud/ipfs/bafyabcd?filename=clip.mp4';
  const message = (url: string) => ({ hash: '0x123', data: { fid: 42, castAddBody: { text: 'Hello', embeds: [{ url }] } } });
  jest.mocked(fallbackFetch).mockResolvedValue({ messages: [message(url), message('https://example.com/photo.png')], nextPageToken: 'next' });
  const response = await GET(new NextRequest('https://homiehouse.app/api/clips?cursor=a%2Bb'));
  const query = new URL(String(jest.mocked(fallbackFetch).mock.calls[0][0]), 'https://hub.test').searchParams;
  expect(query.get('url')).toBe(CLIPS_PARENT);
  expect(query.get('pageToken')).toBe('a+b');
  expect(await response.json()).toEqual({ clips: [{ hash: '0x123', fid: 42, caption: 'Hello', url }], cursor: 'next' });
});

it('requires cast-write authorization before issuing upload access', async () => {
  jest.mocked(verifyFarcasterSignerAuth).mockRejectedValue(new AuthError('Please sign in', 401));
  const fetch = jest.spyOn(globalThis, 'fetch');
  expect((await POST(new NextRequest('https://homiehouse.app/api/clips/upload'))).status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});

it('issues a restricted upload ticket without returning the storage credential', async () => {
  jest.mocked(verifyFarcasterSignerAuth).mockResolvedValue(42);
  jest.mocked(checkRateLimit).mockResolvedValue({ success: true, remaining: 9 });
  const url = 'https://uploads.pinata.cloud/test-ticket';
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: url }));
  const response = await POST(new NextRequest('https://homiehouse.app/api/clips/upload'));
  const options = fetch.mock.calls[0][1];
  expect(JSON.parse(String(options?.body))).toMatchObject({ network: 'public', max_file_size: CLIP_LIMIT, expires: 120, allow_mime_types: ['video/mp4', 'video/webm', 'video/quicktime'] });
  expect(await response.json()).toEqual({ url });
});
