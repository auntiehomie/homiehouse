import AppShell from '@/components/AppShell';
import MessagesClient from './MessagesClient';

export default function MessagesPage() {
  return <AppShell>
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0' }}>
      <MessagesClient />
    </main>
  </AppShell>;
}
