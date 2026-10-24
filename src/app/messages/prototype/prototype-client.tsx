'use client';

import { useState } from 'react';

type TestResult = {
  envelope: Record<string, string | number>;
  receivedMessage: string;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
};

const TEST_MESSAGE = 'A private test message';
const INFO = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function createAesKey(privateKey: CryptoKey, publicKey: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const inputKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: asArrayBuffer(salt), info: asArrayBuffer(INFO.encode('homiehouse-dm-relay-boundary-demo-v0')) },
    inputKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function runBoundaryTest(): Promise<TestResult> {
  if (!globalThis.crypto?.subtle) throw new Error('Browser cryptography is unavailable. Open this page over HTTPS or localhost.');

  const [recipient, unrelatedDevice, senderEphemeral] = await Promise.all([
    crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
    crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
    crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
  ]);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const senderKey = await createAesKey(senderEphemeral.privateKey, recipient.publicKey, salt);
  const ephemeralPublicKey = toBase64(new Uint8Array(await crypto.subtle.exportKey('spki', senderEphemeral.publicKey)));
  const routing = {
    version: 0,
    senderDeviceId: 'alice-device',
    recipientDeviceId: 'bob-device',
    conversationId: 'demo-conversation',
    ephemeralPublicKey,
  };
  const additionalData = INFO.encode(JSON.stringify(routing));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(nonce), additionalData: asArrayBuffer(additionalData) },
    senderKey,
    asArrayBuffer(INFO.encode(TEST_MESSAGE)),
  );
  const envelope = {
    ...routing,
    salt: toBase64(salt),
    nonce: toBase64(nonce),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };

  const relayStoredEnvelope = structuredClone(envelope);
  const containsPlaintext = JSON.stringify(relayStoredEnvelope).includes(TEST_MESSAGE);
  const recipientKey = await createAesKey(
    recipient.privateKey,
      await crypto.subtle.importKey('spki', asArrayBuffer(fromBase64(relayStoredEnvelope.ephemeralPublicKey)), { name: 'ECDH', namedCurve: 'P-256' }, false, []),
    fromBase64(relayStoredEnvelope.salt),
  );
  const cleartext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(fromBase64(relayStoredEnvelope.nonce)), additionalData: asArrayBuffer(INFO.encode(JSON.stringify(routing))) },
    recipientKey,
    asArrayBuffer(fromBase64(relayStoredEnvelope.ciphertext)),
  );
  const receivedMessage = new TextDecoder().decode(cleartext);

  let unrelatedDeviceRejected = false;
  try {
    const unrelatedKey = await createAesKey(
      unrelatedDevice.privateKey,
      await crypto.subtle.importKey('spki', asArrayBuffer(fromBase64(relayStoredEnvelope.ephemeralPublicKey)), { name: 'ECDH', namedCurve: 'P-256' }, false, []),
      fromBase64(relayStoredEnvelope.salt),
    );
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asArrayBuffer(fromBase64(relayStoredEnvelope.nonce)), additionalData: asArrayBuffer(INFO.encode(JSON.stringify(routing))) },
      unrelatedKey,
      asArrayBuffer(fromBase64(relayStoredEnvelope.ciphertext)),
    );
  } catch {
    unrelatedDeviceRejected = true;
  }

  const tamperedEnvelope = { ...relayStoredEnvelope, recipientDeviceId: 'mallory-device' };
  let tamperingRejected = false;
  try {
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asArrayBuffer(fromBase64(tamperedEnvelope.nonce)), additionalData: asArrayBuffer(INFO.encode(JSON.stringify({ ...routing, recipientDeviceId: tamperedEnvelope.recipientDeviceId }))) },
      recipientKey,
      asArrayBuffer(fromBase64(tamperedEnvelope.ciphertext)),
    );
  } catch {
    tamperingRejected = true;
  }

  return {
    envelope: relayStoredEnvelope,
    receivedMessage,
    checks: [
      { label: 'Relay fixture stores ciphertext only', passed: !containsPlaintext, detail: containsPlaintext ? 'Plaintext appeared in the stored envelope.' : 'The sample text is absent from the stored envelope.' },
      { label: 'Intended device decrypts the message', passed: receivedMessage === TEST_MESSAGE, detail: receivedMessage === TEST_MESSAGE ? 'The recipient recovered the original text.' : 'The recipient text did not match.' },
      { label: 'Unrelated device cannot decrypt', passed: unrelatedDeviceRejected, detail: unrelatedDeviceRejected ? 'Decryption failed with a different device key.' : 'An unrelated key unexpectedly decrypted the envelope.' },
      { label: 'Routing metadata tampering is rejected', passed: tamperingRejected, detail: tamperingRejected ? 'Changing the recipient ID invalidated authentication.' : 'Tampered routing metadata was accepted.' },
    ],
  };
}

