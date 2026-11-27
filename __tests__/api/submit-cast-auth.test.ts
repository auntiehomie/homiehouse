import { buildSignedMessage, MessageType } from '@/lib/fc-message-builder';
import { readSignedMessageFid } from '@/app/api/submit-cast/route';

jest.mock('@noble/ed25519', () => ({ getPublicKeyAsync: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/session', () => ({
  verifySession: jest.fn(),
  SessionError: class SessionError extends Error {},
}));

describe('signed message relay ownership', () => {
  it('extracts the author FID from a signed message envelope', async () => {
    const message = await buildSignedMessage(
      { type: MessageType.CAST_REMOVE, fid: 123, body: { castRemoveBody: { targetHash: new Uint8Array(20) } } },
      { publicKey: new Uint8Array(32), sign: async () => new Uint8Array(64) },
    );
    expect(readSignedMessageFid(message)).toBe(123);
  });

  it('rejects malformed envelopes', () => {
    expect(() => readSignedMessageFid(Uint8Array.of(1, 2, 3))).toThrow();
  });
});
