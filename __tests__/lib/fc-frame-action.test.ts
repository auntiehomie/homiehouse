import { MessageData, MessageType as CoreMessageType, FarcasterNetwork as CoreNetwork } from '@farcaster/hub-nodejs';
import { encodeMessageData, MessageType, FarcasterNetwork } from '@/lib/fc-message-builder';

describe('frame action encoding', () => {
  it.each([
    ['with input text', 'hello'],
    ['without input text', ''],
  ])('matches @farcaster/core byte-for-byte %s', (_name, inputText) => {
    const hash = Uint8Array.from({ length: 20 }, (_, i) => i + 1);
    const ours = encodeMessageData({
      type: MessageType.FRAME_ACTION,
      fid: 3103,
      timestamp: 123456,
      network: FarcasterNetwork.MAINNET,
      body: { frameActionBody: { url: 'https://frame.example/f', buttonIndex: 2, castId: { fid: 99, hash }, inputText } },
    });
    const reference = MessageData.encode(MessageData.create({
      type: CoreMessageType.FRAME_ACTION,
      fid: 3103,
      timestamp: 123456,
      network: CoreNetwork.MAINNET,
      frameActionBody: {
        url: new TextEncoder().encode('https://frame.example/f'),
        buttonIndex: 2,
        castId: { fid: 99, hash },
        inputText: new TextEncoder().encode(inputText),
        state: new Uint8Array(),
        transactionId: new Uint8Array(),
        address: new Uint8Array(),
      },
    })).finish();
    expect(Buffer.from(ours).toString('hex')).toBe(Buffer.from(reference).toString('hex'));
  });
});
