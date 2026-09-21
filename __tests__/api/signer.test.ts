import { validateSignerRegistrationBody } from '@/lib/signer-registration';

describe('signer registration input', () => {
  const publicKey = `0x${'ab'.repeat(32)}`;

  it('accepts a valid browser-generated public key', () => {
    expect(validateSignerRegistrationBody({ public_key: publicKey })).toEqual({
      ok: true,
      publicKey,
    });
  });

  it.each(['private_key', 'privateKey', 'signerPrivateKey'])(
    'rejects requests containing %s',
    (field) => {
      expect(validateSignerRegistrationBody({
        public_key: publicKey,
        [field]: 'do-not-send-this',
      })).toEqual({
        ok: false,
        error: 'Private key material must never be sent to the server',
      });
    },
  );

  it.each([
    undefined,
    {},
    { public_key: 'ab'.repeat(32) },
    { public_key: `0x${'ab'.repeat(31)}` },
    { public_key: `0x${'zz'.repeat(32)}` },
  ])('rejects malformed public keys', (body) => {
    expect(validateSignerRegistrationBody(body).ok).toBe(false);
  });

  it('rejects unexpected fields', () => {
    expect(validateSignerRegistrationBody({ public_key: publicKey, note: 'unexpected' })).toEqual({
      ok: false,
      error: 'Only public_key is accepted',
    });
  });
});
