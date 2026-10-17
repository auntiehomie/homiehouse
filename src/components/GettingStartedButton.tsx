'use client';
import { OPEN_MIGRATION_GUIDE } from '@/lib/migration-guide';

export default function GettingStartedButton({ onOpen }: { onOpen?: () => void }) {
  return <button className="btn" style={{ width: '100%', textAlign: 'left', marginBottom: 12 }} onClick={() => {
    onOpen?.();
    window.dispatchEvent(new Event(OPEN_MIGRATION_GUIDE));
  }}>Getting started</button>;
}
