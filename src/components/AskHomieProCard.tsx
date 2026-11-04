'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAuthHeaders } from '@/lib/client-auth';

interface Props { userFid?: number | null }

export default function AskHomieProCard({ userFid }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isHousePro, setIsHousePro] = useState(false);
  const [active, setActive] = useState(false);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userFid) { setLoading(false); return; }
      const auth = getAuthHeaders('read:all');
      if (!auth) { setLoading(false); return; }
      try {
        const res = await fetch(`/api/pro-status?fid=${userFid}`, {
          headers: { ...auth }, cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to load Ask Homie access.');
        if (!cancelled) {
          setIsHousePro(data.is_pro === true);
          setActive(data.ask_homie_pro?.active === true);
          setUsed(Number(data.ask_homie_pro?.used ?? 0));
          setLimit(Number(data.ask_homie_pro?.limit ?? 100));
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load Ask Homie access.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [userFid]);

  async function openBilling(endpoint: string) {
    setBusy(true);
    setError(null);
    try {
      const auth = getAuthHeaders('write:shop');
      if (!auth) throw new Error('Sign in again to manage Ask Homie Pro.');
      const res = await fetch(endpoint, { method: 'POST', headers: { ...auth } });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.url) throw new Error(data.error || 'Unable to open billing.');
      window.location.href = data.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open billing.');
      setBusy(false);
    }
  }

  if (!userFid || loading || isHousePro) return null;

  return (
    <section style={{
      margin: '12px 16px 0', padding: '14px 16px', borderRadius: 12,
      border: '1px solid var(--border)', background: 'var(--bg-dark)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <strong style={{ fontSize: 14, color: 'var(--text-on-dark)' }}>Ask Homie Pro</strong>
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--muted-on-dark)' }}>
            {active
              ? `${Math.max(0, limit - used)} of ${limit} AI responses left this month`
              : '100 AI responses each month, with up to 60 requests per hour. $1/month.'}
          </p>
        </div>
        {active ? (
          <button className="btn" disabled={busy} onClick={() => void openBilling('/api/ask-homie-pro/portal')}>
            {busy ? 'Opening…' : 'Manage'}
          </button>
        ) : (
          <button className="btn" disabled={busy} onClick={() => void openBilling('/api/ask-homie-pro/checkout')}>
            {busy ? 'Opening…' : 'Get Pro · $1/mo'}
          </button>
        )}
      </div>
      {!active && <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted-on-dark)' }}>
        HomieHouse Pro subscribers already get regular Ask Homie usage. <Link href="/pro" style={{ color: 'var(--accent)' }}>Compare plans</Link>.
      </p>}
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: '#fca5a5' }}>{error}</p>}
    </section>
  );
}
