# Homiehouse private messaging over Hypersnap

## Decision

Build messaging as a Hypersnap-native encrypted mailbox. Homiehouse owns the client and UI; mailbox providers store and return signed ciphertext envelopes. Do not use Farcaster Direct Casts or Quorum as the message transport: both would move messages off the user's chosen Hypersnap-compatible mailbox.

Make mailbox endpoint selection a first-class part of the Homiehouse client and protocol. Users can choose a compatible Hypersnap mailbox node; an optional Homiehouse-hosted provider may make onboarding easier, but it is not required or the sole place messages can live. The sender encrypts to the recipient's verified device keys and delivers the ciphertext to the recipient's selected endpoint. A Hypersnap protocol and node change is still required before real private messages can be sent.

## Deployment topology: user-selectable mailbox nodes

- **Primary architecture:** every user can choose a compatible mailbox endpoint. The recipient's verified endpoint receives encrypted envelopes; Homiehouse does not require all users to use one shared service.
- **Optional convenience provider:** Homiehouse may offer a hosted provider for users who do not run a node, but it must be possible to switch endpoints and retain the same message protocol.
- **Privacy boundary:** any mailbox provider can see ciphertext and delivery metadata (such as sender/recipient routing IDs, timing, and envelope size), but it receives no private message keys. Encryption/decryption happens on user devices.
- **Decentralization:** independent endpoints distribute storage and operational control. A user choosing the optional shared provider still depends on that provider for availability, retention, and policy.
- **Endpoint discovery:** publish and verify each FID's mailbox endpoint through an account-authorized record. Detect endpoint changes and support key transparency so neither a directory nor mailbox operator can silently substitute an endpoint or recipient key.
- **Delivery:** Homiehouse clients can submit ciphertext directly to the recipient's verified endpoint. A relay/federation layer can be added for nodes that cannot accept direct requests, but it must preserve the same end-to-end encryption and not become mandatory.
- **No server-side recovery:** neither a shared provider nor a personal node gets decryption keys. A user who loses every authorized device may lose access to their message history.

## What the existing systems do

| System | Message transport and client pattern | What Homiehouse can reuse | Why it does not meet the Hypersnap requirement |
| --- | --- | --- | --- |
| Quilcast | Browser client signs and submits normal Farcaster messages to Hypersnap. Its DMs use Farcaster Direct Cast APIs, with HTTP inbox/send calls and WebSocket updates. The Direct Cast FIP describes custody-address authorization and a service-issued token. | In-app inbox, unread/requests/muted views, one-to-one and group conversations, live updates, scoped authorization, client-side node writes for public casts. | DMs are served by the separate Direct Cast service. The FIP explicitly leaves E2EE and decentralization out of the initial design. They are not available from a Hypersnap node. |
| Quorum | A shared cross-platform package separates message types, E2EE/signing, HTTP/WebSocket transport, delta sync, and platform-provided storage. Web and native clients can use the same protocol abstractions. | The clean separation of crypto, transport, sync, storage, and UI; cross-platform data contracts; acknowledgements and read state. | Quorum messages use Quorum's own network and storage adapters, not Hypersnap. Its protocol cannot be read from the Homiehouse node. |

