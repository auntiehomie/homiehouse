# Homiehouse direct-message protocol: design and threat model

**Status:** design draft and test plan, not a production protocol or security audit.

## Goal and boundary

Provide interoperable private one-to-one messages over a decentralized transport. A sender's device encrypts before upload; only enrolled recipient devices (and the sender's enrolled devices, if sync is enabled) can decrypt. Relays store and route envelopes without receiving message plaintext or decryption keys.

This is for private messages, not public casts. Publishing ciphertext as a public cast may expose it to every node, leak recipient and timing metadata, and violate network expectations. Hypersnap must document a supported message envelope, key discovery, and inbox read/write interface before Homiehouse can claim native interoperability. The `/messages` browser demo now performs a narrow encrypted-envelope test locally, but it is not connected to any relay and is not a production messaging implementation.

## Design decisions

1. **Use a reviewed messaging protocol.** For 1:1 asynchronous sessions, evaluate a maintained Signal Protocol implementation (asynchronous prekey setup plus Double Ratchet). For group conversations, evaluate MLS (RFC 9420). Do not implement a new ratchet or cipher in Homiehouse. Choose a browser-compatible implementation only after checking maintenance, audit history, licensing, and support for secure key storage.
2. **Keep identity and encryption keys separate.** A wallet/custody identity may authorize a device's public encryption key, but existing cast-signing keys must not be repurposed as encryption keys. Device private keys and ratchet state remain on-device.
3. **Make device enrollment explicit and verifiable.** Each device gets its own encryption identity and prekeys. Device records bind account ID, device ID, public identity key, signed prekey, expiry, and protocol version. The account's verified identity key signs enrollment/revocation records. A key transparency log or equivalent append-only audit is required to detect silent key substitution; users can compare a QR safety code when higher assurance is needed.
4. **Encrypt separately for each recipient device.** The sender obtains and verifies the active device/prekey list, then creates a protocol session and envelope for each device. For multi-device sync, the sender's other enrolled devices are also recipients. A newly added device receives no old history automatically.
5. **Keep relays payload-blind.** The relay may validate envelope size, version, quotas, routing authorization, and replay identifiers. It cannot search message text, perform semantic moderation, or recover plaintext. Clients provide block/report controls and rate-limited submission; a user may explicitly attach a decrypted report when needed.

## Message flow

1. Bob enrolls Device B. It creates private identity/session material locally and publishes only signed public identity/prekey records.
2. Alice fetches Bob's device list. Her client validates account binding, expiry, revocation, and transparency proof, and warns if Bob's verified key changed.
3. Alice's Device A establishes an asynchronous session with each selected Bob device using the chosen audited protocol. The protocol derives a fresh message key and advances ratchet state.
4. Alice encrypts the message body and optional attachment key locally. The envelope contains protocol/version, conversation and message IDs, sender/recipient device IDs, ratchet header, and ciphertext. Routing fields are authenticated as associated data where the protocol permits.
5. A relay stores and replicates the envelope, returns an opaque receipt/cursor, and makes it available to the recipient mailbox. Bob's device downloads it, checks replay/order state, and decrypts locally.
6. Acknowledgements and read state are also sent as protocol messages or encrypted control envelopes. They can otherwise reveal activity.

## Storage and decentralization

- Store ciphertext envelopes in replicated, append-only message records; maintain a mailbox index so each device can fetch its pending envelopes by cursor. The index is routing metadata and may be visible to nodes.
- A content-addressed blob store can hold encrypted attachments. Encrypt first, then address/store the ciphertext. Content addressing is not encryption. Public networks can expose content identifiers, provider nodes, and request timing.
- For the first interoperable version, explicitly accept that relays may see sender/recipient device identifiers, conversation routing tags, approximate time, message size, and delivery/receipt activity. Hiding this metadata requires a separate design such as rotating mailbox tags, batching/padding, or private information retrieval; it is not provided by message encryption.
- Replication and client downloads improve availability, but do not guarantee it. Retention policies must define quotas, expiry, and garbage collection. A deletion request can remove known relay copies where supported, but cannot recall ciphertext already copied by another node or recipient.
- To reduce dependence on one operator, clients should support multiple compatible relays and encrypted local export. Account bans and network censorship remain possible: E2EE protects content confidentiality, not the ability to publish or retrieve data.

## Device lifecycle, recovery, and verification

- **Add device:** authorize its public key with an existing device or the account identity key; verify via QR/safety code or transparency proof. A device must fetch its own prekeys and establish independent sessions.
- **Remove/lost device:** publish a signed revocation, stop addressing new envelopes to it, and rotate session keys. This cannot erase plaintext or keys the device already copied.
- **Key change:** pause delivery or show a prominent warning until the change is authenticated or independently verified. Never silently accept a new encryption key for a known account.
- **Recovery:** keep recoverable identity material and optional history in a client-encrypted backup protected by a user-held recovery key/passphrase. The relay stores only backup ciphertext. If all devices and the recovery secret are lost, old message history is unrecoverable. A wallet signature can authorize a replacement device but does not recreate old ratchet keys or old plaintext.
- **History transfer:** transfer directly from an enrolled device or restore a client-encrypted archive. New devices do not receive prior history by default.

## Threat model

| Threat | Expected protection | Remaining exposure |
| --- | --- | --- |
| Curious or compromised relay/storage node | Cannot read or alter authenticated ciphertext without detection; cannot derive message keys | Can see routing metadata, withhold, delay, replay, or delete its copies |
| Network observer | Message body and attachments remain encrypted in transit and at rest | Timing, size, IP/network endpoints, and public routing data may identify relationships |
| Malicious or compromised key directory | Signed enrollment records and transparency checks make substitution detectable | First-contact verification and compromised account identity keys remain risks |
| Stolen or malware-infected device | Ratchets can limit exposure of past/future messages after key evolution and revocation | Plaintext visible on a compromised device; copied messages cannot be recalled |
| Malicious recipient | No confidentiality guarantee against an intended recipient | Recipient can screenshot, export, or forward plaintext |
| Account/service ban or relay outage | Multiple relays and local encrypted exports can preserve some access | No protocol can force a relay to serve data or prevent network-level censorship |

Out of scope for this draft: anonymity, traffic-analysis resistance, disappearing-message guarantees, verified group membership UX, spam prevention without plaintext inspection, and legal/operational retention requirements.

## Relay API requirements before production

Hypersnap or another interoperable transport must specify: (1) publish/list/revoke signed device key records and one-time prekeys; (2) authenticated ciphertext-envelope submission; (3) per-device inbox reads with cursors, retry and acknowledgement semantics; (4) ciphertext retention, replication, deletion, and quota behavior; (5) rate limits and abuse-report handling; and (6) stable versioning and test vectors. No direct-cast route or authorization behavior should be guessed from public-cast APIs.

## Two-device relay boundary test

`__tests__/lib/dm-relay-boundary.test.ts` is a deliberately narrow executable demonstration. It uses Node's built-in X25519, HKDF-SHA-256, and AES-256-GCM primitives to simulate a device-to-device encrypted envelope, stores that envelope in a relay fixture, and checks that the intended device decrypts it while an unrelated private key cannot. It does **not** implement Signal, a ratchet, authenticated identity/prekey discovery, key transparency, persistent storage, or a production-ready protocol. Its test-only crypto must not be copied into the application as a substitute for an audited messaging library.
