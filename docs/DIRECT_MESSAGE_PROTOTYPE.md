# Local direct message prototype

The `/messages/prototype` route provides a local UI and transport-boundary demo for the proposed direct-message feature.

## Current behavior

- Two fixed demo identities can send messages to each other in the same browser tab.
- Message data lives only in the component's in-memory transport instance. Reloading clears it.
- The prototype does not encrypt, persist, or transmit message contents. Never use real or sensitive message content here.
- The route is available during local development and on Vercel preview deployments. It is gated off in production.
- This validates the Homiehouse inbox interaction and a transport interface only. It does not demonstrate Hypersnap or Farcaster direct-message compatibility.

## Future integration boundary

`DirectMessageTransport` in `src/lib/direct-message-prototype.ts` is a UI-facing interface. A production implementation would need a specified interoperable message envelope, audited end-to-end encryption and device/key lifecycle, authenticated read/write APIs, durable storage and delivery semantics, and retention/abuse controls. A Hypersnap adapter must use a documented supported protocol; the local demo is not evidence that Hypersnap accepts direct messages.
