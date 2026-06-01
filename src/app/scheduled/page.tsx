"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useFarcasterWrites } from "@/hooks/useFarcasterWrites";

interface ScheduledCast {
  id: string;
  text: string;
  scheduled_time: string;
  status: string;
  embeds: any[];
  channel_id?: string;
  error_message?: string;
}

function formatRelative(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < -1) return 'publishing soon…';
  if (diffMins < 0) return 'any moment…';
  if (diffMins < 60) return `in ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  return `in ${diffDays} days`;
}

export default function ScheduledPage() {
  const router = useRouter();
  const { user } = usePrivy();
  const { submitCast } = useFarcasterWrites();
  const farcasterAccount = (user?.linkedAccounts ?? []).find((a: any) => a.type === 'farcaster') as any;
  const userFid: number | null = farcasterAccount?.fid ?? null;

  const [casts, setCasts] = useState<ScheduledCast[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<Record<string, string>>({});

  async function loadCasts(showLoading = false) {
    if (!userFid) return;
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/schedule-cast?fid=${userFid}`);
      const data = await res.json();
      if (data.ok) setCasts(data.scheduled_casts || []);
    } catch {}
    if (showLoading) setLoading(false);
  }

  useEffect(() => {
    if (!userFid) return;
    loadCasts(true);
    const interval = setInterval(() => loadCasts(false), 30_000);
    return () => clearInterval(interval);
  }, [userFid]);

  async function handleCancel(id: string) {
    if (!userFid) return;
    setCancelling(id);
    try {
      const res = await fetch(`/api/schedule-cast?id=${id}&fid=${userFid}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) setCasts(prev => prev.filter(c => c.id !== id));
    } finally {
      setCancelling(null);
    }
  }

  async function handleRetry(cast: ScheduledCast) {
    if (!userFid) return;
    setRetrying(cast.id);
    setRetryError(prev => ({ ...prev, [cast.id]: '' }));
    try {
      const embeds = Array.isArray(cast.embeds)
        ? cast.embeds
        : JSON.parse(cast.embeds || '[]');

      const result = await submitCast({
        text: cast.text,
        embeds: embeds.length ? embeds : undefined,
        channelKey: cast.channel_id || undefined,
      });

      // Mark as published in DB
      await fetch('/api/schedule-cast', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cast.id, fid: userFid, cast_hash: result.castHash }),
      });

      setCasts(prev => prev.filter(c => c.id !== cast.id));
    } catch (err: any) {
      setRetryError(prev => ({ ...prev, [cast.id]: err.message || 'Failed to post' }));
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Scheduled Casts</h1>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' }}>
        {!userFid ? (
          <p style={{ textAlign: 'center', color: 'var(--muted-on-dark)', marginTop: 60 }}>Sign in to view scheduled casts.</p>
        ) : loading ? (
          <p style={{ textAlign: 'center', color: 'var(--muted-on-dark)', marginTop: 60 }}>Loading…</p>
        ) : casts.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
            <p style={{ color: 'var(--muted-on-dark)', fontSize: 15 }}>No scheduled casts</p>
            <button
              onClick={() => router.push('/compose')}
              style={{
                marginTop: 20,
                padding: '10px 24px',
                background: 'linear-gradient(180deg, #334155 0%, #1e293b 100%)',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Compose a cast
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {casts.map(cast => (
              <div
                key={cast.id}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${cast.status === 'failed' ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <p style={{ margin: '0 0 10px', fontSize: 15, lineHeight: 1.5, color: 'var(--text-on-dark)' }}>
                  {cast.text}
                </p>

                {cast.channel_id && (
                  <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 8 }}>
                    /{cast.channel_id}
                  </div>
                )}

                {cast.embeds?.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 8 }}>
                    {cast.embeds.length} attachment{cast.embeds.length !== 1 ? 's' : ''}
                  </div>
                )}

                {retryError[cast.id] && (
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#f87171' }}>{retryError[cast.id]}</p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                    {cast.status === 'failed' ? (
                      <span style={{ color: '#f87171' }}>
                        Failed{cast.error_message ? `: ${cast.error_message}` : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted-on-dark)' }}>
                        {new Date(cast.scheduled_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        <span style={{ opacity: 0.6, marginLeft: 6 }}>({formatRelative(cast.scheduled_time)})</span>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {cast.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(cast)}
                        disabled={retrying === cast.id}
                        style={{
                          padding: '5px 14px',
                          borderRadius: 8,
                          border: '1px solid rgba(99,102,241,0.5)',
                          background: 'transparent',
                          color: '#a5b4fc',
                          cursor: retrying === cast.id ? 'not-allowed' : 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                          opacity: retrying === cast.id ? 0.5 : 1,
                        }}
                      >
                        {retrying === cast.id ? 'Posting…' : 'Post now'}
                      </button>
                    )}

                    <button
                      onClick={() => handleCancel(cast.id)}
                      disabled={cancelling === cast.id}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 8,
                        border: '1px solid rgba(239,68,68,0.4)',
                        background: 'transparent',
                        color: '#f87171',
                        cursor: cancelling === cast.id ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        opacity: cancelling === cast.id ? 0.5 : 1,
                      }}
                    >
                      {cancelling === cast.id ? '…' : cast.status === 'failed' ? 'Delete' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
