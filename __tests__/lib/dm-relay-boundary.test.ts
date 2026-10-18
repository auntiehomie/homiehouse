import {
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';

type DemoEnvelope = {
  version: 0;
  senderDeviceId: string;
  recipientDeviceId: string;
  conversationId: string;
  ephemeralPublicKey: string;
  salt: string;
  nonce: string;
  ciphertext: string;
  tag: string;
};

const PROTOCOL_INFO = Buffer.from('homiehouse-dm-relay-boundary-demo-v0');

function envelopeHeader(envelope: Omit<DemoEnvelope, 'ciphertext' | 'tag'>): Buffer {
  return Buffer.from(JSON.stringify(envelope));
}

function encryptForDevice(input: {
  plaintext: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  conversationId: string;
  recipientPublicKey: KeyObject;
}): DemoEnvelope {
  const ephemeral = generateKeyPairSync('x25519');
  const sharedSecret = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: input.recipientPublicKey });
  const salt = randomBytes(32);
  const nonce = randomBytes(12);
  const key = Buffer.from(hkdfSync('sha256', sharedSecret, salt, PROTOCOL_INFO, 32));
  const header = {
    version: 0 as const,
    senderDeviceId: input.senderDeviceId,
    recipientDeviceId: input.recipientDeviceId,
    conversationId: input.conversationId,
    ephemeralPublicKey: ephemeral.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    salt: salt.toString('base64'),
    nonce: nonce.toString('base64'),
  };
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(envelopeHeader(header));
  const ciphertext = Buffer.concat([cipher.update(input.plaintext, 'utf8'), cipher.final()]);

  return {
    ...header,
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptForDevice(envelope: DemoEnvelope, recipientPrivateKey: KeyObject): string {
  const ephemeralPublicKey = Buffer.from(envelope.ephemeralPublicKey, 'base64');
  const sharedSecret = diffieHellman({
    privateKey: recipientPrivateKey,
    publicKey: createPublicKey({ key: ephemeralPublicKey, type: 'spki', format: 'der' }),
  });
  const salt = Buffer.from(envelope.salt, 'base64');
  const nonce = Buffer.from(envelope.nonce, 'base64');
  const key = Buffer.from(hkdfSync('sha256', sharedSecret, salt, PROTOCOL_INFO, 32));
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  const { ciphertext, tag, ...header } = envelope;
  decipher.setAAD(envelopeHeader(header));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

class CiphertextOnlyRelay {
  private readonly envelopes: DemoEnvelope[] = [];

  store(envelope: DemoEnvelope): void {
    this.envelopes.push(structuredClone(envelope));
  }

  readForDevice(deviceId: string): DemoEnvelope[] {
    return this.envelopes.filter(envelope => envelope.recipientDeviceId === deviceId).map(envelope => structuredClone(envelope));
  }
}

describe('two-device encrypted envelope relay boundary (test-only crypto)', () => {
  it('stores ciphertext that the intended device decrypts but the relay cannot', () => {
    const recipient = generateKeyPairSync('x25519');
    const unrelatedDevice = generateKeyPairSync('x25519');
    const plaintext = 'A private test message';
    const envelope = encryptForDevice({
      plaintext,
      senderDeviceId: 'alice-phone',
      recipientDeviceId: 'bob-laptop',
      conversationId: 'demo-conversation-1',
      recipientPublicKey: recipient.publicKey,
    });
    const relay = new CiphertextOnlyRelay();

    relay.store(envelope);
    const stored = relay.readForDevice('bob-laptop');

    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0])).not.toContain(plaintext);
    expect(stored[0]).not.toHaveProperty('plaintext');
    expect(decryptForDevice(stored[0], recipient.privateKey)).toBe(plaintext);
    expect(() => decryptForDevice(stored[0], unrelatedDevice.privateKey)).toThrow();
  });

  it('rejects ciphertext or routing metadata tampering', () => {
    const recipient = generateKeyPairSync('x25519');
    const envelope = encryptForDevice({
      plaintext: 'Integrity check',
      senderDeviceId: 'alice-phone',
      recipientDeviceId: 'bob-laptop',
      conversationId: 'demo-conversation-1',
      recipientPublicKey: recipient.publicKey,
    });

    expect(() => decryptForDevice({ ...envelope, ciphertext: Buffer.from('tampered').toString('base64') }, recipient.privateKey)).toThrow();
    expect(() => decryptForDevice({ ...envelope, recipientDeviceId: 'mallory-device' }, recipient.privateKey)).toThrow();
  });
});
