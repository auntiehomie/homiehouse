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
