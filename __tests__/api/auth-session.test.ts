import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/session/route';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { createSession, verifySession } from '@/lib/session';
import { AuthError } from '@/lib/errors';

jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn() }));
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

const mockVerifyAuth = verifyFarcasterSignerAuth as jest.Mock;
const mockCreateSession = createSession as jest.Mock;
const mockVerifySession = verifySession as jest.Mock;

describe('POST /api/auth/session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSession.mockResolvedValue('signed-token');
    mockVerifySession.mockResolvedValue({ fid: 42, exp: 2_000_000_000 });
  });

  it('rejects session-token-only session minting', async () => {
    const request = new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-session-token': 'old-token' },
      body: JSON.stringify({ fid: 42 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mockVerifyAuth).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('rejects an unverified FID and does not create a token', async () => {
    mockVerifyAuth.mockRejectedValue(new AuthError('Missing auth headers', 401, 'MISSING_AUTH_HEADERS'));
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
    expect(mockCreateSession).toHaveBeenCalledWith(42, expect.any(Object));
  });
});
