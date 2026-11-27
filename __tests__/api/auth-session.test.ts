import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/session/route';
import { verifyFarcasterSignerKey, verifyFarcasterSignerPublicKey } from '@/lib/auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { createSignerProofHeaders } from '@/lib/signer-proof';
import { createSession, verifySession } from '@/lib/session';
import { AuthError } from '@/lib/errors';
import {
  getHomieHouseAuthDomain,
  verifyHypersnapProtocolToken,
} from '@/lib/hypersnap-protocol-auth';

jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerKey: jest.fn(), verifyFarcasterSignerPublicKey: jest.fn() }));
jest.mock('@/lib/hypersnap-protocol-auth', () => ({
  getHomieHouseAuthDomain: jest.fn().mockReturnValue('homiehouse.app'),
  verifyHypersnapProtocolToken: jest.fn(),
}));
jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true }),
  rateLimitKeyFromRequest: () => 'ip:127.0.0.1',
}));
jest.mock('@/lib/session', () => ({
  createSession: jest.fn(),
  verifySession: jest.fn(),
  revokeSession: jest.fn(),
  refreshSession: jest.fn(),
  SessionError: class SessionError extends Error {},
}));

const mockVerifyAuth = verifyFarcasterSignerKey as jest.Mock;
const mockCreateSession = createSession as jest.Mock;
const mockVerifySession = verifySession as jest.Mock;
const mockVerifyProtocolToken = verifyHypersnapProtocolToken as jest.Mock;

describe('POST /api/auth/session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSession.mockResolvedValue('signed-token');
    mockVerifySession.mockResolvedValue({ fid: 42, exp: 2_000_000_000 });
    mockVerifyProtocolToken.mockResolvedValue({
      fid: 42,
      address: '0x1111111111111111111111111111111111111111',
      method: 'authAddress',
      expiresAt: 2_000_000_000_000,
    });
  });

  it('rejects session-token-only session minting', async () => {
    const request = new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-token': 'old-token',
      },
      body: JSON.stringify({ fid: 42 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mockVerifyAuth).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('rejects an unverified FID and does not create a token', async () => {
    mockVerifyAuth.mockRejectedValue(
      new AuthError('Missing auth headers', 401, 'MISSING_AUTH_HEADERS'),
    );
    const request = new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fid: 42 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('only issues a session for the FID proven by an approved signer', async () => {
    mockVerifyAuth.mockResolvedValue(42);
    const request = new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-farcaster-fid': '42',
        'x-signer-key': 'approved-key',
      },
      body: JSON.stringify({ fid: 43 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('issues a session after signer verification matches the requested FID', async () => {
    mockVerifyAuth.mockResolvedValue(42);
    const request = new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-farcaster-fid': '42',
        'x-signer-key': 'approved-key',
      },
      body: JSON.stringify({ fid: 42 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockVerifyAuth).toHaveBeenCalledWith(42, 'approved-key');
    expect(mockCreateSession).toHaveBeenCalledWith(42, expect.any(Object));
    expect(mockCreateSession.mock.calls[0][1]).not.toHaveProperty('scopes');
  });

  it('issues a session from the FID verified in a Hypersnap protocol token', async () => {
    const request = new NextRequest('https://homiehouse.app/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocolToken: 'hqa1.signed-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(getHomieHouseAuthDomain).toHaveBeenCalled();
    expect(mockVerifyProtocolToken).toHaveBeenCalledWith(
      'hqa1.signed-token',
      'homiehouse.app',
    );
    expect(mockVerifyAuth).not.toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ scopes: ['read:all'] }),
    );
  });

  it('does not mint a session when a supplied FID conflicts with the verified token', async () => {
    const request = new NextRequest('https://homiehouse.app/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocolToken: 'hqa1.signed-token', fid: 43 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('maps an invalid protocol token to 401 without creating a session', async () => {
    mockVerifyProtocolToken.mockRejectedValue(
      new AuthError('Invalid token', 401, 'INVALID_PROTOCOL_TOKEN'),
    );
    const request = new NextRequest('https://homiehouse.app/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocolToken: 'hqa1.bad' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('maps a Hypersnap outage to 503 without creating a session', async () => {
    mockVerifyProtocolToken.mockRejectedValue(
      new AuthError('Hypersnap unavailable', 503, 'HYPERSNAP_AUTH_UNAVAILABLE'),
    );
    const request = new NextRequest('https://homiehouse.app/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocolToken: 'hqa1.valid-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(503);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  describe('signer proof (private key stays in the browser)', () => {
    const privateKey = '07'.repeat(32);
    const mockVerifyPublicKey = verifyFarcasterSignerPublicKey as jest.Mock;
    const proofRequest = (headers: Record<string, string>, fid = 42) => new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-farcaster-fid': String(fid), ...headers },
      body: JSON.stringify({ fid }),
    });

    beforeEach(() => {
      mockVerifyPublicKey.mockResolvedValue(42);
      (checkRateLimit as jest.Mock).mockResolvedValue({ success: true });
    });

    it('issues a session from a valid proof without receiving the private key', async () => {
      const headers = createSignerProofHeaders(42, privateKey, 'localhost');
      const response = await POST(proofRequest(headers));
      expect(response.status).toBe(200);
      expect(mockVerifyPublicKey).toHaveBeenCalledWith(42, headers['x-signer-public-key']);
      expect(mockVerifyAuth).not.toHaveBeenCalled();
      expect(Object.values(headers).join()).not.toContain(privateKey);
    });

    it('rejects a proof signed for another FID', async () => {
      const response = await POST(proofRequest(createSignerProofHeaders(43, privateKey, 'localhost'), 42));
      expect(response.status).toBe(401);
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('rejects a proof signed for another site', async () => {
      const response = await POST(proofRequest(createSignerProofHeaders(42, privateKey, 'evil.example')));
      expect(response.status).toBe(401);
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('rejects an expired proof', async () => {
      const headers = createSignerProofHeaders(42, privateKey, 'localhost', Date.now() - 10 * 60_000);
      const response = await POST(proofRequest(headers));
      expect(response.status).toBe(401);
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('rejects a replayed proof', async () => {
      (checkRateLimit as jest.Mock)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false });
      const response = await POST(proofRequest(createSignerProofHeaders(42, privateKey, 'localhost')));
      expect(response.status).toBe(401);
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('rejects a key that is not an approved signer', async () => {
      mockVerifyPublicKey.mockRejectedValue(new AuthError('Invalid or unapproved signer key for this FID', 401, 'INVALID_SIGNER_KEY'));
      const response = await POST(proofRequest(createSignerProofHeaders(42, privateKey, 'localhost')));
      expect(response.status).toBe(401);
      expect(mockCreateSession).not.toHaveBeenCalled();
    });
  });
});
