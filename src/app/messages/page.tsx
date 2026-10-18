import Link from 'next/link';
import AppShell from '@/components/AppShell';
import MessageComposer from './MessageComposer';
import { FARCASTER_INBOX_URL } from '@/lib/direct-messages';

export default function MessagesPage() {
  const previewAvailable = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview';

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
      <MessageComposer />
      {previewAvailable && <section className="surface" style={{ padding: 20, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Try the Homiehouse message prototype</h2>
        <p style={{ color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>
          Test the inbox flow with two local demo identities. This preview does not send or store real messages.
        </p>
        <Link className="btn" href="/messages/prototype">Open local prototype</Link>
      </section>}
    </main>
  </AppShell>;
}
