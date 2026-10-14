import { sql } from '@/lib/db';
import { createSession, verifySession } from '@/lib/session';
import { jwtVerify } from 'jose';

jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('jose', () => ({
  SignJWT: class {
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    setJti() { return this; }
    async sign() { return 'test-session-token'; }
  },
  jwtVerify: jest.fn(),
}));

const mockSql = sql as jest.Mock;

describe('session revocation store availability', () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeAll(() => {
    process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSql.mockResolvedValue([]);
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: { fid: 42, jti: 'test-session-id', iat: 1_900_000_000, exp: 2_000_000_000 },
    });
  });

  it('rejects a cryptographically valid session when the revocation store is unavailable', async () => {
    const token = await createSession(42);
    mockSql.mockRejectedValue(new Error('database unavailable'));

    await expect(verifySession(token)).rejects.toMatchObject({
      status: 503,
      code: 'SESSION_STORE_UNAVAILABLE',
    });
  });
});
