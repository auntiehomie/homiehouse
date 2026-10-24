import AppShell from '@/components/AppShell';
import DirectMessagesLocalPrototype from './prototype-client';

export default function DirectMessagesPrototypePage() {
  const previewOnly = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview';

  if (!previewOnly) {
    return <AppShell>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0' }}>
        <h1>Message prototype</h1>
        <p>This prototype is available only in local development and preview deployments.</p>
      </main>
    </AppShell>;
  }

  return <AppShell><DirectMessagesLocalPrototype /></AppShell>;
}
