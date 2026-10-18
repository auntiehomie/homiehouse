'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { directMessageUrl, FARCASTER_INBOX_URL } from '@/lib/direct-messages';

export default function MessagesPage() {
  const [recipient, setRecipient] = useState('');
  const composeUrl = directMessageUrl(recipient);

  return <AppShell>
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0' }}>
      <h1>Messages</h1>
      <p style={{ color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>
        Public casts are stored on decentralized networks such as Hypersnap. Private
        messages use a separate service that HomieHouse cannot currently read through
        Hypersnap, so open your Farcaster inbox to continue existing conversations.
      </p>
      <a className="btn primary" href={FARCASTER_INBOX_URL} target="_blank" rel="noopener noreferrer">
        Open Farcaster inbox ↗
      </a>
      <section className="surface" style={{ padding: 20, marginTop: 24 }} aria-labelledby="message-person">
        <h2 id="message-person">Message someone</h2>
        <p>Open a conversation with someone by entering their Farcaster ID. The conversation is handled by Farcaster’s current messaging service.</p>
        <label htmlFor="message-recipient">Recipient FID</label>
        <input id="message-recipient" inputMode="numeric" value={recipient}
          onChange={event => setRecipient(event.target.value)} placeholder="e.g. 3103"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 12, margin: '8px 0 16px', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border)', borderRadius: 8 }} />
        {recipient && !composeUrl && <p role="alert">Enter a valid positive Farcaster ID.</p>}
        {composeUrl ? <a className="btn" href={composeUrl} target="_blank" rel="noopener noreferrer">Open Farcaster composer ↗</a>
          : <button className="btn" disabled>Open Farcaster composer ↗</button>}
        <p style={{ color: 'var(--muted-on-dark)', fontSize: 13, marginTop: 16 }}>
          Review and send in Farcaster. Opening a conversation does not send a message.
          Farcaster may ask you to sign in.
        </p>
      </section>
    </main>
  </AppShell>;
}