export default function DirectMessagesE2EETest() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  async function runTest() {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      setResult(await runBoundaryTest());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The encryption boundary test failed to run.');
    } finally {
      setRunning(false);
    }
  }

  const allPassed = result?.checks.every(check => check.passed) ?? false;

  return <section style={{ maxWidth: 900, margin: '0 auto', padding: '24px 0' }}>
    <p style={{ margin: '0 0 6px', color: 'var(--accent)', fontWeight: 700, fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>Homiehouse · private messaging test</p>
    <h1 style={{ margin: 0 }}>Encrypted message test</h1>
    <p style={{ maxWidth: 720, color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>
      Send a sample message through a simulated relay. The relay fixture receives only an encrypted envelope; the intended device decrypts it locally.
    </p>

    <aside role="note" style={{ margin: '18px 0', padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', lineHeight: 1.55 }}>
      <strong>Test only.</strong> This browser demo uses temporary P-256, HKDF-SHA-256, and AES-GCM keys. It does not contact Hypersnap, send real messages, or implement an audited messaging protocol. Do not enter private information.
    </aside>

    <section className="surface" aria-labelledby="e2ee-test-title" style={{ padding: 20, marginTop: 24 }}>
      <h2 id="e2ee-test-title" style={{ marginTop: 0 }}>Two-device relay boundary</h2>
      <p style={{ color: 'var(--muted-on-dark)', lineHeight: 1.55 }}>
        Alice’s device encrypts a fixed sample for Bob’s device. The checks confirm that the relay cannot read it, Bob can decrypt it, a different device cannot, and altered routing data is rejected.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, margin: '18px 0' }}>
        <button className="btn primary" type="button" onClick={runTest} disabled={running}>
          {running ? 'Running encryption test…' : 'Run E2EE test'}
        </button>
        <span role="status" aria-live="polite" style={{ color: allPassed ? 'var(--accent)' : 'var(--muted-on-dark)', fontWeight: 700 }}>
          {result ? (allPassed ? 'All checks passed' : 'A check failed') : error ? 'Test could not run' : 'Ready to run'}
        </span>
      </div>

      {error && <p role="alert" style={{ color: 'var(--danger, #ff8a8a)' }}>{error}</p>}

      {result && <>
        <ul aria-label="Encryption test results" style={{ display: 'grid', gap: 12, paddingLeft: 22 }}>
          {result.checks.map(check => <li key={check.label}>
            <strong>{check.passed ? '✓' : '✕'} {check.label}</strong>
            <div style={{ color: 'var(--muted-on-dark)', fontSize: 14, marginTop: 3 }}>{check.detail}</div>
          </li>)}
        </ul>
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <h3 style={{ marginTop: 0 }}>Message on Bob’s device</h3>
          <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result.receivedMessage}</p>
        </div>
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer' }}>Inspect the relay’s stored envelope</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 14, borderRadius: 8, background: 'var(--surface)', fontSize: 12 }}>{JSON.stringify(result.envelope, null, 2)}</pre>
        </details>
      </>}
    </section>

    <p style={{ color: 'var(--muted-on-dark)', fontSize: 13, lineHeight: 1.5, marginTop: 18 }}>
      This demonstrates a narrow encryption boundary in one browser session. Production messaging still needs a reviewed protocol, authenticated key discovery, device enrollment and recovery, and a real relay API.
    </p>
  </section>;
}
