/**
 * Server-side encryption for signer keys stored in the database.
 *
 * Uses AES-256-GCM with a key derived from SIGNER_ENCRYPTION_KEY env var.
 * Scheduled casts need the user's Ed25519 private key to sign messages
 * server-side when the user is offline. The key is captured from the
 * x-signer-key auth header (never from the request body), encrypted,
 * and stored in the signer_uuid column. The publish cron decrypts it
 * at publish time.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ENCRYPTION_KEY = process.env.SIGNER_ENCRYPTION_KEY || process.env.DATABASE_URL?.slice(0, 32) || 'hh-fallback-key-change-me';

function getKey(): Buffer {
  // Derive a 32-byte key from the configured secret
  return scryptSync(ENCRYPTION_KEY, 'homiehouse-salt', 32);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length
const TAG_LENGTH = 16;

/**
 * Encrypt a private key hex string.
 * Returns a base64 string: iv + ciphertext + authTag, prefixed with "enc:".
 */
export function encryptSignerKey(privateKeyHex: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = Buffer.from(privateKeyHex, 'hex');
  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, encrypted, authTag]);
  return `enc:${combined.toString('base64')}`;
}

/**
 * Decrypt a signer key from the "enc:..." format.
 * Returns the private key hex string, or null if decryption fails.
 */
export function decryptSignerKey(storedValue: string): string | null {
  if (!storedValue || storedValue === 'app-managed') return null;
  if (!storedValue.startsWith('enc:')) {
    // Legacy unencrypted key (pre-security-fix) — return as-is for backward compat
    return storedValue;
  }

  try {
    const key = getKey();
    const combined = Buffer.from(storedValue.slice(4), 'base64');

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('hex');
  } catch {
    return null;
  }
}
