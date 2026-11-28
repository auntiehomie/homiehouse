import { Message, MessageType as CoreMessageType, UserDataType as CoreUserDataType } from '@farcaster/core';
import { ed25519 } from '@noble/curves/ed25519';
import { blake3_20 } from '@/lib/fc-message-builder';
import { buildDisplayNameMessage } from '@/lib/profile-publish';

jest.mock('@/lib/client-auth', () => ({ ensureAuthHeaders: jest.fn() }));

describe('display name publishing', () => {
  const privateKeyHex = '07'.repeat(32);

  it('builds a signed USER_DATA_ADD display-name message for a native FID', async () => {
    const bytes = await buildDisplayNameMessage(4_294_967_296, '  Homie Ünicode  ', privateKeyHex);
    const message = Message.decode(bytes);
    const data = message.dataBytes ?? new Uint8Array();
    expect(message.hash).toEqual(blake3_20(data));
    const publicKey = ed25519.getPublicKey(Buffer.from(privateKeyHex, 'hex'));
    expect(Buffer.from(message.signer)).toEqual(Buffer.from(publicKey));
    expect(ed25519.verify(message.signature, message.hash, publicKey)).toBe(true);

    const { MessageData } = await import('@farcaster/core');
    const decoded = MessageData.decode(data);
    expect(decoded.type).toBe(CoreMessageType.USER_DATA_ADD);
    expect(decoded.fid).toBe(4_294_967_296);
    expect(decoded.userDataBody?.type).toBe(CoreUserDataType.DISPLAY);
    expect(decoded.userDataBody?.value).toBe('Homie Ünicode');
  });

  it('rejects empty and over-long names', async () => {
    await expect(buildDisplayNameMessage(1, '   ', privateKeyHex)).rejects.toThrow();
    await expect(buildDisplayNameMessage(1, 'é'.repeat(17), privateKeyHex)).rejects.toThrow();
  });
});
