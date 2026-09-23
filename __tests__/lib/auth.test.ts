import { NextRequest } from 'next/server';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { sql } from '@/lib/db';

jest.mock('@noble/ed25519', () => ({
  getPublicKeyAsync: jest.fn(async () => Uint8Array.from({ length: 32 }, () => 2)),
}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));

const mockSql = sql as jest.Mock;

describe('Farcaster signer authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSql.mockResolvedValue([{ id: 'approved-signer' }]);
    global.fetch = jest.fn();
  });

  it('derives a public key and accepts an approved signer', async () => {
    const request = new NextRequest('http://localhost/api/compose/suggestions', {
      method: 'POST',
      headers: {
        'x-farcaster-fid': '123',
        'x-signer-key': `0x${'01'.repeat(32)}`,
      },
    });

    await expect(verifyFarcasterSignerAuth(request)).resolves.toBe(123);
    expect(mockSql).toHaveBeenCalled();
  });

  it('recovers an approved signer when the local cache is empty', async () => {
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          signedKeyRequest: {
            state: 'completed',
            userFid: 123,
            key: `0x${'02'.repeat(32)}`,
          },
        },
      }),
    });

    const request = new NextRequest('http://localhost/api/compose/suggestions', {
      method: 'POST',
      headers: {
        'x-farcaster-fid': '123',
        'x-signer-key': `0x${'01'.repeat(32)}`,
        'x-signer-uuid': 'approved-request-token',
      },
    });

    await expect(verifyFarcasterSignerAuth(request)).resolves.toBe(123);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.warpcast.com/v2/signed-key-request?token=approved-request-token',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed signer keys before querying for approval', async () => {
    const request = new NextRequest('http://localhost/api/compose/suggestions', {
      method: 'POST',
      headers: {
        'x-farcaster-fid': '123',
        'x-signer-key': 'not-a-private-key',
      },
    });

    await expect(verifyFarcasterSignerAuth(request)).rejects.toMatchObject({
      code: 'INVALID_SIGNER_KEY',
      status: 401,
    });
    expect(mockSql).not.toHaveBeenCalled();
  });
});
