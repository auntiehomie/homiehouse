'use client';

import { useState, useEffect } from 'react';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';

interface ReferralStats {
  referralCode: string | null;
  totalUses: number;
  hh2Earned: number;
  shareUrl: string | null;
  referredBy: { referrerFid: number; createdAt: string } | null;
}

export default function ReferralBanner() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fid = getStoredFid();
    const authHeaders = getAuthHeaders();
    if (!fid || !authHeaders) {
      setLoading(false);
      return;
    }

    fetch('/api/referral/stats', { headers: { ...authHeaders } })
      .then(r => r.json())
      .then(data => {
        if (data.ok) setStats(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!stats?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(stats.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading || !stats?.referralCode) return null;

  return (
    <div style={{
      margin: '16px', padding: '16px', borderRadius: 14,
      background: 'var(--surface)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>🪙</span>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 2px' }}>
            Invite friends, earn HH2
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0 }}>
            You and your friend each get 50 HH2 when they join with your link.
          </p>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '10px 14px', borderRadius: 10,
        background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
        marginBottom: 8,
      }}>
        <code style={{
          flex: 1, fontSize: 13, color: '#fbbf24', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'monospace',
        }}>
          {stats.shareUrl}
        </code>
        <button
          onClick={handleCopy}
          style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 8,
            background: copied ? 'rgba(34,197,94,0.2)' : '#fbbf24',
            border: 'none',
            color: copied ? '#22c55e' : '#000',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {stats.totalUses > 0 && (
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-on-dark)', margin: 0 }}>
              {stats.totalUses}
            </p>
            <p style={{ fontSize: 11, color: 'var(--muted-on-dark)', margin: 0 }}>
              friend{stats.totalUses !== 1 ? 's' : ''} joined
            </p>
          </div>
          <div>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24', margin: 0 }}>
              {stats.hh2Earned}
            </p>
            <p style={{ fontSize: 11, color: 'var(--muted-on-dark)', margin: 0 }}>
              HH2 earned
            </p>
          </div>
        </div>
      )}
    </div>
  );
}