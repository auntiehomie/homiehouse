import { NextRequest } from 'next/server';

const mockReadContract = jest.fn();
const mockSimulate = jest.fn();
const mockWrite = jest.fn();
const mockWaitForReceipt = jest.fn();
const mockCheckRateLimit = jest.fn();

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  createPublicClient: () => ({
    readContract: mockReadContract,
    simulateContract: mockSimulate,
    waitForTransactionReceipt: mockWaitForReceipt,
  }),
  createWalletClient: () => ({ writeContract: mockWrite }),
  decodeEventLog: () => ({ eventName: 'Register', args: { id: 4321n } }),
  http: jest.fn(),
}));
jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(() => ({ address: '0xapp' })),
  mnemonicToAccount: jest.fn(),
}));
jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  rateLimit: jest.fn(async () => ({ success: true, remaining: 1 })),
  rateLimitKeyFromRequest: () => 'ip:1.2.3.4',
}));

// eslint-disable-next-line import/first
import { POST } from '@/app/api/create-account/route';
// eslint-disable-next-line import/first
import { AuthError } from '@/lib/errors';

const CUSTODY = '0x' + 'ab'.repeat(20);
const validBody = () => ({
  custodyAddress: CUSTODY,
  registerSig: '0x' + '33'.repeat(65),
  registerDeadline: Math.floor(Date.now() / 1000) + 86_400,
  username: 'homie_1',
});

function request(body: unknown, origin: string | null = 'http://localhost') {
  return new NextRequest('http://localhost/api/create-account', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
}

describe('POST /api/create-account (sponsored registration)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, APP_WALLET_PRIVATE_KEY: '0x' + '44'.repeat(32) };
    delete process.env.SPONSORED_REGISTRATION_DISABLED;
    delete process.env.CREATE_ACCOUNT_DAILY_CAP;
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 1 });
    mockReadContract.mockResolvedValue(1000n);
    mockSimulate.mockResolvedValue({});
    mockWrite.mockResolvedValue('0xtx');
    mockWaitForReceipt.mockResolvedValue({ logs: [{ data: '0x', topics: [] }] });
  });
  afterAll(() => { process.env = originalEnv; });

  it('registers once per-IP and global limits allow, and pays for no signer transaction', async () => {
    const res = await POST(request(validBody()));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, fid: 4321, signerTxHash: null });
    expect(mockCheckRateLimit.mock.calls.map((c) => c[0])).toEqual([
      'create-account:post:ip:1.2.3.4',
      'create-account:post:global',
    ]);
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWrite.mock.calls[0][0].functionName).toBe('registerFor');
  });

  it('rejects requests without a same-origin Origin header', async () => {
    expect((await POST(request(validBody(), null))).status).toBe(403);
    expect((await POST(request(validBody(), 'https://evil.example'))).status).toBe(403);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('can be paused with SPONSORED_REGISTRATION_DISABLED', async () => {
    process.env.SPONSORED_REGISTRATION_DISABLED = 'true';
    expect((await POST(request(validBody()))).status).toBe(503);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it.each([
    ['bad address', { custodyAddress: '0x1234' }],
    ['bad signature', { registerSig: '0xabcd' }],
    ['expired deadline', { registerDeadline: 1 }],
    ['far-future deadline', { registerDeadline: Math.floor(Date.now() / 1000) + 30 * 86_400 }],
    ['bad username', { username: 'Not Valid!' }],
  ])('rejects a %s before spending', async (_name, change) => {
    const res = await POST(request({ ...validBody(), ...change }));
    expect(res.status).toBe(400);
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it('stops at the per-IP daily limit', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });
    expect((await POST(request(validBody()))).status).toBe(429);
    expect(mockSimulate).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('does not spend or use the daily budget when the dry run reverts', async () => {
    mockSimulate.mockRejectedValue(Object.assign(new Error('revert'), { shortMessage: 'HasId()' }));
    const res = await POST(request(validBody()));
    expect(res.status).toBe(400);
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockCheckRateLimit.mock.calls.map((c) => c[0])).toEqual(['create-account:post:ip:1.2.3.4']);
  });

  it('stops at the global daily cap', async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ success: true, remaining: 1 })
      .mockResolvedValueOnce({ success: false, remaining: 0 });
    expect((await POST(request(validBody()))).status).toBe(429);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('fails closed when the rate-limit store is unavailable', async () => {
    mockCheckRateLimit.mockRejectedValue(new AuthError('Distributed rate limiting is unavailable', 503, 'RATE_LIMIT_STORE_UNAVAILABLE'));
    expect((await POST(request(validBody()))).status).toBe(503);
    expect(mockWrite).not.toHaveBeenCalled();
  });
});
