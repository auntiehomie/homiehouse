'use client';

import { useState } from 'react';
import { directMessageUrl } from '@/lib/direct-messages';

export default function MessageComposer() {
  const [recipient, setRecipient] = useState('');
  const composeUrl = directMessageUrl(recipient);

  return <section className="surface" style={{ padding: 20, marginTop: 24 }} aria-labelledby="message-person">
    <h2 id="message-person">Message someone</h2>
    <p>Open a conversation with someone by entering their account ID. The conversation is handled by the network’s current messaging service.</p>
    <label htmlFor="message-recipient">Recipient FID</label>
    <input id="message-recipient" inputMode="numeric" value={recipient}
      onChange={event => setRecipient(event.target.value)} placeholder="e.g. 3103"
      style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 12, margin: '8px 0 16px', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border)', borderRadius: 8 }} />
    {recipient && !composeUrl && <p role="alert">Enter a valid positive account ID.</p>}
    {composeUrl ? <a className="btn" href={composeUrl} target="_blank" rel="noopener noreferrer">Open message composer ↗</a>
      : <button className="btn" disabled>Open message composer ↗</button>}
    <p style={{ color: 'var(--muted-on-dark)', fontSize: 13, marginTop: 16 }}>
      Review and send in the social app. Opening a conversation does not send a message.
      You may be asked to sign in.
    </p>
  </section>;
}
