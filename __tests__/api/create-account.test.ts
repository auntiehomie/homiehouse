import { NextRequest } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';

const mockCheckRateLimit = jest.fn();
const mockFetchNodes = jest.fn();

jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  rateLimit: jest.fn(async () => ({ success: true, remaining: 1 })),
  rateLimitKeyFromRequest: () => 'ip:1.2.3.4',
}));
jest.mock('@/lib/hypersnap-nodes', () => {
  class HypersnapUnavailableError extends Error {}
  return {
    fetchFromHypersnapNodes: (...args: unknown[]) => mockFetchNodes(...args),
    HypersnapUnavailableError,
  };
});

// eslint-disable-next-line import/first
import { GET, POST } from '@/app/api/create-account/route';
// eslint-disable-next-line import/first
import { AuthError } from '@/lib/errors';
// eslint-disable-next-line import/first
import { nativeOnboardTypedData } from '@/lib/hypersnap-native';

const account = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const CUSTODY = account.address.toLowerCase();
const ANCHOR = `0x${'42'.repeat(32)}`;
const NATIVE_FID = 4_294_967_301;

const json = (body: unknown, status = 200) => ({
  response: new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  node: { url: 'https://node.example', personal: false },
});

interface NodeState { registered: boolean; submitStatus?: number; submitBody?: unknown }
let node: NodeState;
let submitted: Uint8Array[];

function installNode() {
  mockFetchNodes.mockImplementation(async (path: string, init?: { body?: Buffer }) => {
    if (path === '/v1/nativeRegistration') {
      return json({ active: true, nextBlock: 1001, anchorBlockHeight: 1000, anchorBlockHash: ANCHOR, minDifficultyBits: 6, anchorWindow: 1024 });
    }
    if (path.startsWith('/v1/nativeAccount')) {
      return node.registered
        ? json({ fid: String(NATIVE_FID), custodyAddress: CUSTODY, blockNumber: 1002 })
        : json({ errCode: 'not_found', message: 'no native account' }, 404);
    }
    if (path === '/v1/submitMessage') {
      submitted.push(new Uint8Array(init!.body!));
      if (node.submitStatus && node.submitStatus >= 400) return json(node.submitBody ?? {}, node.submitStatus);
      node.registered = true;
      return json({ hash: '0x00' });
    }
    throw new Error(`unexpected path ${path}`);
  });
}

function getRequest(query: string) {
  return new NextRequest(`http://localhost/api/create-account?${query}`);
}

