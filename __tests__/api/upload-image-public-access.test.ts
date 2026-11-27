import { NextRequest } from 'next/server';
import { S3Client } from '@aws-sdk/client-s3';
import { POST } from '@/app/api/upload-image/route';
import { safeFetchPublicUrl } from '@/lib/safe-public-fetch';

jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn(async () => 3103) }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: true }) }));
jest.mock('@/lib/logger', () => ({ createApiLogger: () => ({
  start: jest.fn(), info: jest.fn(), success: jest.fn(), end: jest.fn(),
  error: jest.fn(), warn: jest.fn(),
}) }));
jest.mock('@/lib/safe-public-fetch', () => ({ safeFetchPublicUrl: jest.fn() }));

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');

function request() {
  const form = new FormData();
  form.append('file', new File([png], 'photo.png', { type: 'image/png' }));
  form.append('fid', '3103');
  return new NextRequest('https://homiehouse.app/api/upload-image', { method: 'POST', body: form });
}

describe('cast photo public access fallback', () => {
  const savedEnv = process.env;
  beforeEach(() => {
    process.env = { ...savedEnv, QSTORAGE_ACCESS_KEY_ID: 'test', QSTORAGE_SECRET_ACCESS_KEY: 'test',
      QSTORAGE_BUCKET: 'homiehouse-media', PINATA_JWT: 'test' };
    delete process.env.IMGBB_API_KEY;
    delete process.env.NEXT_PUBLIC_PINATA_GATEWAY;
    jest.spyOn(S3Client.prototype, 'send').mockImplementation(async () => ({}));
  });
  afterEach(() => {
    process.env = savedEnv;
    jest.restoreAllMocks();
    jest.mocked(safeFetchPublicUrl).mockReset();
  });

  it('uses IPFS when PUT succeeds but anonymous QStorage access is denied', async () => {
    jest.mocked(safeFetchPublicUrl).mockResolvedValue(new Response('AccessDenied', { status: 403 }));
    const fallback = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ IpfsHash: 'bafy-test' }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, provider: 'ipfs', url: 'https://gateway.pinata.cloud/ipfs/bafy-test' });
    expect(fallback).toHaveBeenCalledWith('https://api.pinata.cloud/pinning/pinFileToIPFS', expect.any(Object));
  });

  it('returns QStorage only when the public image is verified', async () => {
    jest.mocked(safeFetchPublicUrl).mockResolvedValue(new Response(png, { headers: { 'Content-Type': 'image/png' } }));
    const fallback = jest.spyOn(globalThis, 'fetch');
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ ok: true, provider: 'qstorage' });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('fails instead of returning the denied URL when no fallback is available', async () => {
    delete process.env.PINATA_JWT;
    jest.mocked(safeFetchPublicUrl).mockResolvedValue(new Response('AccessDenied', { status: 403 }));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty('url');
  });
});
