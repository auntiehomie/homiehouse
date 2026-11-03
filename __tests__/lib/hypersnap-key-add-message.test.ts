import { ed25519 } from '@noble/curves/ed25519';
import { encodeKeyAddSignedMessage, isValidKeyAddTimestamp } from '@/lib/hypersnap-key-add-message';

describe('Hypersnap KEY_ADD signer proofs', () => {
  const privateKey = new Uint8Array(32).fill(7);
  const publicKey = ed25519.getPublicKey(privateKey);
  const message = {
    timestamp: 150_000_000,
    fid: 123,
    signerPublicKey: publicKey,
    custodySignature: new Uint8Array(65).fill(9),
    deadline: 1_900_000_000,
    nonce: 2,
    metadata: new Uint8Array([1, 2, 3]),
    scopes: [1, 2, 3, 4, 5, 6],
    ttl: 2_592_000,
  };

  it('verifies the exact browser-signed message even after server time advances', () => {
    const client = encodeKeyAddSignedMessage(message);
    const proof = ed25519.sign(client.hash, privateKey);

    // The server must use the timestamp that was signed, not a fresh clock read.
    const server = encodeKeyAddSignedMessage({ ...message });
    expect(Array.from(server.dataBytes)).toEqual(Array.from(client.dataBytes));
    expect(ed25519.verify(proof, server.hash, publicKey)).toBe(true);

    const independentlyTimestamped = encodeKeyAddSignedMessage({
      ...message,
      timestamp: message.timestamp + 1,
    });
    expect(ed25519.verify(proof, independentlyTimestamped.hash, publicKey)).toBe(false);
  });

  it('enforces a bounded, integral Farcaster timestamp', () => {
    const now = 150_000_000;
    expect(isValidKeyAddTimestamp(now, now)).toBe(true);
    expect(isValidKeyAddTimestamp(now - 300, now)).toBe(true);
    expect(isValidKeyAddTimestamp(now + 300, now)).toBe(true);
    for (const value of [undefined, null, '150000000', NaN, 0.5, -1, now - 301, now + 301]) {
      expect(isValidKeyAddTimestamp(value, now)).toBe(false);
    }
  });
});