function postRequest(body: unknown, origin: string | null = 'http://localhost') {
  return new NextRequest('http://localhost/api/create-account', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
}

async function prepare() {
  const res = await GET(getRequest(`address=${CUSTODY}`));
  expect(res.status).toBe(200);
  const prep = await res.json();
  const custodySignature = await account.signTypedData(nativeOnboardTypedData(prep.proof));
  return { prep, custodySignature };
}

describe('/api/create-account (native Hypersnap registration)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SPONSORED_REGISTRATION_DISABLED;
    delete process.env.CREATE_ACCOUNT_DAILY_CAP;
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 1 });
    node = { registered: false };
    submitted = [];
    installNode();
  });
  afterAll(() => { process.env = originalEnv; });

  it('prepares a mined proof and the typed data to sign', async () => {
    const { prep } = await prepare();
    expect(prep.proof).toMatchObject({ custodyAddress: CUSTODY, anchorBlockHeight: 1000, anchorBlockHash: ANCHOR, difficultyBits: 6 });
    expect(prep.typedData.domain).toEqual({ name: 'HypersnapNativeOnboard', version: '1', chainId: 10 });
    expect(prep.typedData.message.anchor_block_height).toBe('1000');
    expect(mockCheckRateLimit.mock.calls.map((c) => c[0])).toEqual(['create-account:prepare:ip:1.2.3.4']);
  });

  it('returns the existing native FID instead of preparing a second account', async () => {
    node.registered = true;
    const res = await GET(getRequest(`address=${CUSTODY}`));
    await expect(res.json()).resolves.toEqual({ existingFid: NATIVE_FID });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it('looks up a wallet\'s native FID', async () => {
    await expect((await GET(getRequest(`lookup=${CUSTODY}`))).json()).resolves.toEqual({ fid: null });
    node.registered = true;
    await expect((await GET(getRequest(`lookup=${CUSTODY}`))).json()).resolves.toEqual({ fid: NATIVE_FID });
  });

  it('submits the signed registration and returns the assigned FID', async () => {
    const { prep, custodySignature } = await prepare();
    const res = await POST(postRequest({ proof: prep.proof, custodySignature }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, fid: NATIVE_FID, native: true });
    expect(submitted).toHaveLength(1);
    expect(mockCheckRateLimit.mock.calls.map((c) => c[0])).toEqual([
      'create-account:prepare:ip:1.2.3.4',
      'create-account:post:ip:1.2.3.4',
      'create-account:post:global',
    ]);
  });

  it('rejects requests without a same-origin Origin header', async () => {
    const { prep, custodySignature } = await prepare();
    expect((await POST(postRequest({ proof: prep.proof, custodySignature }, null))).status).toBe(403);
    expect((await POST(postRequest({ proof: prep.proof, custodySignature }, 'https://evil.example'))).status).toBe(403);
    expect(submitted).toHaveLength(0);
  });

  it('can be paused with SPONSORED_REGISTRATION_DISABLED', async () => {
    process.env.SPONSORED_REGISTRATION_DISABLED = 'true';
    expect((await GET(getRequest(`address=${CUSTODY}`))).status).toBe(503);
    expect((await POST(postRequest({}))).status).toBe(503);
    expect(submitted).toHaveLength(0);
  });

  it('rejects a signature from a different wallet before using any budget', async () => {
    const { prep } = await prepare();
    mockCheckRateLimit.mockClear();
    const other = privateKeyToAccount(`0x${'33'.repeat(32)}`);
    const custodySignature = await other.signTypedData(nativeOnboardTypedData(prep.proof));
    expect((await POST(postRequest({ proof: prep.proof, custodySignature }))).status).toBe(400);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(submitted).toHaveLength(0);
  });

  it('rejects a proof whose nonce does not meet the difficulty', async () => {
    const { prep, custodySignature } = await prepare();
    mockCheckRateLimit.mockClear();
    const proof = { ...prep.proof, difficultyBits: 40 };
    expect((await POST(postRequest({ proof, custodySignature }))).status).toBe(400);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it.each([
    ['bad address', { custodyAddress: '0x1234' }],
    ['bad anchor', { anchorBlockHash: '0xabcd' }],
    ['bad height', { anchorBlockHeight: -1 }],
  ])('rejects a %s', async (_name, change) => {
    const { prep, custodySignature } = await prepare();
    expect((await POST(postRequest({ proof: { ...prep.proof, ...change }, custodySignature }))).status).toBe(400);
    expect(submitted).toHaveLength(0);
  });

  it('stops at the per-IP daily limit', async () => {
    const { prep, custodySignature } = await prepare();
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });
    expect((await POST(postRequest({ proof: prep.proof, custodySignature }))).status).toBe(429);
    expect(submitted).toHaveLength(0);
  });

  it('stops at the global daily cap', async () => {
    const { prep, custodySignature } = await prepare();
    mockCheckRateLimit
      .mockResolvedValueOnce({ success: true, remaining: 1 })
      .mockResolvedValueOnce({ success: false, remaining: 0 });
    expect((await POST(postRequest({ proof: prep.proof, custodySignature }))).status).toBe(429);
    expect(submitted).toHaveLength(0);
  });

  it('passes on an expired anchor as a retryable error', async () => {
    const { prep, custodySignature } = await prepare();
    node.submitStatus = 400;
    node.submitBody = { errCode: 'bad_request.validation_failure', details: 'registration anchor is outside the recent window' };
    const res = await POST(postRequest({ proof: prep.proof, custodySignature }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ retry: true });
  });

  it('fails closed when the rate-limit store is unavailable', async () => {
    mockCheckRateLimit.mockRejectedValue(new AuthError('Distributed rate limiting is unavailable', 503, 'RATE_LIMIT_STORE_UNAVAILABLE'));
    expect((await GET(getRequest(`address=${CUSTODY}`))).status).toBe(503);
  });
});
