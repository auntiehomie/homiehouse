import {
  encodeMessageData,
  FarcasterNetwork,
  MessageType,
} from '@/lib/fc-message-builder';

describe('Hypersnap message types', () => {
  it('uses the protocol KEY_ADD and KEY_REMOVE discriminants', () => {
    expect(MessageType.KEY_ADD).toBe(16);
    expect(MessageType.KEY_REMOVE).toBe(17);
  });

  it('encodes KEY_ADD as the protocol message type and key_add_body field', () => {
    const data = encodeMessageData({
      type: MessageType.KEY_ADD,
      fid: 123,
      timestamp: 1,
      network: FarcasterNetwork.MAINNET,
      body: { keyAddBody: {
        signerPublicKey: new Uint8Array(32).fill(1),
        custodySignature: new Uint8Array(65).fill(2),
        deadline: 1_800_000_000,
        nonce: 1,
        metadata: new Uint8Array([3, 4]),
        scopes: [1, 2, 3, 4, 5, 6],
        ttl: 2_592_000,
      } },
    });

    // MessageData.type = 16 is encoded as field 1, varint 16 (08 10).
    expect(Array.from(data.slice(0, 2))).toEqual([0x08, 0x10]);
    // MessageData.key_add_body is the oneof field 19 (tag 0x9a 0x01).
    expect(Array.from(data)).toContain(0x9a);
    expect(Array.from(data)).toContain(0x01);
  });
});
