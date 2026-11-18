import { S3Client } from '@aws-sdk/client-s3';
import { safeFetchPublicUrl } from '@/lib/safe-public-fetch';
import { buildQStorageImageUrl, createQStorageS3Client, getQStorageConfig, uploadImageToQStorage, verifyQStoragePublicImage } from '@/lib/qstorage';

describe('QStorage configuration and media URLs', () => {
  it('disables QStorage when no credentials are configured', () => {
    expect(getQStorageConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('rejects partial QStorage credentials', () => {
    expect(() => getQStorageConfig({ QSTORAGE_BUCKET: 'homiehouse-media' } as NodeJS.ProcessEnv))
      .toThrow('QStorage requires');
  });

  it('uses QStorage global region by default', () => {
    expect(getQStorageConfig({
      QSTORAGE_ACCESS_KEY_ID: 'access-key',
      QSTORAGE_SECRET_ACCESS_KEY: 'secret-key',
      QSTORAGE_BUCKET: 'homiehouse-media',
    } as NodeJS.ProcessEnv)).toMatchObject({
      endpoint: 'https://qstorage.quilibrium.com',
      region: 'q-world-1',
      publicBaseUrl: 'https://homiehouse-media.qstorage.quilibrium.com',
      bucket: 'homiehouse-media',
    });
  });

  it('allows an explicit QStorage region override', () => {
    expect(getQStorageConfig({
      QSTORAGE_ACCESS_KEY_ID: 'access-key',
      QSTORAGE_SECRET_ACCESS_KEY: 'secret-key',
      QSTORAGE_BUCKET: 'homiehouse-media',
      QSTORAGE_REGION: 'custom-region',
    } as NodeJS.ProcessEnv)?.region).toBe('custom-region');
  });

  it('uses path-style requests for the QStorage API', () => {
    const config = getQStorageConfig({
      QSTORAGE_ACCESS_KEY_ID: 'access-key',
      QSTORAGE_SECRET_ACCESS_KEY: 'secret-key',
      QSTORAGE_BUCKET: 'homiehouse-media',
    } as NodeJS.ProcessEnv)!;
    const client = createQStorageS3Client(config);
    try {
      expect(client.config.forcePathStyle).toBe(true);
    } finally {
      client.destroy();
    }
  });

  it('encodes each object-key path segment while preserving folder separators', () => {
    expect(buildQStorageImageUrl('casts/123/photo one.png', 'https://media.example.test/'))
      .toBe('https://media.example.test/casts/123/photo%20one.png');
  });
});


jest.mock('@/lib/safe-public-fetch', () => ({ safeFetchPublicUrl: jest.fn() }));

const publicFetch = jest.mocked(safeFetchPublicUrl);

describe('public cast image verification', () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const url = 'https://media.example.test/casts/3103/photo.png';

  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => publicFetch.mockReset());

  it('accepts only the original image fetched anonymously from the permanent URL', async () => {
    publicFetch.mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'image/png' } }));
    await expect(verifyQStoragePublicImage(url, bytes)).resolves.toBeUndefined();
    expect(publicFetch).toHaveBeenCalledWith(url, {
      headers: { 'Cache-Control': 'no-cache' }, timeoutMs: 10000,
      maxBytes: bytes.length, maxRedirects: 0,
    });
  });

  it.each([403, 404, 500])('rejects public HTTP %s even after a successful upload', async (status) => {
    publicFetch.mockResolvedValue(new Response('AccessDenied', { status }));
    await expect(verifyQStoragePublicImage(url, bytes)).rejects.toThrow(`HTTP ${status}`);
  });

  it('rejects an error page returned with HTTP 200', async () => {
    publicFetch.mockResolvedValue(new Response('AccessDenied', { headers: { 'Content-Type': 'application/xml' } }));
    await expect(verifyQStoragePublicImage(url, bytes)).rejects.toThrow('did not return an image');
  });

  it('rejects a different or truncated image', async () => {
    publicFetch.mockResolvedValue(new Response(new Uint8Array([137, 80]), { headers: { 'Content-Type': 'image/png' } }));
    await expect(verifyQStoragePublicImage(url, bytes)).rejects.toThrow('different image bytes');
  });

  it('propagates network failures so the upload route can fall back', async () => {
    publicFetch.mockRejectedValue(new Error('Request timed out'));
    await expect(verifyQStoragePublicImage(url, bytes)).rejects.toThrow('Request timed out');
  });

  it('does not return an inaccessible URL when the authenticated PUT succeeds', async () => {
    const savedEnv = process.env;
    process.env = { ...savedEnv, QSTORAGE_ACCESS_KEY_ID: 'test', QSTORAGE_SECRET_ACCESS_KEY: 'test', QSTORAGE_BUCKET: 'homiehouse-media' };
    const send = jest.spyOn(S3Client.prototype, 'send').mockImplementation(async () => ({}));
    publicFetch.mockResolvedValue(new Response('AccessDenied', { status: 403 }));
    try {
      await expect(uploadImageToQStorage(new File([bytes], 'photo.png', { type: 'image/png' }), '3103'))
        .rejects.toThrow('HTTP 403');
      expect(send).toHaveBeenCalledTimes(1);
      expect(publicFetch).toHaveBeenCalledWith(expect.stringMatching(/\/casts\/3103\/.*\.png$/), expect.any(Object));
    } finally {
      process.env = savedEnv;
    }
  });
});
