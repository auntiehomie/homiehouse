import { NextRequest } from 'next/server';
import { POST } from '@/app/api/upload-image/route';
import { uploadImageToQStorage } from '@/lib/qstorage';

jest.mock('@/lib/auth', () => ({
  verifyFarcasterSignerAuth: jest.fn().mockResolvedValue(123),
}));

jest.mock('@/lib/ratelimit', () => ({
  rateLimit: jest.fn().mockReturnValue({ success: true }),
}));

jest.mock('@/lib/validation', () => ({
  validateImageFile: jest.fn(),
}));

jest.mock('@/lib/errors', () => ({
  handleApiError: jest.fn((_error, message) => Response.json({ error: message }, { status: 500 })),
}));

jest.mock('@/lib/logger', () => ({
  createApiLogger: jest.fn(() => ({
    start: jest.fn(),
    end: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  })),
}));

jest.mock('@/lib/qstorage', () => ({
  getQStorageConfig: jest.fn(() => ({ bucket: 'homiehouse', region: 'q-world-1' })),
  uploadImageToQStorage: jest.fn(),
}));

function makeRequest() {
  const formData = new FormData();
  formData.append('file', new Blob(['test image'], { type: 'image/png' }), 'test.png');
  return new NextRequest('https://homiehouse.app/api/upload-image', { method: 'POST', body: formData });
}

describe('POST /api/upload-image provider fallback', () => {
  const originalPinataJwt = process.env.PINATA_JWT;
  const originalImgbbKey = process.env.IMGBB_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PINATA_JWT = 'test-pinata-jwt';
    delete process.env.IMGBB_API_KEY;
  });

  afterAll(() => {
    if (originalPinataJwt === undefined) delete process.env.PINATA_JWT;
    else process.env.PINATA_JWT = originalPinataJwt;
    if (originalImgbbKey === undefined) delete process.env.IMGBB_API_KEY;
    else process.env.IMGBB_API_KEY = originalImgbbKey;
  });

  it('uses QStorage first when it succeeds', async () => {
    jest.mocked(uploadImageToQStorage).mockResolvedValueOnce({
      key: 'casts/123/test.png',
      url: 'https://homiehouse.qstorage.quilibrium.com/casts/123/test.png',
    });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      Response.json({ IpfsHash: 'bafy-test' }),
    );

    try {
      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ provider: 'qstorage' });
      expect(uploadImageToQStorage).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('falls back to Pinata IPFS when QStorage upload fails', async () => {
    jest.mocked(uploadImageToQStorage).mockRejectedValueOnce(Object.assign(new Error('NoSuchBucket'), {
      name: 'NoSuchBucket',
      Code: 'NoSuchBucket',
      $metadata: { httpStatusCode: 404 },
    }));
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      Response.json({ IpfsHash: 'bafy-fallback' }),
    );

    try {
      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        provider: 'ipfs',
        cid: 'bafy-fallback',
        url: 'https://gateway.pinata.cloud/ipfs/bafy-fallback',
      });
      expect(uploadImageToQStorage).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        expect.objectContaining({ method: 'POST' }),
      );
    } finally {
      fetchMock.mockRestore();
    }
  });
});
