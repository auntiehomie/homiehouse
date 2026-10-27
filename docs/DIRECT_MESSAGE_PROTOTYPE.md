# Encrypted message boundary test

The `/messages` page exposes a browser-side demonstration of the two-device relay boundary test. It creates temporary ECDH P-256 keys, derives an AES-GCM key with HKDF-SHA-256, and stores an encrypted envelope in an in-memory relay fixture. The intended device decrypts the sample; an unrelated device fails; changing the authenticated recipient routing field is rejected.

The test does not contact Hypersnap or another relay, persist data, or send messages. Its browser crypto is a demonstration only. It does not implement Signal, a ratchet, authenticated identity/prekey discovery, key transparency, secure key storage, or a production protocol. Do not enter real or sensitive message content. The interface must keep these limits visible whenever the test is shown.

`__tests__/lib/dm-relay-boundary.test.ts` is a separate Node test of the same narrow boundary using Node's X25519, HKDF-SHA-256, and AES-256-GCM primitives. Neither implementation is suitable as production messaging crypto. See [the protocol design and threat model](./DIRECT_MESSAGE_PROTOCOL_DESIGN.md) for the production requirements and risks.
