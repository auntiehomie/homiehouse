import { NextRequest } from 'next/server';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { verifySession } from '@/lib/session';

jest.mock('@noble/ed25519', () => ({
  getPublicKeyAsync: jest.fn(async () => Uint8Array.from({ length: 32 }, () => 2)),
}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/session', () => ({
  verifySession: jest.fn(),
  SessionError: class SessionError extends Error {},
}));

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

  it('recovers an older signer directly from the Farcaster Key Registry', async () => {
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: `0x${'0'.repeat(63)}1${'0'.repeat(63)}1`,
      }),
    });

    const request = new NextRequest('http://localhost/api/compose/suggestions', {
      method: 'POST',
      headers: {
        'x-farcaster-fid': '123',
        'x-signer-key': `0x${'01'.repeat(32)}`,
      },
    });

    await expect(verifyFarcasterSignerAuth(request)).resolves.toBe(123);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST' }),
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

  it('requires the shop write scope for Stripe mutation routes', async () => {
    (verifySession as jest.Mock).mockResolvedValue({ fid: 123, scopes: ['write:shop'] });
    const request = new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      headers: { 'x-session-token': 'valid-session' },
    });

    await expect(verifyFarcasterSignerAuth(request)).resolves.toBe(123);
    expect(verifySession).toHaveBeenCalledWith('valid-session', 'write:shop');
  });

  it('requires read scope for session-authenticated reads', async () => {
    (verifySession as jest.Mock).mockResolvedValue({ fid: 123, scopes: ['read:all'] });
    const request = new NextRequest('http://localhost/api/pro-status', {
      headers: { 'x-session-token': 'valid-session' },
    });

    await expect(verifyFarcasterSignerAuth(request)).resolves.toBe(123);
    expect(verifySession).toHaveBeenCalledWith('valid-session', 'read:all');
  });

  it('rejects session-authenticated writes without a configured scope mapping', async () => {
    const request = new NextRequest('http://localhost/api/unmapped-write', {
      method: 'POST',
      headers: { 'x-session-token': 'valid-session' },
    });

    await expect(verifyFarcasterSignerAuth(request)).rejects.toMatchObject({
      code: 'SESSION_SCOPE_UNCONFIGURED',
      status: 403,
    });
    expect(verifySession).not.toHaveBeenCalled();
  });
});
