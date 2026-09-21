type SignerRegistrationBody =
  | { ok: true; publicKey: `0x${string}` }
  | { ok: false; error: string };

export function validateSignerRegistrationBody(body: unknown): SignerRegistrationBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'A JSON object containing public_key is required' };
  }

  const record = body as Record<string, unknown>;
  const forbiddenFields = ['private_key', 'privateKey', 'signerPrivateKey'];
  if (forbiddenFields.some((field) => Object.prototype.hasOwnProperty.call(record, field))) {
    return { ok: false, error: 'Private key material must never be sent to the server' };
  }

  if (Object.keys(record).some((field) => field !== 'public_key')) {
    return { ok: false, error: 'Only public_key is accepted' };
  }

  if (typeof record.public_key !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(record.public_key)) {
    return { ok: false, error: 'public_key must be a 32-byte 0x-prefixed Ed25519 public key' };
  }

  return { ok: true, publicKey: record.public_key as `0x${string}` };
}
