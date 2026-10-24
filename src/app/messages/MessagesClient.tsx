'use client';

import { useEffect, useState } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import {
  getMailboxNodeUrl,
  probeHypersnapMailbox,
  saveMailboxNodeUrl,
  type MailboxAvailability,
} from '@/lib/hypersnap-mailbox';

export default function MessagesClient() {
  const { fid } = useFarcasterAuth();
  const [recipientFid, setRecipientFid] = useState('');
  const [nodeUrl, setNodeUrl] = useState('');
  const [nodeUrlMessage, setNodeUrlMessage] = useState<string | null>(null);
  const [availability, setAvailability] = useState<MailboxAvailability | null>(null);

  useEffect(() => {
    setNodeUrl(getMailboxNodeUrl());
    const recipient = new URLSearchParams(window.location.search).get('recipient');
    if (recipient && /^\d+$/.test(recipient)) setRecipientFid(recipient);
    void probeHypersnapMailbox().then(setAvailability);
  }, []);

  async function saveNodeAndCheck() {
    if (!saveMailboxNodeUrl(nodeUrl)) {
      setNodeUrlMessage('Enter an HTTPS node URL. HTTP is allowed only for localhost.');
      return;
    }
    setNodeUrl(getMailboxNodeUrl());
    setNodeUrlMessage('Node URL saved in this browser. Checking mailbox support…');
    setAvailability(null);
    const result = await probeHypersnapMailbox();
    setAvailability(result);
    setNodeUrlMessage('');
  }

  const validRecipient = /^\d+$/.test(recipientFid) && Number(recipientFid) > 0;
  const selfMessage = validRecipient && Number(recipientFid) === fid;
  return <section aria-labelledby="messages-heading" style={{ display: 'grid', gap: 18 }}>
    <div className="surface" style={{ padding: 20 }}>
      <h1 id="messages-heading" style={{ marginTop: 0 }}>Private messages</h1>
      <p style={{ color: 'var(--muted-on-dark)', lineHeight: 1.6, marginBottom: 0 }}>
        Start and continue conversations here. Messages are planned to be encrypted on your device
        and carried by your selected Hypersnap node.
      </p>
    </div>

    <div className="surface" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Start a conversation</h2>
      <label htmlFor="mailbox-node-url">Hypersnap node URL</label>
      <input
        id="mailbox-node-url"
        type="url"
        inputMode="url"
        autoComplete="url"
        value={nodeUrl}
        onChange={(event) => setNodeUrl(event.target.value)}
        placeholder="https://your-node.example"
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 12, margin: '8px 0', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border)', borderRadius: 8 }}
      />
      <button className="btn" type="button" onClick={() => void saveNodeAndCheck()}>
        Save node and check support
      </button>
      <p style={{ color: 'var(--muted-on-dark)', fontSize: 13, lineHeight: 1.5 }}>
        This URL is saved in this browser only. Mailbox requests will go directly to this node;
        Homiehouse will not send messages through its server or switch to another node.
      </p>
      {nodeUrlMessage && <p role="status">{nodeUrlMessage}</p>}

      <label htmlFor="message-recipient">Recipient FID</label>
      <input
        id="message-recipient"
        inputMode="numeric"
        value={recipientFid}
        onChange={(event) => setRecipientFid(event.target.value)}
        placeholder="Enter a recipient’s account ID"
        aria-describedby="message-recipient-help"
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 12, margin: '8px 0', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border)', borderRadius: 8 }}
      />
      <p id="message-recipient-help" style={{ color: 'var(--muted-on-dark)', fontSize: 13 }}>
        Your account: {fid ? `FID ${fid}` : 'sign in to continue'}.
      </p>
      {recipientFid && !validRecipient && <p role="alert">Enter a valid positive FID.</p>}
      {selfMessage && <p role="alert">Choose another account to start a conversation.</p>}

      <button className="btn primary" type="button" disabled>
        Encrypted messaging is not available yet
      </button>

      <div role="status" aria-live="polite" style={{ marginTop: 18, color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>
        {availability === null && 'Checking the selected Hypersnap node for encrypted mailbox support…'}
        {availability && !availability.available && availability.reason === 'unsupported' && (
          <>
            <strong>This node does not support encrypted mailboxes yet.</strong>{' '}
            Update the Hypersnap node before sending or receiving private messages. This screen will
            not send message content through public casts or another messaging service.
          </>
        )}
        {availability && !availability.available && availability.reason === 'unreachable' && (
          <>
            <strong>Could not reach the selected Hypersnap node.</strong>{' '}
            Check the node URL and connection, then try again.
          </>
        )}
        {availability && !availability.available && availability.reason === 'invalid-response' && (
          <>
            <strong>The node returned an unsupported mailbox response.</strong>{' '}
            The encrypted mailbox protocol version could not be verified.
          </>
        )}
        {availability?.available && (
          <>
            <strong>The node advertises encrypted mailbox support.</strong>{' '}
            Device-key setup and encrypted conversation sync are not enabled in this Homiehouse
            client yet. The send action will remain unavailable until both are ready.
          </>
        )}
      </div>
    </div>
  </section>;
}
