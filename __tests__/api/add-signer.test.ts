import { NextRequest } from 'next/server';

const mockReadContract = jest.fn();
const mockSimulate = jest.fn();
const mockWrite = jest.fn();
const mockCheckRateLimit = jest.fn();

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  createPublicClient: () => ({ readContract: mockReadContract, simulateContract: mockSimulate }),
  createWalletClient: () => ({ writeContract: mockWrite }),
  http: jest.fn(),
}));
jest.mock('viem/accounts', () => ({ privateKeyToAccount: jest.fn(() => ({ address: '0xapp' })) }));
jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  rateLimitKeyFromRequest: () => 'ip:1.2.3.4',
}));

// eslint-disable-next-line import/first
import { POST } from '@/app/api/add-signer/route';
// eslint-disable-next-line import/first
import { AuthError } from '@/lib/errors';

const CUSTODY = '0x' + 'ab'.repeat(20);
const validBody = {
  fid: 1234,
  fidOwner: CUSTODY,
  signerPublicKey: '0x' + '11'.repeat(32),
  signedKeyRequestMetadata: '0x' + '22'.repeat(64),
  keyAddSig: '0x' + '33'.repeat(65),
  keyAddDeadline: 1_900_000_000,
};

function request(body: unknown) {
  return new NextRequest('http://localhost/api/add-signer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/add-signer', () => {
  const originalKey = process.env.APP_WALLET_PRIVATE_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_WALLET_PRIVATE_KEY = '0x' + '44'.repeat(32);
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 1 });
    mockReadContract.mockResolvedValue(CUSTODY);
    mockSimulate.mockResolvedValue({});
    mockWrite.mockResolvedValue('0xtxhash');
  });

  afterAll(() => {
    process.env.APP_WALLET_PRIVATE_KEY = originalKey;
  });

  it('registers a signer when custody matches and limits allow', async () => {
    const res = await POST(request(validBody));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, txHash: '0xtxhash' });
    const keys = mockCheckRateLimit.mock.calls.map((c) => c[0]);
    expect(keys).toEqual(['add-signer:ip:1.2.3.4', 'add-signer:fid:1234', 'add-signer:global']);
  });

  it('requires a fid', async () => {
    const { fid: _fid, ...noFid } = validBody;
    const res = await POST(request(noFid));
    expect(res.status).toBe(400);
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it('rejects malformed hex payloads', async () => {
    const res = await POST(request({ ...validBody, signerPublicKey: '0x1234' }));
    expect(res.status).toBe(400);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('rejects a custody mismatch without sending a transaction', async () => {
    mockReadContract.mockResolvedValueOnce('0x' + 'cd'.repeat(20));
    const res = await POST(request(validBody));
    expect(res.status).toBe(400);
    expect(mockSimulate).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('fails closed when the custody lookup errors', async () => {
    mockReadContract.mockRejectedValueOnce(new Error('rpc down'));
    const res = await POST(request(validBody));
    expect(res.status).toBe(503);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('does not consume per-FID quota when simulation reverts', async () => {
    mockSimulate.mockRejectedValueOnce(Object.assign(new Error('reverted'), { shortMessage: 'addFor reverted' }));
    const res = await POST(request(validBody));
    expect(res.status).toBe(400);
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-FID daily limit is exhausted', async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ success: true, remaining: 9 })
      .mockResolvedValueOnce({ success: false, remaining: 0 });
    const res = await POST(request(validBody));
    expect(res.status).toBe(429);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('returns 429 when the global daily cap is reached', async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ success: true, remaining: 9 })
      .mockResolvedValueOnce({ success: true, remaining: 2 })
      .mockResolvedValueOnce({ success: false, remaining: 0 });
    const res = await POST(request(validBody));
    expect(res.status).toBe(429);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('fails closed (503) when the distributed rate-limit store is unavailable', async () => {
    mockCheckRateLimit.mockRejectedValueOnce(
      new AuthError('Distributed rate limiting is unavailable', 503, 'RATE_LIMIT_STORE_UNAVAILABLE'),
    );
    const res = await POST(request(validBody));
    expect(res.status).toBe(503);
    expect(mockReadContract).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });
});
