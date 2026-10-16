'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFarcasterAuth } from '@/lib/farcaster-auth';

interface LearningProgress {
  completions?: Record<string, unknown>;
  completed_ids?: string[];
  hh2_points?: number;
  plan?: { modules?: Array<{ id: string }> };
}

export default function ProfileSummary() {
  const { fid, username, displayName, pfpUrl, signOut } = useFarcasterAuth();
  const [progress, setProgress] = useState<LearningProgress | null>(null);

  useEffect(() => {
    if (!fid) {
      setProgress(null);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/learning-progress?fid=${encodeURIComponent(String(fid))}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted) setProgress(data); })
      .catch(() => {});
    return () => controller.abort();
  }, [fid]);

  if (!fid) return null;

  const name = displayName?.trim() || username?.trim() || `FID ${fid}`;
  const completedCount = Math.max(
    progress?.completed_ids?.length ?? 0,
    Object.keys(progress?.completions ?? {}).length,
  );
  const points = progress?.hh2_points ?? completedCount * 100;

  return (
    <section
      aria-label="Your HomieHouse profile"
      style={{
        margin: '12px 0 16px',
        padding: 14,
        borderRadius: 14,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <Link
        href={`/profile?fid=${fid}`}
        style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, color: 'inherit', textDecoration: 'none' }}
      >
        <img
          src={pfpUrl || '/default-avatar.png'}
          alt=""
          width={48}
          height={48}
          onError={(event) => { event.currentTarget.src = '/default-avatar.png'; }}
          style={{ width: 48, height: 48, flex: '0 0 48px', borderRadius: '50%', objectFit: 'cover', background: 'var(--bg-dark)' }}
        />
        <span style={{ display: 'block', minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, color: 'var(--text-on-dark)' }}>
            {name}
          </strong>
          <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: 'var(--muted-on-dark)' }}>
            {username ? `@${username} · ` : ''}FID {fid}
          </span>
        </span>
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <div style={{ padding: '9px 10px', borderRadius: 10, background: 'var(--bg-dark)' }}>
          <strong style={{ display: 'block', fontSize: 15, color: 'var(--text-on-dark)' }}>{completedCount}</strong>
          <span style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>Lessons completed</span>
        </div>
        <div style={{ padding: '9px 10px', borderRadius: 10, background: 'var(--bg-dark)' }}>
          <strong style={{ display: 'block', fontSize: 15, color: 'var(--text-on-dark)' }}>{points.toLocaleString()}</strong>
          <span style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>HH2 earned</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
        <Link href="/learn" style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-on-dark)', textDecoration: 'none' }}>
          View learning progress →
        </Link>
        <button
          type="button"
          onClick={signOut}
          style={{ border: 0, padding: '4px 0', background: 'transparent', color: 'var(--muted-on-dark)', fontSize: 12, cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>
    </section>
  );
}
