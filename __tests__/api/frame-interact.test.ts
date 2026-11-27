import { NextRequest } from 'next/server';
import { ed25519 } from '@noble/curves/ed25519';
import { buildSignedMessage, MessageType } from '@/lib/fc-message-builder';

const mockSafeFetch = jest.fn();
const mockSessionAuth = jest.fn();
const mockVerifyPublicKey = jest.fn();

jest.mock('@/lib/safe-public-fetch', () => ({ safeFetchPublicUrl: (...a: unknown[]) => mockSafeFetch(...a) }));
jest.mock('@/lib/auth', () => ({
  verifyFarcasterSignerAuth: (...a: unknown[]) => mockSessionAuth(...a),
  verifyFarcasterSignerPublicKey: (...a: unknown[]) => mockVerifyPublicKey(...a),
}));

// eslint-disable-next-line import/first
import { POST } from '@/app/api/frame/interact/route';

const privateKey = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const publicKeyHex = `0x${Buffer.from(ed25519.getPublicKey(privateKey)).toString('hex')}`;
const FRAME_URL = 'https://frame.example/f';
const CAST_HASH = `0x${'ab'.repeat(20)}`;

async function signed(overrides: { fid?: number; url?: string; buttonIndex?: number; inputText?: string } = {}) {
  const bytes = await buildSignedMessage({
    type: MessageType.FRAME_ACTION,
    fid: overrides.fid ?? 42,
    body: {
      frameActionBody: {
        url: overrides.url ?? FRAME_URL,
        buttonIndex: overrides.buttonIndex ?? 1,
        castId: { fid: overrides.fid ?? 42, hash: Buffer.from('ab'.repeat(20), 'hex') },
        inputText: overrides.inputText ?? 'hi',
      },
    },
  }, { publicKey: ed25519.getPublicKey(privateKey), sign: async (h) => ed25519.sign(h, privateKey) });
  return Buffer.from(bytes).toString('hex');
}

function request(body: Record<string, unknown>, headers: Record<string, string> = { 'x-session-token': 't' }) {
  return new NextRequest('http://localhost/api/frame/interact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ url: FRAME_URL, postUrl: 'https://frame.example/post', buttonIndex: 1, inputText: 'hi', castHash: CAST_HASH, ...body }),
  });
}

describe('POST /api/frame/interact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionAuth.mockResolvedValue(42);
    mockVerifyPublicKey.mockResolvedValue(42);
    mockSafeFetch.mockResolvedValue(new Response('<html></html>', { status: 200 }));
  });

  it('forwards a browser-signed action and checks its signer', async () => {
    const trustedMessageBytes = await signed();
    const res = await POST(request({ trustedMessageBytes }));
    expect(res.status).toBe(200);
    expect(mockVerifyPublicKey).toHaveBeenCalledWith(42, publicKeyHex);
    const sent = JSON.parse(mockSafeFetch.mock.calls[0][1].body);
    expect(sent.trustedData.messageBytes).toBe(trustedMessageBytes);
    expect(sent.untrustedData.fid).toBe(42);
  });

  it('never uses a private key header', async () => {
    const res = await POST(request({}, { 'x-signer-key': Buffer.from(privateKey).toString('hex') }));
    expect(res.status).toBe(200);
    const sent = JSON.parse(mockSafeFetch.mock.calls[0][1].body);
    expect(sent.trustedData.messageBytes).toBe('');
    expect(mockSessionAuth).not.toHaveBeenCalled();
  });

  it.each([
    ['another FID', { fid: 7 }],
    ['another frame URL', { url: 'https://other.example/f' }],
    ['another button', { buttonIndex: 2 }],
    ['different input', { inputText: 'bye' }],
  ])('rejects a signed action for %s', async (_name, change) => {
    const res = await POST(request({ trustedMessageBytes: await signed(change) }));
    expect(res.status).toBe(400);
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it('rejects a tampered signature', async () => {
    const hex = await signed();
    const tampered = hex.slice(0, -2) + (hex.endsWith('00') ? '01' : '00');
    const res = await POST(request({ trustedMessageBytes: tampered }));
    expect([400, 401]).toContain(res.status);
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });
});