Sources: [Quilcast repository](https://github.com/backmeupplz/quilcast), [Quorum shared architecture](https://github.com/QuilibriumNetwork/quorum-shared), and [Farcaster Direct Casts proposal](https://github.com/farcasterxyz/protocol/discussions/226).

## Hypersnap gap found in the checked-out source

The current Farcaster `MessageType` schema accepts public casts, reactions, links, profile data, frame actions, storage-lending records, and key records. It has no direct-message body. The current `HyperEnvelope` carries block metadata and a generic payload, but the checked-out Hyper code does not provide a DM submission, recipient inbox index, or inbox read API. The `/v1/submitMessage` endpoint therefore cannot be treated as a private-message API.

Adding only a Homiehouse screen would not solve this. A working node-readable inbox needs a signed wire record, validation, durable storage, replication, a recipient query/index, and a stable read cursor. Hypersnap-only messages must be negotiated as a Hyper capability and must not be submitted as ordinary public casts.

## Proposed v1 protocol

### Identity and keys

1. Resolve each participant to a Farcaster FID, then bind a separate messaging identity key to that FID with a signature from an approved Farcaster signer.
2. Keep encryption keys separate from Farcaster signing keys. Generate/store private keys locally in browser storage; expose only public prekeys and key version/revocation records to Hypersnap.
3. Support multiple devices by registering one encryption key per device. New devices get no historic plaintext unless a current device explicitly transfers it.
4. Use an audited asynchronous E2EE protocol: ratcheting sessions for one-to-one messages and a reviewed group protocol for group conversations. Do not invent a custom cipher or reuse the Quorum implementation without confirming algorithm, licenses, and compatibility.

### Message envelope

Hypersnap needs a new, versioned Hyper-only message record containing:

- protocol version, conversation identifier, sender FID and sender device/key version;
- an opaque recipient mailbox routing identifier (or a recipient list for group fan-out);
- sequence/cursor and expiry policy;
- ciphertext, authentication tag, and sender signature.

The encryption should cover message text, attachments, reply references, reactions, and any sensitive conversation metadata. Nodes need routing metadata to deliver and index envelopes, so they may still observe sender, recipient mailbox, timing, and ciphertext size. Pad or batch envelopes if hiding these patterns is a product requirement.

### Node behavior and API

Extend Hypersnap, without changing canonical Snapchain message semantics, to:

- accept signed encrypted envelopes through a versioned DM submit endpoint;
- validate sender FID/key binding, size limits, recipient routing fields, replay protection, and rate limits;
- persist envelopes on the recipient's selected mailbox provider and support independent compatible endpoints;
- route submissions to the recipient's verified endpoint, with optional relay support for nodes that cannot accept direct requests;
- index envelopes by recipient mailbox and expose authenticated, paginated reads with opaque cursors;
- expose delivery/read acknowledgements as signed mailbox events, not as public casts;
- provide a WebSocket event or long-poll cursor wakeup, with cursor reads as the source of truth after reconnect;
- advertise the required Hyper DM capability and reject unsupported message versions clearly.

Proposed first HTTP surface (all routes are node-local and versioned):

| Method and route | Purpose | Required behavior |
| --- | --- | --- |
| `GET /v1/hypersnap/mailbox/capabilities` | Discover protocol support | Return protocol version and enabled capabilities only; never expose user content. |
| `POST /v1/hypersnap/mailbox/devices` | Register/rotate/revoke a device encryption key | Require an account-signer-authenticated statement; enforce key version and revocation rules. |
| `GET /v1/hypersnap/mailbox/keys/{fid}` | Fetch recipient device prekeys | Return only public, account-authenticated keys and one-time prekeys. |
| `POST /v1/hypersnap/mailbox/messages` | Submit an encrypted envelope | Validate sender signer, signature, size, replay/idempotency, recipients, and protocol version before durable acceptance. |
| `GET /v1/hypersnap/mailbox/inbox` | Read a recipient's encrypted envelopes | Require recipient-device proof, return opaque ciphertext only, paginate with a stable cursor. |
| `POST /v1/hypersnap/mailbox/receipts` | Record delivery/read high-water marks | Accept signed recipient-device acknowledgements; never infer human read state from node storage. |

The API must not accept plaintext message fields. All non-capability requests require authenticated account/device proofs. Cross-origin access should be limited to the configured Homiehouse origin where practical; CORS is not an authorization mechanism.

The public interface should be transport-agnostic in Homiehouse: `registerDevice`, `publishPrekeys`, `sendEnvelope`, `listInbox(cursor)`, `ackDelivery`, `ackRead`, and `subscribe(cursor)`. An adapter should target the user's Hypersnap URL. No Farcaster Direct Cast credential or Quorum account is involved.

### Homiehouse client

- Replace the current outbound `Message ↗` action with an in-app conversation route once the node API is available.
- Replace the local-only prototype transport with separate crypto, Hypersnap transport, and IndexedDB storage adapters, following Quorum's separation of concerns.
- Keep conversation/message UI state local and decrypt only on the user's device. Never send plaintext or private encryption keys to Homiehouse's server.
- Show connection, pending, delivered, and read states. Treat node acknowledgements as storage/delivery status, not proof that a human read the message.
- For a user without a published encryption key, show an explicit invite/setup state; do not silently fall back to public casts or Direct Casts.

## Security and compatibility requirements

- Nodes and Homiehouse servers must be unable to decrypt message bodies. A Hypersnap node returns ciphertext to recipients; it does not make plaintext readable to operators.
- Encrypt the first-message key-establishment payload to the recipient's authenticated public prekey and bind the FID, device, conversation, and protocol version into authenticated data.
- Verify key announcements and rotations against the Farcaster signer before starting a session. Reject stale, revoked, or conflicting key versions.
- Prevent replay and duplicate delivery with per-session sequence numbers plus server-side idempotency keyed by the signed envelope hash.
- Group changes, device revocation, backup/export, abuse reports, and key recovery need explicit semantics before production. There is no server-side recovery of E2EE content.
- Require at least two independently operated Hypersnap nodes for a replication test. A single node proves local storage and retrieval, not decentralized availability.

## Threat model

### Protect against

- A curious or compromised Hypersnap node operator reading message content, attachments, reactions, or conversation history from stored data.
- A network observer or intermediary reading message content in transit or altering a stored envelope.
- A Homiehouse server compromise exposing message plaintext or private messaging keys. The app server should never receive either.
- An unapproved signer attempting to send as another FID, or a node accepting a tampered, replayed, or duplicated envelope.

### Still visible or out of scope for v1

- Nodes can observe mailbox routing identifiers, the sending FID/signing key, message time, ciphertext length, and delivery volume. Encryption does not hide this metadata.
- A compromised or unlocked user device can read messages available to that device. Browser extensions and malicious client code also remain within the device trust boundary.
- A lost device can lose its local message history. Recovery and encrypted device-to-device transfer need separate user-approved design; server-side plaintext recovery is not allowed.
- E2EE does not prevent spam, harassment, screenshots, recipients forwarding plaintext, or denial of service. Rate limits and user controls mitigate these problems but do not make them impossible.
- Gossip replication alone does not guarantee delivery, permanent retention, or censorship resistance. The node protocol must define replication acknowledgements, retry/sync, retention, and deletion semantics before claiming reliable decentralized delivery.

### Security invariants

- No fallback to public casts, Direct Casts, or a Homiehouse server relay when the native mailbox is unavailable.
- No message becomes “delivered” until a Hypersnap node acknowledges durable acceptance; no message becomes “read” without an authenticated recipient-device acknowledgement.
- Device key registration and revocation are authenticated by the account's active Farcaster signer. Encrypting a message to an unauthenticated key can silently expose it to an attacker.
- Conversations should support both one-to-one and group participants, while all user content remains encrypted at the device boundary.

## Delivery plan and acceptance criteria

1. **Hypersnap protocol RFC:** settle envelope schema, validation, routing/indexing, pagination, key binding, endpoint records, and direct-delivery/relay rules. Keep changes behind a Hyper capability/version.
2. **Reference mailbox implementation:** implement signed envelope submit/read, device key directory, retention, cursor sync, quotas, and authenticated reads for independently operated compatible endpoints.
3. **Homiehouse client:** add device setup, inbox/thread UI, E2EE adapter, endpoint chooser, recipient endpoint discovery/verification, optimistic send, reconnect sync, and profile-to-conversation navigation. Offer a Homiehouse-hosted provider only as an optional convenience.
4. **Two-node security test:** two accounts on separate browsers and independently operated nodes exchange messages. Confirm neither node nor the Homiehouse server can decrypt; test endpoint/key substitution detection, altered signatures, duplicate submissions, revoked devices, offline catch-up, and cursor gaps.
5. **Optional relay:** add relay/federation only if direct delivery has reachability problems; preserve end-to-end encryption and make the relay replaceable.

Do not enable the production Message action until the node API is deployed and the two-device test passes. Until then, clearly label the existing prototype as local-only and keep the current external inbox link available as a separate action.
