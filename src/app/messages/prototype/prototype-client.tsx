'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DemoParticipantId,
  LocalPreviewDirectMessageTransport,
} from '@/lib/direct-message-prototype';

const DEMO_ACCOUNTS: Array<{ id: DemoParticipantId; label: string }> = [
  { id: 'demo-account-a', label: 'Test account A' },
  { id: 'demo-account-b', label: 'Test account B' },
];

export default function DirectMessagesLocalPrototype() {
  const transport = useRef<LocalPreviewDirectMessageTransport | null>(null);
  if (!transport.current) transport.current = new LocalPreviewDirectMessageTransport();

  const [activeAccount, setActiveAccount] = useState<DemoParticipantId>('demo-account-a');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState(() => transport.current!.listMessages('demo-account-a', 'demo-account-b'));
  const recipient = useMemo(() => DEMO_ACCOUNTS.find(account => account.id !== activeAccount)!, [activeAccount]);
  const current = DEMO_ACCOUNTS.find(account => account.id === activeAccount)!;

  function refreshMessages() {
    setMessages(transport.current!.listMessages(activeAccount, recipient.id));
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    transport.current!.sendMessage({ senderId: activeAccount, recipientId: recipient.id, text: draft });
    setDraft('');
    refreshMessages();
  }

  function changeAccount(accountId: DemoParticipantId) {
    setActiveAccount(accountId);
    const otherAccount = DEMO_ACCOUNTS.find(account => account.id !== accountId)!;
    setMessages(transport.current!.listMessages(accountId, otherAccount.id));
  }

  return <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 0' }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'start', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <Link href="/messages" style={{ display: 'inline-block', marginBottom: 12, color: 'var(--muted-on-dark)', fontSize: 13 }}>← Messages</Link>
        <p style={{ margin: '0 0 6px', color: 'var(--accent)', fontWeight: 700, fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>Homiehouse preview</p>
        <h1 style={{ margin: 0 }}>Direct messages</h1>
      </div>
      <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
        Preview as
        <select value={activeAccount} onChange={event => changeAccount(event.target.value as DemoParticipantId)}
          style={{ minWidth: 180, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'inherit' }}>
          {DEMO_ACCOUNTS.map(account => <option key={account.id} value={account.id}>{account.label}</option>)}
        </select>
      </label>
    </div>

    <aside role="note" style={{ margin: '18px 0', padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', lineHeight: 1.55 }}>
      <strong>Local demo only.</strong> Messages are held in this tab’s memory, are not encrypted, are not saved, and are not sent to anyone or to Hypersnap. Do not enter private information. Reloading the page clears the demo.
    </aside>

    <section className="surface" aria-label="Demo conversation" style={{ display: 'grid', gridTemplateRows: 'auto minmax(260px, 1fr) auto', minHeight: 440, overflow: 'hidden' }}>
      <header style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700 }}>{recipient.label}</div>
        <div style={{ fontSize: 13, color: 'var(--muted-on-dark)', marginTop: 4 }}>Test conversation · {current.label} ↔ {recipient.label}</div>
      </header>

      <div aria-live="polite" aria-relevant="additions" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        {messages.length === 0 ? <p style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted-on-dark)' }}>
          No demo messages yet. Send one, then switch “Preview as” to the other account to see it arrive.
        </p> : messages.map(message => {
          const sent = message.senderId === activeAccount;
          return <div key={message.id} style={{ alignSelf: sent ? 'flex-end' : 'flex-start', maxWidth: 'min(78%, 560px)', padding: '10px 13px', borderRadius: 14, background: sent ? 'var(--accent)' : 'var(--surface)', color: sent ? '#111' : 'inherit', overflowWrap: 'anywhere' }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{sent ? 'You' : recipient.label}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
          </div>;
        })}
      </div>

      <form onSubmit={send} style={{ display: 'flex', alignItems: 'end', gap: 10, padding: 14, borderTop: '1px solid var(--border)' }}>
        <label htmlFor="dm-preview-message" style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6, fontSize: 13 }}>
          Message as {current.label}
          <textarea id="dm-preview-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} rows={2}
            placeholder="Type a demo message…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 11, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'inherit', font: 'inherit' }} />
        </label>
        <button className="btn primary" type="submit" disabled={!draft.trim()} style={{ flexShrink: 0 }}>Send</button>
      </form>
    </section>
    <p style={{ color: 'var(--muted-on-dark)', fontSize: 13, lineHeight: 1.5 }}>
      This prototype tests the Homiehouse inbox flow and transport boundary. It does not test encryption, persistence, or Hypersnap interoperability.
    </p>
  </main>;
}
